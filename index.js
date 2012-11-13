var everyauth = require('everyauth'),
    request = {
        req:undefined,
        model:undefined,
        session:undefined
    }; // Keep context variables around for ./lib modules as pseudo-closure, they're set in middleware

module.exports.middleware = function(expressApp, store) {
    setupQueries(store);
    setupAccessControl(store);
    setupEveryauth();
    expressApp.use(function(req, res, next) {
        request.req = req;
        request.model = req.getModel();
        newUser();
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
        console.log({
            withEveryauth: {
                provider: provider,
                id: id,
                password: password
            }
        });
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

/**
 * -------- New user --------
 * They get to play around before creating a new account.
 */
function newUser() {
    var model = request.model, sess = model.session;
    if (!sess.userId) {
        sess.userId = model.id();
        return model.set("users." + sess.userId, {
            auth: {}
        });
    }
};

// Working on a hack to get password.js to play nicely with everyauth
function setupExpress(expressApp) {
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
};

function setupEveryauth() {
    everyauth.debug = true;
    everyauth.everymodule.findUserById(function(id, callback) {
        // will never be called, can't fetch user from database at this point on the server
        // see https://github.com/codeparty/racer/issues/39. Handled in app/auth.coffee for now
        return callback(null, null);
    });

    require('./lib/facebook')(everyauth, request);
    require('./lib/password')(everyauth, request);

    everyauth.everymodule.handleLogout(function(req, res) {
        if (req.session.auth && req.session.auth.facebook) {
            req.session.auth.facebook = void 0;
        }
        req.session.userId = void 0;
        req.logout(); // The logout method is added for you by everyauth, too
        return this.redirect(res, this.logoutRedirectPath());
    });
};
