module.exports = function(store) {
    setupQueries(store);
    setupAccessControl(store);
}

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