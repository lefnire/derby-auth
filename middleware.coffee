passport = require("passport")
LocalStrategy = require("passport-local").Strategy
flash = require("connect-flash")
_ = require("lodash")
expressApp = require("express")()
utils = require("./utils.coffee")
nodemailer = require("nodemailer")

opts = undefined

###
Utility functions
-------------------
###

createUserId = (req, res, next) ->
  model = req.getModel()
  userId = req.session.userId || (req.session.userId = model.id())
  model.set('_session.userId', userId)
  next()


login = (user, req, res, done) ->
  req.session.userId = user.id
  if req.isAuthenticated() then done(null, user)
  else
    req.login user, (err) ->
      return done(err) if err
      if res then res.redirect opts.passport.successRedirect
      else done(null, user)
###
  Register the user if all other tests passed. This either (1) creates a new user, or (2) adds this new strategy
  to an existing user if they're registered with a different strategy
  {$user} the model.at("auths.{ID}"). This "at" allows us to operate on the database
  {strategy} "local", "facebook", etc
  {data} the strategy data to save. {username,password,email,etc} for "local", {firstname,lastname,..} for "facebook", etc
  {req}
  {res}
  {done}
###
register = ($user, strategy, data, req, res, done) ->
  cb = ->
    if opts.passport.registerCallback
      opts.passport.registerCallback req, res, $user.get(), (->login $user.get(), req, res, done)
    else login($user.get(),req,res,done)

  user = $user.get()

  # User already registered, but not with this strategy - tie to their existing account
  if user
    $user.set "#{strategy}", data, ->
      $user.set "timestamps.registered", +new Date, cb

  # User not yet registered, create new user
  else
    model = req.getModel()
    id = model.id()
    newUser = {id}
    newUser[strategy] = data
    newUser.timestamps = {registered: +new Date}
    model.set "auths.#{id}", newUser, ->
      $user = model.at "auths.#{id}"
      cb()

logout = (req, res) ->
  delete req.session.userId
  req.logout()
  res.redirect "/"

sendEmail = (mailData) ->
  unless (opts and opts.smtp.service and opts.smtp.user and opts.smtp.pass)
    return console.error """
          Unable to send email from derby-auth. Pass email creds as `options` param to `require('derby-auth').middleware(strategies, options)`. Structured like:
          options = {
            smtp: {
              service: 'Gmail',
              user: 'me@gmail.com',
              pass: 'abc'
            }
          }
          """

  # create reusable transport method (opens pool of SMTP connections)
  smtpTransport = nodemailer.createTransport "SMTP",
    service: opts.smtp.service
    auth:
      user: opts.smtp.user
      pass: opts.smtp.pass

  # send mail with defined transport object
  smtpTransport.sendMail mailData, (error, response) ->
    return console.error error if error
    console.log "Message sent: " + response.message
    smtpTransport.close() # shut down the connection pool, no more messages

###
Provides "mounted" (sub-app) middleware which provides authentication for DerbyJS
@param {strategies} A hash of strategy objects and their configurations. See https://github.com/lefnire/derby-examples/blob/master/authentication/src/server/index.coffee
@param {options}
  - passport
    - failureRedirect
    - successRedirect
    - etc. See passport documentation for what options to pass to strategies
  - site
    - domain
    - name
    - email
  - smtp
    - service
    - user
    - pass

###
module.exports = (strategies, options) ->

  # Setup default options
  defaults =
    passport:
      failureRedirect:  "/"
      successRedirect:  "/"
      failureFlash:     true
      registerCallback: null
      passReqToCallback:  true
      usernameField:      'username'
    site:
      domain:           "http://localhost:3000"
      name:             "My Site"
      email:            "admin@mysite.com"
    smtp:
      service:          process.env.SMTP_SERVICE
      user:             process.env.SMTP_USER
      pass:             process.env.SMTP_PASS

  _.defaults options, defaults
  _.each defaults, (v,k) -> _.defaults(options[k], v)

  # Set as closure to this file - we need these everywhere. Bad idea? memleak / security issue?
  opts = options

  setupPassport strategies

  # Initialize Passport.  Also use passport.session() middleware, to support persistent login sessions
  expressApp.use flash()
  expressApp.use passport.initialize()
  expressApp.use passport.session()
  expressApp.use createUserId

  # After passport does it's thing, let's use it's req.user object & req helper methods to setup our app
  expressApp.use (req, res, next) ->
    model = req.getModel()
    model.set "_session.flash", req.flash() # set any error / success messages
    model.set "_session.userId", req.session.userId
    if req.isAuthenticated()
      model.set "_session.loggedIn", true
      #FIXME optimize: any other place we can put this so we're not fetch/setting all over creation?
      $q = model.at "auths.#{req.session.userId}"
      $q.fetch (err) -> $q.set("timestamps.loggedin", +new Date, next)
    else next()

  # Setup static passport authentication routes
  setupStaticRoutes expressApp, strategies

  expressApp

