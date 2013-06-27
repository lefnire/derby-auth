_ = require "lodash"
deepCopy = require("racer/lib/util").deepCopy

###
Sets up db indexes
###
ensureIndexes = (mongo, strategies) ->
  ensure = mongo.collection('auths').ensureIndex
  ensure {'local.username': 1}, {background: true}, (err, replies) ->
  # Go through each provider the website is using and create indexes like {facebook.id: 1}
  _.each strategies, (obj, name) ->
    index = {}; index["#{name}.id"] = 1
    ensure index, {background: true}, ->

###
Sets up onQuery & onChange convenience methods so we can write accessControl methods. Moved to util.js because
they might be moved to racer core in the future.
###
init = (store) ->
  ###
  Assign the connect session to ShareJS's useragent (there is 1 useragent per
  browser tab or window that is connected to our server via browserchannel).
  We'll probably soon move this into racer core, so developers won't need to
  remember to have this code here.
  ###
  store.shareClient.use "connect", (shareRequest, next) ->
    req = shareRequest.req
    shareRequest.agent.connectSession = req.session  if req
    next()

  ###
  A convenience method for declaring access control on writes. For usage, see
  the example code below (`store.onChange('users', ...`)). This may be moved
  into racer core. We'll want to experiment to see if this particular
  interface is sufficient, before committing this convenience method to core.
  ###
  store.onChange = (collectionName, callback) ->
    @shareClient.use "validate", (shareRequest, next) ->
      collection = shareRequest.collection
      return next()  if collection isnt collectionName
      agent = shareRequest.agent
      action = shareRequest.action
      docName = shareRequest.docName
      backend = shareRequest.backend

      # opData represents the ShareJS operation
      opData = shareRequest.opData

      # snapshot is the snapshot of the data after the opData has been applied
      snapshot = shareRequest.snapshot
      snapshotData = (if (opData.del) then opData.prev.data else snapshot.data)
      isServer = shareRequest.agent.stream.isServer
      callback docName, opData, snapshotData, agent.connectSession, isServer, next

  ###
  A convenience method for declaring access control on queries. For usage, see
  the example code below (`store.onQuery('items', ...`)). This may be moved
  into racer core. We'll want to experiment to see if this particular
  interface is sufficient, before committing this convenience method to core.
  ###
  store.onQuery = (collectionName, callback) ->
    @shareClient.use "query", (shareRequest, next) ->
      return next() if collectionName isnt shareRequest.collection
      session = shareRequest.agent.connectSession
      shareRequest.query = deepCopy(shareRequest.query)
      callback shareRequest.query, session, next

accessControl = (store) ->

  ###
  Delegate to ShareJS directly to protect fetches and subscribes. Will try to
  come up with a different interface that does not expose this much of ShareJS
  to the developer using racer.
  ###
  protectRead = (shareRequest, next) ->
    return next() if shareRequest.collection isnt "auths"
    return next() if shareRequest.docName is shareRequest.agent.connectSession.userId
    next new Error("Not allowed to fetch users who are not you.")
    
  store.shareClient.use "subscribe", protectRead
  store.shareClient.use "fetch", protectRead

  

  ###
  Only allow users to modify or delete themselves. Only allow the server to
  create users.
  ###
  store.onChange "auths", (docId, opData, snapshotData, session, isServer, next) ->
    if docId is (session and session.userId)
      next()
    else if opData.del
      next new Error("Not allowed to deleted users who are not you.")
    else if opData.create
      if isServer
        next()
      else
        next new Error("Not allowed to create users.")
    else
      next new Error("Not allowed to update users who are not you.")

###
  {store} The Racer store. Needed for setting up accessControl
  {mongo} The initialized mongoskin object. The reason we need this is to run db.ensureIndexes() on first run,
    and we may need in the future to access sensitive auth properties due to missing mongo projections feature
    in Racer 0.5 (@see http://goo.gl/mloKO)
###
module.exports = (store, mongo, strategies) ->
  # FIXME this is very much needed, but commented out because causing https://gist.github.com/lefnire/6f585109187eb06338fc
  # ensureIndexes(mongo, strategies)

  init(store)
  accessControl(store)
