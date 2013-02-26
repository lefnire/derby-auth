/**
 * FIXME https://github.com/codeparty/racer/issues/37
 */
function bustedSession(guard) {
    return (!guard || !guard.session || !guard.session.userId) && !isServer(guard);
}
var SESSION_INVALIDATED_ERROR = 'Session invalidated in accessControl callback';
var isServer = function(guard) {
    return (!!guard.session && !!guard.session.req && guard.session.req._isServer);
}

var setupQueries = function(store) {

    /**
     * Main function for subscribing to user query
     */
    store.query.expose('users', 'withId', function(id) {
        return this
            .where('id')
            .equals(id)
            //.except('auth.local.hashed_password')
            .findOne();
    });
    store.queryAccess('users', 'withId', function(id, accept, err) {
//        if (bustedSession(this)) return err(SESSION_INVALIDATED_ERROR);
        if (bustedSession(this)) return accept(false);
        accept(id === this.session.userId);
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
            .except('auth.local.hashed_password')
            .findOne();
    });
    store.queryAccess('users', 'withUsername', function(username, accept, err) {
        return accept(true); // for now
    });

    /**
     * Find by email
     */
    store.query.expose('users', 'withEmail', function(email) {
        return this
            .where('auth.local.email')
            .equals(email)
            .only(['auth.local.email', 'auth.local.username'])
            .findOne();
    });
    store.queryAccess('users', 'withEmail', function(email, accept, err) {
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
            .equals(hashed_password)
            .findOne();

        // With this enabled, the query finds 0 results. I'm assuming where('..password') and only('..username') conflict.
        // It's ok, they'd have to know both uname & pw to hack this query anyway.
        //.only('auth.local.username').limit(1);
    });
    store.queryAccess('users', 'withLogin', function(username, hashed_password, accept, err) {
        return accept(true); // for now
    });

    /**
     * Find by social network
     */
    store.query.expose('users', 'withProvider', function(provider, id) {
        return this
            .where("auth." + provider + ".id")
            .equals(id)
            .only("auth." + provider + ".id")
            .findOne();
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
var setupAccessControl = function(store) {

    //Callback signatures here have variable length, eg callback(captures..., next);
    //Is using arguments[n] the correct way to handle (typeof this !== "undefined" && this !== null);

    store.readPathAccess('users.*', function() { // captures, next) ->
        var accept = arguments[arguments.length - 2],
            err = arguments[arguments.length -1];

//        if (bustedSession(this)) return err(SESSION_INVALIDATED_ERROR);
        if (bustedSession(this)) return accept(false);

        var captures = arguments[0],
            sameSession = (captures === this.session.userId),
            isServer = false;//!this.req.socket; //TODO how to determine if request came from server, as in REST?
        return accept(sameSession || isServer);
    });

    store.writeAccess('*', 'users.*', function() { // captures, value, next) ->
        var accept = arguments[arguments.length - 2],
            err = arguments[arguments.length -1];

//        if (bustedSession(this)) return err(SESSION_INVALIDATED_ERROR);
        if (bustedSession(this)) return accept(false);

        var captures = arguments[0],
            sameSession = (captures.split('.')[0] === this.session.userId),
            isServer = false;//!this.req.socket;
        return accept(sameSession || isServer);
    });

};

module.exports = function(store, customAccessControl) {
    store.accessControl.readPath = true;
    store.accessControl.query    = true;
    store.accessControl.write    = true;

    setupQueries(store);

    if(!!customAccessControl) {
        customAccessControl(store);
    } else {
        setupAccessControl(store);
    }
};
module.exports.SESSION_INVALIDATED_ERROR = SESSION_INVALIDATED_ERROR;
module.exports.bustedSession = bustedSession;
module.exports.isServer = isServer;