###
  Passport Setup
###
setupPassport = (strategies) ->

  # Passport has these methods for serializing / deserializing users to req.session.passport.user. This works for
  # static apps, but since Derby is realtime and we'll be retrieving users in a model.subscribe to _page.user, we let
  # the app handle that and we simply serialize/deserialize the id, such that req.session.passport.user = {id}.
  # Even then, we don't really use req.user because we need userId on `req.session`, not just `req`, due to how ShareJS
  # operates - so we manually set req.session.userId throughout this module, and these two functions become useless
  passport.serializeUser (user, done) ->
    done null, user.id
  passport.deserializeUser (id, done) ->
    done null, id

  # Use the LocalStrategy within Passport.
  #   Strategies in passport require a `verify` function, which accept
  #   credentials (in this case, a username and password), and invoke a callback
  #   with a user object.
  passport.use new LocalStrategy opts.passport, (req, username, password, done) ->
    model = req.getModel()
    authQuery = 
      $limit: 1

    authQuery['local.'+opts.passport.usernameField] = username
    # Find the user by username.  If there is no user with the given
    # username, or the password is not correct, set the user to `false` to
    # indicate failure and set a flash message.  Otherwise, return the
    # authenticated `user`.
    $uname = model.query "auths", authQuery
    $uname.fetch (err) ->
      return done(err) if err # real error
      auth = $uname.get()[0]
      unless auth # user not found
        return done null, false, message: "Unkown user #{username}"

      # We needed the whole user object first so we can get his salt to encrypt password comparison
      hashed = utils.encryptPassword(password, auth.local.salt)
      authQuery["local.hashed_password"] = hashed

      $unamePass = model.query "auths", authQuery
      $unamePass.fetch (err) ->
        return done(err) if err # real error
        auth = $unamePass.get()?[0]
        return done(null, false, message: "Invalid password.") unless auth
        login auth, req, null, done

  _.each strategies, (obj, name) ->

    # Provide default values for options not passed in
    _.defaults obj.conf,
      callbackURL: opts.site.domain + "/auth/#{name}/callback"
      passReqToCallback: true # required so we can access model.getModel()

    # Use the FacebookStrategy within Passport.
    #   Strategies in Passport require a `verify` function, which accept
    #   credentials (in this case, an accessToken, refreshToken, and Facebook
    #   profile), and invoke a callback with a user object.
    passport.use new obj.strategy obj.conf, (req, accessToken, refreshToken, profile, done) ->
      model = req.getModel()

      # If facebook user exists, log that person in. If not, associate facebook user
      # with currently "staged" user account - then log them in
      $currUser = model.at("auths." + req.session.userId)
      $provider = $limit: 1
      $provider["#{profile.provider}.id"] = profile.id
      $provider = model.query("auths", $provider)
      model.fetch $provider, $currUser, (err) ->
        return done(err) if err
        auth = $provider.get()?[0]

        # User already registered with this provider, login
        if auth?[profile.provider]
          login auth, req, null, done

        # Append accessToken & refreshToken to user's provider profile. They're often required, and
        # I see many other auth libraries doing this - if anyone is concerned about security, please contact me
        [profile.accessToken, profile.refreshToken] = [accessToken, refreshToken]

        register($currUser, profile.provider, profile, req, null, done)

