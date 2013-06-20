express = require('express')
coffeeify = require('coffeeify')
derby = require('derby')
racerBrowserChannel = require('racer-browserchannel')
LiveDbMongo = require('livedb-mongo').LiveDbMongo
MongoStore = require('connect-mongo')(express)
app = require('../auth')
serverError = require('./serverError')
mongoskin = require('mongoskin')
publicDir = require('path').join __dirname + '/../../public'

expressApp = module.exports = express()

# Get Redis configuration
if process.env.REDIS_HOST
  redis = require("redis").createClient(process.env.REDIS_PORT, process.env.REDIS_HOST)
  redis.auth process.env.REDIS_PASSWORD
else if process.env.REDISCLOUD_URL
  redisUrl = require("url").parse(process.env.REDISCLOUD_URL)
  redis = require("redis").createClient(redisUrl.port, redisUrl.hostname)
  redis.auth redisUrl.auth.split(":")[1]
else
  redis = require("redis").createClient()
redis.select process.env.REDIS_DB or 8

# Get Mongo configuration
mongoUrl = process.env.NODE_DB_URI or "mongodb://localhost:27017/derby-auth"
mongo = mongoskin.db "#{mongoUrl}?auto_reconnect", {safe: true}

# The store creates models and syncs data
store = derby.createStore
  db: new LiveDbMongo(mongo)
  redis: redis

store.on 'bundle', (browserify) ->
  browserify.transform coffeeify

###
(1)
Setup a hash of strategies you'll use - strategy objects and their configurations
Note, API keys should be stored as environment variables (eg, process.env.FACEBOOK_KEY, process.env.FACEBOOK_SECRET)
rather than a configuration file. We're storing it in conf.js for demo purposes.
###
auth = require("../../../index.js") # change to `require('derby-auth')` in your project
keys = require("./conf.coffee")
strategies =
  facebook:
    strategy: require("passport-facebook").Strategy
    conf:
      clientID: process.env.FACEBOOK_KEY or keys.fb.appId
      clientSecret: process.env.FACEBOOK_SECRET or keys.fb.appSecret

  linkedin:
    strategy: require("passport-linkedin").Strategy
    conf:
      consumerKey: process.env.LINKEDIN_API_KEY or keys.linkedin.apiKey
      consumerSecret: process.env.LINKEDIN_SECRET_KEY or keys.linkedin.apiSecret

  github:
    strategy: require("passport-github").Strategy
    conf:
      clientID: process.env.GITHUB_CLIENT_ID or keys.github.appId
      clientSecret: process.env.GITHUB_CLIENT_SECRET or keys.github.appSecret
      callbackURL: "http://127.0.0.1:3000/auth/github/callback"

  twitter:
    strategy: require("passport-twitter").Strategy
    conf:
      consumerKey: process.env.TWITTER_CONSUMER_KEY or keys.twit.consumerKey
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET or keys.twit.consumerSecret

      # You can optionally pass in per-strategy configuration options (consult Passport documentation)
      callbackURL: "http://127.0.0.1:3000/auth/twitter/callback"


# optional parameters passed into derby-auth.init, domain is required due to some Passport technicalities,
# allowPurl lets people access non-authenticated accounts at /:uuid, and schema sets up default user
# account schema structures
options = domain: "http://localhost:3000"

auth.store.init(store)
auth.store.basicUserAccess(store)

expressApp
    .use(express.favicon())
    .use(express.compress())
    .use(app.scripts(store))
    .use(express['static'](publicDir))
    .use(express.cookieParser())
    .use(express.session({
        secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
        store: new MongoStore({
            url: mongoUrl
            safe: true
        })
    }))
    .use(express.bodyParser())
    .use(express.methodOverride())
    .use(racerBrowserChannel(store))
    .use(store.modelMiddleware())

    # (2)
    # derbyAuth.middleware is inserted after modelMiddleware and before the app router to pass server accessible data to a model
    # Pass in {store} (sets up accessControl & queries), {strategies} (see above), and options
    .use(auth.middleware(strategies, options))

    .use(app.router())
    .use(expressApp.router)
    .use(serverError())

expressApp.all "*", (req, res, next) -> next("404: #{req.url}")