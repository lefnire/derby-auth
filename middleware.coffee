passport = require("passport")
LocalStrategy = require("passport-local").Strategy
flash = require("connect-flash")
_ = require("lodash")
expressApp = require("express")()
utils = require("./utils.coffee")
nodemailer = require("nodemailer")

###
Utility functions
-------------------
###
sendEmail = (mailData, options) ->
  unless (options and options.smtp.service and options.smtp.user and options.smtp.pass)
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
    service: options.smtp.service
    auth:
      user: options.smtp.user
      pass: options.smtp.pass

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
    site:
      domain:           "http://localhost:3000"
      name:             "My Site"
      email:            "admin@mysite.com"
    smtp:
      service:          process.env.SMTP_SERVICE
      user:             process.env.SMTP_USER
      pass:             process.env.SMTP_PASS

  _.defaults options, defaults
  _.each defaults, (v,k) ->
    _.defaults options[k], v

  setupPassport strategies, options

  # Initialize Passport.  Also use passport.session() middleware, to support persistent login sessions
  expressApp.use flash()
  expressApp.use passport.initialize()
  expressApp.use passport.session()

  # After passport does it's thing, let's use it's req.user object & req helper methods to setup our app
  expressApp.use (req, res, next) ->
    model = req.getModel()
    model.set "_session.flash", req.flash() # set any error / success messages
    model.set "_session.loggedIn", req.isAuthenticated()
    model.set "_session.userId", req.user
    if req.user
      #FIXME optimize: any other place we can put this so we're not fetch/setting all over creation?
      $q = model.at "auth.#{req.user}"
      $q.fetch (err) -> $q.set("timestamps.loggedin", +new Date, next)
    else next()

  # Setup static passport authentication routes
  setupStaticRoutes expressApp, strategies, options

  expressApp

###
  Passport Setup
###
setupPassport = (strategies, options) ->

  # Passport has these methods for serializing / deserializing users to req.session.passport.user. This works for
  # static apps, but since Derby is realtime and we'll be retrieving users in a model.subscribe to _page.user, we let
  # the app handle that and we simply serialize/deserialize the id, such that req.session.passport.user = {id}
  passport.serializeUser (user, done) ->
    done null, user.id
  passport.deserializeUser (id, done) ->
    done null, id

  # Use the LocalStrategy within Passport.
  #   Strategies in passport require a `verify` function, which accept
  #   credentials (in this case, a username and password), and invoke a callback
  #   with a user object.
  passport.use new LocalStrategy
    passReqToCallback: true # required so we can access model.getModel()
  , (req, username, password, done) ->
    model = req.getModel()

    # Find the user by username.  If there is no user with the given
    # username, or the password is not correct, set the user to `false` to
    # indicate failure and set a flash message.  Otherwise, return the
    # authenticated `user`.
    $uname = model.query "auth",
      "local.username": username
      $limit: 1
    $uname.fetch (err) ->
      return done(err) if err # real error
      auth = $uname.get()[0]
      unless auth # user not found
        return done null, false, message: "Unkown user #{username}"

      # We needed the whole user object first so we can get his salt to encrypt password comparison
      hashed = utils.encryptPassword(password, auth.local.salt)
      $unamePass = model.query "auth",
        "local.username": username
        "local.hashed_password": hashed
        $limit: 1
      $unamePass.fetch (err) ->
        return done(err)  if err # real error
        auth = $unamePass.get()?[0]
        unless auth # user not found
          return done null, false, message: "Invalid password."
        done(null, auth)

  _.each strategies, (obj, name) ->

    # Provide default values for options not passed in
    _.defaults obj.conf,
      callbackURL: options.site.domain + "/auth/#{name}/callback"
      passReqToCallback: true # required so we can access model.getModel()

    # Use the FacebookStrategy within Passport.
    #   Strategies in Passport require a `verify` function, which accept
    #   credentials (in this case, an accessToken, refreshToken, and Facebook
    #   profile), and invoke a callback with a user object.
    passport.use new obj.strategy obj.conf, (req, accessToken, refreshToken, profile, done) ->
      model = req.getModel()

      # If facebook user exists, log that person in. If not, associate facebook user
      # with currently "staged" user account - then log them in
      $currUser = model.at("auth." + req.user)
      $provider = $limit: 1
      $provider["#{profile.provider}.id"] = profile.id
      $provider = model.query("auth", $provider)
      model.fetch $provider, $currUser, (err) ->
        return done(err) if err
        auth = $provider.get()?[0]
        currUser = $currUser.get()

        # Append accessToken & refreshToken to user's provider profile. They're often required, and
        # I see many other auth libraries doing this - if anyone is concerned about security, please contact me
        [profile.accessToken, profile.refreshToken] = [accessToken, refreshToken]

        # User already registered with this provider, login
        if auth?[profile.provider]
          return done(null, auth)

        # User already registered, but not with this oauth account - tie to their existing account
        else if currUser
          # FIXME setDiff isn't working here for some reason
          $currUser.set "#{profile.provider}", profile, ->
            $currUser.set "timestamps.registered", +new Date, ->done(null, currUser)

        # User not yet registered, create new user
        else
          newAuth =
            id: model.id()
            timestamps: registered: +new Date
          newAuth[profile.provider] = profile
          model.add "auth", newAuth, -> done(null, newAuth)

