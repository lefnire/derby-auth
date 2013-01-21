var passport = require('passport')
    , LocalStrategy = require('passport-local').Strategy
    , flash = require('connect-flash') // used for setting error messages
    , _  = require('lodash')
    , expressApp = require('express')()
    , setupStore = require('./store')
    , utils = require('./utils')
  ;

/**
 * Provides "mounted" (sub-app) middleware which provides authentication for DerbyJS
 * @param {store} Racer store, used for configuring queries and accessControl
 * @param {strategies} A hash of strategy objects and their configurations. See https://github.com/lefnire/derby-examples/blob/master/authentication/src/server/index.coffee
 * @param {options} TODO document this
 */
module.exports = function(store, strategies, options) {

    // Setup queries & accessControl
    setupStore(store);

    // Setup default options
    _.defaults(options, {
        failureRedirect: '/',
        domain: "http://localhost:3000",
        schema: {},
        allowPurl: false
    });

    expressApp.use(flash());

    // Must be called before passport middleware so they have access to model
    expressApp.use(setupMiddleware(strategies, options));

    // Initialize Passport.  Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    expressApp.use(passport.initialize());
    expressApp.use(passport.session());

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
        var model = req.getModel()
            , sess = model.session;

        model.set('_loggedIn', sess.passport && sess.passport.user);

        // set any error / success messages
        model.set('_flash', req.flash());

        // New User - They get to play around before creating a new account.
        if (!sess.userId) {
            sess.userId = model.id();
            var schema = _.cloneDeep(options.schema);
            _.defaults(schema, {auth:{}}); // make sure user schema is defaulted with at least {auth:{}}
            model.set("users." + sess.userId, schema);
        }

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
            function(username, password, done) {
                // Find the user by username.  If there is no user with the given
                // username, or the password is not correct, set the user to `false` to
                // indicate failure and set a flash message.  Otherwise, return the
                // authenticated `user`.
                var q = model.query('users').withUsername(username);
                _fetchUser(q, model, function(err, userObj){
                    if (err && err.notFound) return done(null, false, err);// user not found
                    if (err) return done(err); // real error

                    if(process.env.NODE_ENV==='development') console.log(userObj);
                    q = model.query('users').withLogin(username, utils.encryptPassword(password, userObj.auth.local.salt));
                    _fetchUser(q, model, function(err, userObj){
                        if (err && err.notFound) return done(null, false, err);// user not found
                        if (err) return done(err); // real error
                        _loginUser(model, userObj, done);
                    });
                });
            }
        ));

        _.each(strategies, function(obj, name){

            // Provide default values for options not passed in
            // TODO pass in as conf URL variable
            _.defaults(obj.conf, {callbackURL: options.domain + "/auth/" + name + "/callback"});

            // Use the FacebookStrategy within Passport.
            //   Strategies in Passport require a `verify` function, which accept
            //   credentials (in this case, an accessToken, refreshToken, and Facebook
            //   profile), and invoke a callback with a user object.
            passport.use(new obj.strategy(obj.conf, function(accessToken, refreshToken, profile, done) {
                    // To keep the example simple, the user's Facebook profile is returned to
                    // represent the logged-in user.  In a typical application, you would want
                    // to associate the Facebook account with a user record in your database,
                    // and return that user instead.
                    var q = model.query('users').withProvider(profile.provider, profile.id);
                    _fetchUser(q, model, function(err, userObj){
                        if (err && !err.notFound) return done(err);

                        // User exists, but hasn't yet been associated with social network
                        if(err && err.notFound) {
                            var userPath = "users." + model.session.userId;
                            model.set(userPath + '.auth.' + profile.provider, profile);
                            model.set(userPath + '.auth.timestamps.created', new Date());
                            userObj = model.get(userPath);
                        }
                        _loginUser(model, userObj, done);
                    });
                }
            ));
        });

        return next();
    }
}

