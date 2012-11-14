module.exports = function(store) {
    setupQueries(store);
    setupAccessControl(store);
}

setupQueries = function(store) {
    store.query.expose('users', 'withId', function(id) {
        return this.byId(id);
    });
    store.queryAccess('users', 'withId', function(methodArgs) {
        var accept = arguments[arguments.length - 1];
        return accept(true); // for now
    });

    store.query.expose('users', 'withUsername', function(username) {
        return this.where('auth.local.username').equals(username);
    });
    store.queryAccess('users', 'withUsername', function(methodArgs) {
        var accept = arguments[arguments.length - 1];
        return accept(true); // for now
    });

    store.query.expose('users', 'withLogin', function(username, password) {
        return this.where('auth.local.username').equals(username).where('auth.local.password').equals(password);
    });
    store.queryAccess('users', 'withLogin', function(methodArgs) {
        var accept = arguments[arguments.length - 1];
        return accept(true); // for now
    });

    store.query.expose('users', 'withProvider', function(provider, id) {
        return this.where("auth." + provider + ".id").equals(id);
    });
    store.queryAccess('users', 'withProvider', function(methodArgs) {
        var accept = arguments[arguments.length - 1];
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