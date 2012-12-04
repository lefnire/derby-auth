

var setupQueries = function(store) {

    /**
     * Main function for subscribing to user query
     */
    store.query.expose('users', 'withId', function(id) {
        return this
            .byId(id)
            .except('auth.local.hashed_password').limit(1);
    });
    store.queryAccess('users', 'withId', function(id, next) {
        if (!(this.session && this.session.userId)) {
            return next(false); // https://github.com/codeparty/racer/issues/37
        }
        return next(id === this.session.userId);
    });

    // Functions for finding if user exists with given criteria
    // ----------------------

    /**
     * Find by username
     */
    store.query.expose('users', 'withUsername', function(username) {
        return this
            .where('auth.local.username')
            .equals(username)
            .except('auth.local.hashed_password').limit(1);
    });
    store.queryAccess('users', 'withUsername', function(methodArgs) {
        var accept = arguments[arguments.length - 1];
        return accept(true); // for now
    });

    /**
     * Find by email
     */
    store.query.expose('users', 'withEmail', function(email) {
        return this
            .where('auth.local.email')
            .equals(email)
            .only('auth.local.email').limit(1);
    });
    store.queryAccess('users', 'withEmail', function(methodArgs) {
        var accept = arguments[arguments.length - 1];
        return accept(true); // for now
    });

    /**
     * Find by username and password
     */
    store.query.expose('users', 'withLogin', function(username, hashed_password) {
        return this
            .where('auth.local.username')
            .equals(username)
            .where('auth.local.hashed_password')
            .equals(hashed_password);

            // With this enabled, the query finds 0 results. I'm assuming where('..password') and only('..username') conflict.
            // It's ok, they'd have to know both uname & pw to hack this query anyway.
            //.only('auth.local.username').limit(1);
    });
    store.queryAccess('users', 'withLogin', function(methodArgs) {
        var accept = arguments[arguments.length - 1];
        return accept(true); // for now
    });

    /**
     * Find by social network
     */
    store.query.expose('users', 'withProvider', function(provider, id) {
        return this
            .where("auth." + provider + ".id")
            .equals(id)
            .only("auth." + provider + ".id").limit(1);
    });
    store.queryAccess('users', 'withProvider', function(methodArgs) {
        var accept = arguments[arguments.length - 1];
        return accept(true); // for now
    });
};


/**
 * Setup read / write access
 * @param store
 */
var setupAccessControl = function(store) {
    store.accessControl = true;

    //Callback signatures here have variable length, eg callback(captures..., next);
    //Is using arguments[n] the correct way to handle (typeof this !== "undefined" && this !== null);

    store.readPathAccess('users.*', function() { // captures, next) ->
        var captures, next;
        if (!(this.session && this.session.userId)) {
            return; // https://github.com/codeparty/racer/issues/37
        }
        captures = arguments[0];
        next = arguments[arguments.length - 1];
        return next(captures === this.session.userId);
    });

    store.writeAccess('*', 'users.*', function() { // captures, value, next) ->
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

module.exports = function(store) {
    setupQueries(store);
    setupAccessControl(store);
};