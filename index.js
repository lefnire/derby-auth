var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    _  = require('lodash'),
    strategyInstances = {},
    model;

/**
 * Creates middleware which provides authentication for DerbyJS
 * @param expressApp
 * @param {store} Racer store, used for configuring queries and accessControl
 * @param {conf} Authentication keys - see node_modules/everyauth/example.conf.js for format
 */
module.exports.middleware = function(expressApp, store, strategies) {
    // Setup queries & accessControl
    require('./lib/store')(store);

    // Must come first to set the model
    expressApp.use(function(req, res, next) {
        model = req.getModel();

        // New User - They get to play around before creating a new account.
        var sess = model.session;
        if (!sess.userId) {
            sess.userId = model.id();
            model.set("users." + sess.userId, {
                auth: {}
            });
        }
        return next();
    });

    // Initialize Passport!  Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    setupPassport(strategies);
    expressApp.use(passport.initialize());
    expressApp.use(passport.session());
    return function(req,res,next){ return next() }
};

/**
 * Sets up static routes for Derby app. Normally this wouldn't be necessary, would just place this logic
 * in middelware() setup. However, it breaks Derby routes - so we need this to call separately after expressApp
 * hass been initialized
 */
module.exports.routes = function(expressApp) {
    // POST /login
    //   Use passport.authenticate() as route middleware to authenticate the
    //   request.  If authentication fails, the user will be redirected back to the
    //   login page.  Otherwise, the primary route function function will be called,
    //   which, in this example, will redirect the user to the home page.
    //
    //   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
    expressApp.post('/login',
        passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
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


    _.each(strategyInstances, function(strategy, name){
        // GET /auth/facebook
        //   Use passport.authenticate() as route middleware to authenticate the
        //   request.  The first step in Facebook authentication will involve
        //   redirecting the user to facebook.com.  After authorization, Facebook will
        //   redirect the user back to this application at /auth/facebook/callback
        expressApp.get('/auth/'+name,
            passport.authenticate(name),
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
            passport.authenticate(name, { failureRedirect: '/login' }),
            function(req, res) {
                res.redirect('/');
            });
    });

    expressApp.get('/logout', function(req, res){
        req.session.userId = undefined;
        req.logout();
        res.redirect('/');
    });

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

function setupPassport(strategies) {

    // Passport session setup.
    //   To support persistent login sessions, Passport needs to be able to
    //   serialize users into and deserialize users out of the session.  Typically,
    //   this will be as simple as storing the user ID when serializing, and finding
    //   the user by ID when deserializing.
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        var q = model.query('users').withId(id);
        model.fetch(q, function(err, user) {
            console.log({ err: err, user: user.get() })
            var userObj, u;
            userObj = user && (u = user.get()) && u.length > 0 && u[0];
            if (err) return done(err);
            if (!id && !err) return done(new Error('User not found'));
            return done(null, userObj);
        });
    });

    // Use the LocalStrategy within Passport.
    //   Strategies in passport require a `verify` function, which accept
    //   credentials (in this case, a username and password), and invoke a callback
    //   with a user object.  In the real world, this would query a database;
    //   however, in this example we are using a baked-in set of users.
    passport.use(new LocalStrategy(
        function(username, password, done) {
            // asynchronous verification, for effect...
            process.nextTick(function () {

                // Find the user by username.  If there is no user with the given
                // username, or the password is not correct, set the user to `false` to
                // indicate failure and set a flash message.  Otherwise, return the
                // authenticated `user`.
                var q = model.query('users').withLogin(username, password);
                return model.fetch(q, function(err, user) {
                    console.log({ err: err, user: user.get() })
                    var userObj, u;
                    userObj = user && (u = user.get()) && u.length > 0 && u[0];
                    if (err) return done(err);
                    if (!userObj) return done(null, false, { message: 'Invalid login' });
                    return done(null, userObj);
                });
            });
        }
    ));

    _.each(strategies, function(arr){
        var strategyClass = arr[0],
            conf = arr[1];

        // Use the FacebookStrategy within Passport.
        //   Strategies in Passport require a `verify` function, which accept
        //   credentials (in this case, an accessToken, refreshToken, and Facebook
        //   profile), and invoke a callback with a user object.
        var strategy = new strategyClass(conf, function(accessToken, refreshToken, profile, done) {
                // asynchronous verification, for effect...
                process.nextTick(function () {

                    // Put it in the session for later use
                    var q = model.query('users').withEveryauth(profile.provider, profile.id);
                    model.fetch(q, function(err, user) {
                        console.log({ err: err, profile: profile, user: user.get()})
                        var userObj, u;
                        userObj = user && (u = user.get()) && u.length > 0 && u[0];
                        // # Has user been tied to facebook account already?
                        if (!userObj) {
                            model.setNull("users." + model.session.userId + ".auth", {});
                            model.set("users." + model.session.userId + ".auth." + profile.provider, profile);
                        }
                        return done(null, userObj);
                    });

                    // To keep the example simple, the user's Facebook profile is returned to
                    // represent the logged-in user.  In a typical application, you would want
                    // to associate the Facebook account with a user record in your database,
                    // and return that user instead.
//                    return done(null, profile);
                });
            }
        )
        passport.use(strategy);
        strategyInstances[strategy.name] = strategy; // keep around for reference by routes()
    });
};