###
Routes (Including Passport Routes)
--------------------
Sets up static routes for Derby app. Normally this wouldn't be necessary, would just place this logic
in middelware() setup. However, it breaks Derby routes - so we need this to call separately after expressApp
hass been initialized
###
setupStaticRoutes = (expressApp, strategies) ->

  # POST /login
  #   Use passport.authenticate() as route middleware to authenticate the
  #   request.  If authentication fails, the user will be redirected back to the
  #   login page.  Otherwise, the primary route function function will be called,
  #   which, in this example, will redirect the user to the home page.
  #
  #   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
  expressApp.post "/login", passport.authenticate("local", opts.passport)

  # POST /login
  #   This is an alternative implementation that uses a custom callback to
  #   acheive the same functionality.
  #
  #    app.post "/login", (req, res, next) ->
  #      passport.authenticate("local", (err, user, info) ->
  #        return next(err) if err
  #        unless user
  #          req.flash "error", info.message
  #          return res.redirect("/login")
  #        req.logIn user, (err) ->
  #          return next(err)  if err
  #          res.redirect "/users/" + user.username

  expressApp.post "/register", (req, res, next) ->
    model = req.getModel()
    authQuery = 
      $limit: 1

    authQuery['local.'+opts.passport.usernameField] = req.body[opts.passport.usernameField]

    $uname = model.query "auths", authQuery
    $currUser = model.at "auths." + req.session.userId
    model.fetch $uname, $currUser, (err) ->
      return next(err) if err

      if $uname.get()?[0]
        req.flash 'error', "That "+opts.passport.usernameField+" is already registered"
        return res.redirect(opts.passport.failureRedirect)

      currUser = $currUser.get()
      # what to do here?
      if currUser?.local?.username
        req.flash 'error', "You are already registered"
        return res.redirect(opts.passport.failureRedirect)

      # Legit, register
      salt = utils.makeSalt()
      localAuth =
        username: req.body.username
        email: req.body.email
        salt: salt
        hashed_password: utils.encryptPassword(req.body.password, salt)

      # Allows for login fields to be something other than username or email
      localAuth[opts.passport.usernameField] = req.body[opts.passport.usernameField]
      register $currUser, 'local', localAuth, req, res, next

  _.each strategies, (strategy, name) ->
    params = strategy.params or {}

    # GET /auth/facebook
    #   Use passport.authenticate() as route middleware to authenticate the
    #   request.  The first step in Facebook authentication will involve
    #   redirecting the user to facebook.com.  After authorization, Facebook will
    #   redirect the user back to this application at /auth/facebook/callback
    expressApp.get "/auth/#{name}", passport.authenticate(name, params), (req, res) ->
      # The request will be redirected to Facebook for authentication, so this
      # function will not be called.

    # GET /auth/facebook/callback
    #   Use passport.authenticate() as route middleware to authenticate the
    #   request.  If authentication fails, the user will be redirected back to the
    #   login page.  Otherwise, the primary route function function will be called,
    #   which, in this example, will redirect the user to the home page.
    expressApp.get "/auth/#{name}/callback", passport.authenticate(name, opts.passport), (req, res) ->
      res.redirect opts.passport.successRedirect

  expressApp.get "/logout", logout

  expressApp.post "/password-reset", (req, res, next) ->
    model = req.getModel()
    email = req.body.email
    salt = utils.makeSalt()
    newPassword = utils.makeSalt() # use a salt as the new password too (they'll change it later)
    hashed_password = utils.encryptPassword(newPassword, salt)
    $email = model.query("auths",
      "local.email": email
      $limit: 1
    )
    $email.fetch (err) ->
      return next(err)  if err
      auth = $email.get()[0]
      return res.send(500, "Couldn't find a user registered for email " + email)  unless auth
      req._isServer = true # our bypassing of session-based accessControl
      model.set "auths.#{auth.id}.local.salt", salt
      model.set "auths.#{auth.id}.local.hashed_password", hashed_password
      sendEmail
        from: "#{opts.site.name} <#{opts.site.email}>"
        to: email
        subject: "Password Reset for #{opts.site.name}"
        text: "Password for " + auth.local[opts.passport.usernameField] + " has been reset to " + newPassword + ". Log in at #{opts.site.domain}"
        html: "Password for <strong>" + auth.local[opts.passport.usernameField]+ "</strong> has been reset to <strong>" + newPassword + "</strong>. Log in at #{opts.site.domain}"

      res.send "New password sent to " + email

  expressApp.post "/password-change", (req, res, next) ->
    model = req.getModel()
    uid = req.body.uid
    $user = model.at("auths." + uid)
    $user.fetch (err) ->
      auth = $user.get()[0]
      if err or !auth
        return res.send 500, err or "Couldn't find that user (this shouldn't be happening, contact Tyler: http://goo.gl/nrx99)"
      salt = auth.local.salt
      hashed_old_password = utils.encryptPassword(req.body.oldPassword, salt)
      hashed_new_password = utils.encryptPassword(req.body.newPassword, salt)
      return res.send(500, "Old password doesn't match")  if hashed_old_password isnt auth.local.hashed_password
      $user.set "local.hashed_password", hashed_new_password
      res.send 200

  # Simple route middleware to ensure user is authenticated.
  #   Use this route middleware on any resource that needs to be protected.  If
  #   the request is authenticated (typically via a persistent login session),
  #   the request will proceed.  Otherwise, the user will be redirected to the
  #   login page.
  #   ensureAuthenticated = (req, res, next) ->
  #     return next() if req.isAuthenticated()
  #     res.redirect "/login"
