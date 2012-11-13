var everyauth = require('everyauth'),
    _  = require('lodash'),
    ctx = {
        model:undefined
    }; // Keep context variables around for ./lib modules as pseudo-closure, they're set in middleware

/**
 * Creates middleware which provides authentication for DerbyJS
 * @param expressApp
 * @param {store} Racer store, used for configuring queries and accessControl
 * @param {conf} Authentication keys - see node_modules/everyauth/example.conf.js for format
 */
module.exports.middleware = function(expressApp, store, conf) {
    // Setup store
    setupQueries(store);
    setupAccessControl(store);

    // User passes in auth configuration keys originally. Provide defaults for ones not provided
    conf = conf || {};
    _.defaults(conf, require('everyauth/example/conf'));
    setupEveryauth(conf);

    expressApp.use(function(req, res, next) {
        var model = ctx.model = req.getModel();

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
    return everyauth.middleware();
};

setupQueries = function(store) {
    store.query.expose('users', 'withId', function(id) {
        return this.byId(id);
    });
    store.query.expose('users', 'withEveryauth', function(provider, id, password) {
        if (password == null) {
            password = null;
        }
        if (everyauth.debug) console.log({ withEveryauth: { provider: provider, id: id, password: password } });
        if (password) {
            return this.where("auth." + provider + ".id").equals(id).where("auth." + provider + ".password").equals(password);
        } else {
            return this.where("auth." + provider + ".id").equals(id);
        }
    });
    return store.queryAccess('users', 'withEveryauth', function(methodArgs) {
        var accept;
        accept = arguments[arguments.length - 1];
        return accept(true); // for now
    });
};

setupAccessControl = function(store) {
    store.accessControl = true;

    //Callback(signatures(here(have(variable(length, eg(callback(captures..., next)))))));
    //Is(using(arguments[n](the(correct(way(to(handle(typeof this !== "undefined" && this !== null))))))));

    store.readPathAccess('users.*', function() { // captures, next) ->
        var captures, next;
        if (!(this.session && this.session.userId)) {
            return; // https://github.com/codeparty/racer/issues/37
        }
        captures = arguments[0];
        next = arguments[arguments.length - 1];
        return next(captures === this.session.userId);
    });
    return store.writeAccess('*', 'users.*', function() { // captures, value, next) ->
        var captures, next, pathArray;
        if (!(this.session && this.session.userId)) {
            return;
        }
        captures = arguments[0];
        next = arguments[arguments.length - 1];
        pathArray = captures.split('.');
        return next(pathArray[0] === this.session.userId);
    });
};

// Working on a hack to get password.js to play nicely with everyauth
/*function setupExpress(expressApp) {
    return expressApp.engine('html', (function() {
        var cache;
        cache = {};
        return function(path, options, cb) {
            var str;
            try {
                str = cache[path] || (cache[path] = fs.readFileSync(path, 'utf8'));
                return cb(null, str);
            } catch (err) {
                return cb(err);
            }
        };
    })());
};*/

function setupEveryauth(conf) {
    everyauth.debug = true;
    everyauth.everymodule.findUserById(function(id, callback) {
        // will never be called, can't fetch user from database at this point on the server
        // see https://github.com/codeparty/racer/issues/39. Handled in app/auth.coffee for now
        return callback(null, null);
    });

    require('./lib/facebook')(everyauth, conf, ctx);
    require('./lib/linkedin')(everyauth, conf, ctx);
    require('./lib/github')(everyauth, conf, ctx);
    require('./lib/password')(everyauth, conf, ctx);

    everyauth.everymodule.handleLogout(function(req, res) {
        if (req.session.auth && req.session.auth.facebook) {
            req.session.auth.facebook = void 0;
        }
        req.session.userId = void 0;
        req.logout(); // The logout method is added for you by everyauth, too
        return this.redirect(res, this.logoutRedirectPath());
    });
};