/**
 * Routes (Including Passport Routes)
 * --------------------
 * Sets up static routes for Derby app. Normally this wouldn't be necessary, would just place this logic
 * in middelware() setup. However, it breaks Derby routes - so we need this to call separately after expressApp
 * hass been initialized
 */
function setupStaticRoutes(expressApp, strategies, options) {

    // Persistent URLs (PURLs) (eg, http://localhost/users/{guid})
    // tests if UUID was used (bookmarked private url), and restores that session
    // Workflowy uses this method, for example
    expressApp.get('/users/:uid', function(req, res, next) {
        if (!options.allowPurl) return next();

        var uid = req.params.uid,
            sess = req.getModel().session;

        // if not already logged in , and is legit uid
        if ((sess.userId !== uid) && !sess.loggedIn && (require('guid').isGuid(uid))) {
            // TODO check if in database - issue with accessControl which is on current uid
            sess.userId = uid;
        }
        return res.redirect('/');
    });

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
            , sess = model.session;

        var q = model.query('users').withUsername(req.body.username);
        _fetchUser(q, model, function(err, userObj){
            if (err && !err.notFound) return next(err);

            // current user already registered, return
            if (model.get('users.' + sess.userId + '.auth.local')) return res.redirect('/');

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
                model.set('users.' + sess.userId + '.auth.local', localAuth);
                model.set('users.' + sess.userId + '.auth.timestamps.created', new Date());
                req.login(sess.userId, function(err) {
                    if (err) { return next(err); }
                    return res.redirect('/');
                });
            }
        });
    });

    _.each(strategies, function(strategy, name){
        params = strategy.params || {}
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

    expressApp.post('/password-reset', function(req, res){
        var model = req.getModel(),
            email = req.body.email,
            salt = utils.makeSalt(),
            newPassword =  utils.makeSalt(), // use a salt as the new password too (they'll change it later)
            hashed_password = utils.encryptPassword(newPassword, salt);

        model.fetch(model.query('users').withEmail(email), function(err, users){
            if (!err && !(users.get()[0])) err = "Somethign went wrong resetting password for " + email + ". Couldn't find user for some reason.";
            if (err) {
                console.log(err);
                return res.send(500, e);
            }

            // we use mongoskin to bypass racer's accessConrol settings where we're authorized.
            // TODO come up with a different accessControl approach, this shouldn't be necessary
            var mongo = require('mongoskin');
            mongo.db(model.store._db.options.uri).collection('users').update(
                {"auth.local.email": email},
                {$set: {'auth.local.salt': salt, 'auth.local.hashed_password': hashed_password} },
                function (err, items) {
                    console.dir({err:err, items:items});
                    if (err) return res.send(500, err);
                    sendEmail({
                        from: "HabitRPG <admin@habitrpg.com>",
                        to: email,
                        subject: "Password Reset for HabitRPG",
                        text: "Your new password is " + newPassword + ". You an login at https://habitrpg.com"
                    });
                    return res.send('New password sent to '+ email);
            })

        })

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

function _fetchUser(query, model, callback){
    model.fetch(query, function(err, users) {
        // There was a real, server-crashing error
        if (err) return callback(err);

        // Fetch the user
        var userObj, u;
        userObj = users && (u = users.get()) && u.length > 0 && u[0];
        if (process.env.NODE_ENV!=='production') console.log({err:err, user:userObj});

        // If no user found, return an object which can be used for sending a flash error message
        if (!userObj) return callback({notFound:true, message:'Invalid Login.'});

        // User was found, return it
        return callback(null, userObj);
    });
}

function _loginUser(model, userObj, done) {
    model.session.userId = userObj.id;
    model.set('users.' + userObj.id + '.auth.timestamps.loggedin', new Date());
    // done() sets req.user, which is later referenced to determine _loggedIn
    if (done) done(null, userObj.id);
}

function sendEmail(mailData) {
    var nodemailer = require("nodemailer");

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
