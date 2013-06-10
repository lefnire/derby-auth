var passport = require('passport')
    , LocalStrategy = require('passport-local').Strategy
    , flash = require('connect-flash') // used for setting error messages
    , _  = require('lodash')
    , expressApp = require('express')()
    , utils = require('./utils')
    , nodemailer = require("nodemailer")
  ;

module.exports.store = require('./store');

/**
 * Provides "mounted" (sub-app) middleware which provides authentication for DerbyJS
 * @param {strategies} A hash of strategy objects and their configurations. See https://github.com/lefnire/derby-examples/blob/master/authentication/src/server/index.coffee
 * @param {options} TODO document this
 */
module.exports.middleware = function(strategies, options) {

    // Setup default options
    _.defaults(options, {
        failureRedirect: '/',
        domain: "http://localhost:3000",
        schema: {}
    });

    expressApp.use(flash());

    // Must be called before passport middleware so they have access to model
    expressApp.use(setupMiddleware(strategies, options));

    // Initialize Passport.  Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    expressApp.use(passport.initialize());
    expressApp.use(passport.session());

    setupPassport(strategies, options);

    // Setup static passport authentication routes
    setupStaticRoutes(expressApp, strategies, options);

    return expressApp;
}

/**
 * Passport Setup
 * ------------------
 */
function setupMiddleware(strategies, options) {
    return function(req, res, next) {
        if (req.is('json')) return next() // don't create new users / authenticate on REST calls

        var model = req.getModel()
            , sess = req.session;

        model.set('_session.loggedIn', sess.passport && sess.passport.user);
        model.set('_session.userId', sess.userId);

        // set any error / success messages
        model.set('_session.flash', req.flash());

        // New User - They get to play around before creating a new account.
        if (!sess.userId) {
            var schema = _.cloneDeep(options.schema);
            _.defaults(schema, {auth:{}}); // make sure user schema is defaulted with at least {auth:{}}
            sess.userId = model.add("users", schema);
        }

        return next();
    }
}

function setupPassport(strategies, options) {
    // Passport session setup.
    //   To support persistent login sessions, Passport needs to be able to
    //   serialize users into and deserialize users out of the session.  Typically,
    //   this will be as simple as storing the user ID when serializing, and finding
    //   the user by ID when deserializing.
    passport.serializeUser(function(uid, done) {
        done(null, uid);
    });

    passport.deserializeUser(function(id, done) {
        return done(null, id);

        // TODO Revisit:
        // Because we're logging a user into req.session on passport strategy authentication,
        // we don't need to deserialize the user. (Plus the app will be pulling the user out of the
        // database manually via model.fetch / .subscribe). Additionally, attempting to deserialize the user here
        // by fetching from the database yields "Error: Model mutation performed after bundling for clientId:..."
        /*var q = model.query('users').withId(id);
         _fetchUser(q, model, function(err, userObj){
         if(err && !err.notFound) return done(err);
         _loginUser(model, userObj, done);
         });*/
    });

    // Use the LocalStrategy within Passport.
    //   Strategies in passport require a `verify` function, which accept
    //   credentials (in this case, a username and password), and invoke a callback
    //   with a user object.  In the real world, this would query a database;
    //   however, in this example we are using a baked-in set of users.
    passport.use(new LocalStrategy(
        {passReqToCallback:true}, // required so we can access model.getModel()
        function(req, username, password, done) {
            var model = req.getModel()
            // Find the user by username.  If there is no user with the given
            // username, or the password is not correct, set the user to `false` to
            // indicate failure and set a flash message.  Otherwise, return the
            // authenticated `user`.
            var withUname = model.query('users', {'auth.local.username':username, $limit:1})
            withUname.fetch(function(err){
                if (err) return done(err); // real error
                var uObj = withUname.get()[0]
                if (!uObj) return done(null, false, {message:'User not found with that username.'});// user not found

                // We needed the whole user object first so we can get his salt to encrypt password comparison
                var hashed = utils.encryptPassword(password, uObj.auth.local.salt),
                    $login = model.query('users', {'auth.local.username': username, 'auth.local.hashed_password': hashed, $limit: 1});
                $login.fetch(function(err){
                    if (err) return done(err); // real error
                    uObj = $login.get()[0]
                    if (!uObj) return done(null, false, {message:'Password incorrect.'});// user not found
                    _loginUser(model, req, uObj.id, done);
                });
            });
        }
    ));

    _.each(strategies, function(obj, name){

        // Provide default values for options not passed in
        // TODO pass in as conf URL variable
        _.defaults(obj.conf, {
            callbackURL: options.domain + "/auth/" + name + "/callback",
            passReqToCallback:true // required so we can access model.getModel()
        });

        // Use the FacebookStrategy within Passport.
        //   Strategies in Passport require a `verify` function, which accept
        //   credentials (in this case, an accessToken, refreshToken, and Facebook
        //   profile), and invoke a callback with a user object.
        passport.use(new obj.strategy(obj.conf, function(req, accessToken, refreshToken, profile, done) {
                var model = req.getModel();

                // If facebook user exists, log that person in. If not, associate facebook user
                // with currently "staged" user account - then log them in

                var $currUser = model.at('users.' + req.session.userId);
                    $provider = {$limit: 1};
                $provider['auth.' + profile.provider + '.id'] = profile.id;
                $provider = model.query('users', $provider);

                model.fetch($provider, $currUser, function(err) {
                    if (err) return done(err);
                    var userObj = $provider.get()[0]
                    if (!userObj) {
                        $currUser.set('auth.' + profile.provider, profile);
                        $currUser.set('auth.timestamps.created', +new Date);
                        userObj = $currUser.get();
                        if (!userObj && !userObj.id) return done("Something went wrong trying to tie #{profile.provider} account to staged user")
                    }

                    // User was found, log in
                    _loginUser(model, req, userObj.id, done);
                });
            }
        ));
    });
}