###
Routes (Including Passport Routes)
--------------------
Sets up static routes for Derby app. Normally this wouldn't be necessary, would just place this logic
in middelware() setup. However, it breaks Derby routes - so we need this to call separately after expressApp
hass been initialized
###
setupStaticRoutes = (expressApp, strategies, options) ->

  # POST /login
  #   Use passport.authenticate() as route middleware to authenticate the
  #   request.  If authentication fails, the user will be redirected back to the
  #   login page.  Otherwise, the primary route function function will be called,
  #   which, in this example, will redirect the user to the home page.
  #
  #   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
  expressApp.post "/login", passport.authenticate("local", options.passport)

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
    $uname = model.query "auth",
      'local.username': req.body.username
      $limit: 1
    $currUser = model.at "auth." + model.get("_session.userId")
    model.fetch $uname, $currUser, (err) ->
      return next(err) if err

      if $uname.get()?[0]
        req.flash 'error', "That username is already registered"
        return res.redirect(options.passport.failureRedirect)

      currUser = $currUser.get()
      if currUser?.local?.username
        req.flash 'error', "You are already registered"
        return res.redirect(options.passport.failureRedirect)

      # Legit, register
      salt = utils.makeSalt()
      localAuth =
        username: req.body.username
        email: req.body.email
        salt: salt
        hashed_password: utils.encryptPassword(req.body.password, salt)

      thenLogin = ->
        req.login currUser, (err) ->
          return next(err) if err
          res.redirect options.passport.successRedirect

      # user already registered with an oauth, tie local registration to account
      if currUser
        $currUser.set "local", localAuth, thenLogin
      else
        currUser =
          id: model.id()
          local: localAuth
          timestamps: registered: +new Date
        model.add "auth", currUser, thenLogin

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
    expressApp.get "/auth/#{name}/callback", passport.authenticate(name, options.passport), (req, res) ->
      res.redirect options.passport.successRedirect

  expressApp.get "/logout", (req, res) ->
    req.logout()
    res.redirect "/"

  expressApp.post "/password-reset", (req, res, next) ->
    model = req.getModel()
    email = req.body.email
    salt = utils.makeSalt()
    newPassword = utils.makeSalt() # use a salt as the new password too (they'll change it later)
    hashed_password = utils.encryptPassword(newPassword, salt)
    $email = model.query("auth",
      "local.email": email
      $limit: 1
    )
    $email.fetch (err) ->
      return next(err)  if err
      auth = $email.get()[0]
      return res.send(500, "Couldn't find a user registered for email " + email)  unless auth
      req._isServer = true # our bypassing of session-based accessControl
      $email.set "local.salt", salt
      $email.set "local.hashed_password", hashed_password
      sendEmail
        from: "#{options.site.name} <#{options.site.email}>"
        to: email
        subject: "Password Reset for #{options.site.name}"
        text: "Password for " + auth.local.username + " has been reset to " + newPassword + ". Log in at #{options.site.domain}"
        html: "Password for <strong>" + auth.local.username + "</strong> has been reset to <strong>" + newPassword + "</strong>. Log in at #{options.site.domain}"
      , options

      res.send "New password sent to " + email


  expressApp.post "/password-change", (req, res, next) ->
    model = req.getModel()
    uid = req.body.uid
    $user = model.at("auth." + uid)
    $user.fetch (err) ->
      auth = $user.get()[0]
      if err or !auth
        return res.send 500, err or "Couldn't find that user (this shouldn't be happening, contact Tyler: http://goo.gl/nrx99)"
      salt = userObj.local.salt
      hashed_old_password = utils.encryptPassword(req.body.oldPassword, salt)
      hashed_new_password = utils.encryptPassword(req.body.newPassword, salt)
      return res.send(500, "Old password doesn't match")  if hashed_old_password isnt auth.local.hashed_password
      $user.set "auth.local.hashed_password", hashed_new_password
      res.send 200

  # Simple route middleware to ensure user is authenticated.
  #   Use this route middleware on any resource that needs to be protected.  If
  #   the request is authenticated (typically via a persistent login session),
  #   the request will proceed.  Otherwise, the user will be redirected to the
  #   login page.
  #   ensureAuthenticated = (req, res, next) ->
  #     return next() if req.isAuthenticated()
  #     res.redirect "/login"
