

var setupQueries = function(store, customAcessControl) {

    /**
     * Main function for subscribing to user query
     */
    store.query.expose('users', 'withId', function(id) {
        return this
            .where('id')
            .equals(id)
            //.except('auth.local.hashed_password')
            .limit(1);
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
    store.queryAccess('users', 'withUsername', function(role,accept,err) {
        consol
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
    store.queryAccess('users', 'withEmail', function(role,accept,err) {
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
    store.queryAccess('users', 'withLogin', function(username,hashed_password,accept,err) {
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
    store.queryAccess('users', 'withProvider', function(provider, id, accept, err) {
        return accept(true); // for now
    });
};


/**
 * Setup read / write access
 * @param store
 * @param {customAccessControl} allows you to setup your own readPathAccess and writeAccess. If not passed in,
 *  the default of "user can only read and write anything to self" use used
 */
var setupAccessControl = function(store, customAccessControl) {
    store.accessControl = true;

    if(!!customAccessControl) {
        customAccessControl(store);
    } else {
        //Callback signatures here have variable length, eg callback(captures..., next);
        //Is using arguments[n] the correct way to handle (typeof this !== "undefined" && this !== null);

        store.readPathAccess('users.*', function() { // captures, next) ->
            if (!(this.session && this.session.userId)) {
                return; // https://github.com/codeparty/racer/issues/37
            }
            var captures = arguments[0],
                next = arguments[arguments.length - 1],
                sameSession = captures === this.session.userId,
                isServer = false;//!this.req.socket; //TODO how to determine if request came from server, as in REST?
            return next(sameSession || isServer);
        });

        store.writeAccess('*', 'users.*', function() { // captures, value, next) ->
            if (!(this.session && this.session.userId)) {
                return; // https://github.com/codeparty/racer/issues/37
            }
            var captures = arguments[0],
                next = arguments[arguments.length - 1],
                sameSession = captures.split('.')[0] === this.session.userId,
                isServer = false;//!this.req.socket;
            return next(sameSession || isServer);
        });
    }

};

module.exports = function(store, customAccessControl) {
    setupQueries(store);
    setupAccessControl(store, customAccessControl);
};