/**
 * Routes (Including Passport Routes)
 * --------------------
 * Sets up static routes for Derby app. Normally this wouldn't be necessary, would just place this logic
 * in middelware() setup. However, it breaks Derby routes - so we need this to call separately after expressApp
 * hass been initialized
 */
function setupStaticRoutes(expressApp, strategies, options) {

    // POST /login
    //   Use passport.authenticate() as route middleware to authenticate the
    //   request.  If authentication fails, the user will be redirected back to the
    //   login page.  Otherwise, the primary route function function will be called,
    //   which, in this example, will redirect the user to the home page.
    //
    //   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
    expressApp.post('/login',
        passport.authenticate('local', { failureRedirect: options.failureRedirect, failureFlash: true }),
        function(req, res) {
            res.redirect('/');
        }
    );

    // POST /login
    //   This is an alternative implementation that uses a custom callback to
    //   acheive the same functionality.
    /*
     app.post('/login', function(req, res, next) {
     passport.authenticate('local', function(err, user, info) {
     if (err) { return next(err) }
     if (!user) {
     req.flash('error', info.message);
     return res.redirect('/login')
     }
     req.logIn(user, function(err) {
     if (err) { return next(err); }
     return res.redirect('/users/' + user.username);
     });
     })(req, res, next);
     });
     */

    expressApp.post('/register', function(req, res, next){
        var model = req.getModel()
            , sess = req.session;

        var $uname = model.query('users', {username: req.body.username, $limit: 1}),
            $currUser = model.at('users.' + sess.userId);
        model.fetch($uname, $currUser, function(err){
            if (err) return next(err)
            // current user already registered, return
            if ($currUser.get('auth.local')) return res.redirect('/');

            var userObj = $uname.get()[0];
            if (userObj) {
                // a user already registered with that name, TODO send error message
                return res.redirect(options.failureRedirect);
            } else {
                // Legit, register
                var salt = utils.makeSalt(),
                    localAuth = {
                        username: req.body.username,
                        email: req.body.email,
                        salt: salt,
                        hashed_password: utils.encryptPassword(req.body.password, salt)
                    };
                $currUser.set('auth.local', localAuth);
                $currUser.set('auth.timestamps.created', +new Date);
                req.login(sess.userId, function(err) {
                    if (err) { return next(err); }
                    return res.redirect('/');
                });
            }
        });
    });

    _.each(strategies, function(strategy, name){
        var params = strategy.params || {}
        // GET /auth/facebook
        //   Use passport.authenticate() as route middleware to authenticate the
        //   request.  The first step in Facebook authentication will involve
        //   redirecting the user to facebook.com.  After authorization, Facebook will
        //   redirect the user back to this application at /auth/facebook/callback
        expressApp.get('/auth/'+name,
            passport.authenticate(name, params),
            function(req, res){
                // The request will be redirected to Facebook for authentication, so this
                // function will not be called.
            });

        // GET /auth/facebook/callback
        //   Use passport.authenticate() as route middleware to authenticate the
        //   request.  If authentication fails, the user will be redirected back to the
        //   login page.  Otherwise, the primary route function function will be called,
        //   which, in this example, will redirect the user to the home page.
        expressApp.get('/auth/' + name + '/callback',
            passport.authenticate(name, { failureRedirect: options.failureRedirect }),
            function(req, res) {
                res.redirect('/');
            });
    });

    expressApp.get('/logout', function(req, res){
        req.session.userId = undefined;
        req.logout();
        res.redirect('/');
    });

    expressApp.post('/password-reset', function(req, res, next){
        var model = req.getModel(),
            email = req.body.email,
            salt = utils.makeSalt(),
            newPassword =  utils.makeSalt(), // use a salt as the new password too (they'll change it later)
            hashed_password = utils.encryptPassword(newPassword, salt);

        var $email = model.query('users', {'auth.local.email':email, $limit:1});
        $email.fetch(function(err){
            if (err) return next(err);
            var userObj = $email.get()[0];
            if (!userObj) return res.send(500, "Couldn't find a user registered for email " + email);

            req._isServer = true; // our bypassing of session-based accessControl
            $email.set('auth.local.salt', salt);
            $email.set('auth.local.hashed_password', hashed_password);
            sendEmail({
                from: "HabitRPG <admin@habitrpg.com>",
                to: email,
                subject: "Password Reset for HabitRPG",
                text: "Password for " + userObj.auth.local.username + " has been reset to " + newPassword + ". Log in at https://habitrpg.com",
                html: "Password for <strong>" + userObj.auth.local.username + "</strong> has been reset to <strong>" + newPassword + "</strong>. Log in at https://habitrpg.com"
            });
            return res.send('New password sent to '+ email);
        });
    })

    expressApp.post('/password-change', function(req, res, next){

        var model = req.getModel(),
            uid = req.body.uid,
            $user = model.at('users.' + uid)

        $user.fetch(function(err){
            var errMsg = "Couldn't find that user (this shouldn't be happening, contact Tyler: http://goo.gl/nrx99)",
                userObj;
            if (err || !(userObj = $user.get() )) return res.send(500, err || errMsg);

            var salt = userObj.auth.local.salt,
                hashed_old_password = utils.encryptPassword(req.body.oldPassword, salt),
                hashed_new_password = utils.encryptPassword(req.body.newPassword, salt);

            if (hashed_old_password !== userObj.auth.local.hashed_password) return res.send(500, "Old password doesn't match");

            $user.set('auth.local.hashed_password', hashed_new_password);
            return res.send(200);
        });
    })

    // Simple route middleware to ensure user is authenticated.
    //   Use this route middleware on any resource that needs to be protected.  If
    //   the request is authenticated (typically via a persistent login session),
    //   the request will proceed.  Otherwise, the user will be redirected to the
    //   login page.
    //    function ensureAuthenticated(req, res, next) {
    //        if (req.isAuthenticated()) { return next(); }
    //        res.redirect('/login')
    //    }
}

/**
 * Utility functions
 * -------------------
 */


function _loginUser(model, req, uid, done) {
    req.session.userId = uid;
    // done() sets req.user, which is later referenced to determine _session.loggedIn
    model.set('users.' + uid + '.auth.timestamps.loggedin', +new Date, function () {
      done(null, uid);
    });
}

function sendEmail(mailData) {
    // create reusable transport method (opens pool of SMTP connections)
    // TODO derby-auth isn't currently configurable here, if you need customizations please send pull request
    var smtpTransport = nodemailer.createTransport("SMTP",{
        service: process.env.SMTP_SERVICE,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // send mail with defined transport object
    smtpTransport.sendMail(mailData, function(error, response){
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }

        smtpTransport.close(); // shut down the connection pool, no more messages
    });
}
