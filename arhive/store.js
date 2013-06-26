var deepCopy = require('racer-util/object').deepCopy;

/**
 * Sets up onQuery & onChange convenience methods so we can write accessControl methods. Moved to util.js because
 * they might be moved to racer core in the future.
 */
function storeUtils(store) {
    /**
     * Assign the connect session to ShareJS's useragent (there is 1 useragent per
     * browser tab or window that is connected to our server via browserchannel).
     * We'll probably soon move this into racer core, so developers won't need to
     * remember to have this code here.
     */
    store.shareClient.use('connect', function (shareRequest, next) {
        var req = shareRequest.req;
        if (req) {
            shareRequest.agent.connectSession = req.session;
        }
        next();
    });

    /**
     * A convenience method for declaring access control on writes. For usage, see
     * the example code below (`store.onChange('users', ...`)). This may be moved
     * into racer core. We'll want to experiment to see if this particular
     * interface is sufficient, before committing this convenience method to core.
     */
    store.onChange = function (collectionName, callback) {
        this.shareClient.use('validate', function (shareRequest, next) {
            var collection = shareRequest.collection;
            if (collection !== collectionName) return next();
            var agent = shareRequest.agent;
            var action = shareRequest.action
            var docName = shareRequest.docName;
            var backend = shareRequest.backend;
            // opData represents the ShareJS operation
            var opData = shareRequest.opData;
            // snapshot is the snapshot of the data after the opData has been applied
            var snapshot = shareRequest.snapshot;

            var snapshotData = (opData.del) ?
                opData.prev.data :
                snapshot.data;

            var isServer = shareRequest.agent.stream.isServer;
            callback(docName, opData, snapshotData, agent.connectSession, isServer, next);
        });
    };
}

module.exports = function(store) {

    storeUtils(store);

    /**
     * A convenience method for declaring access control on queries. For usage, see
     * the example code below (`store.onQuery('items', ...`)). This may be moved
     * into racer core. We'll want to experiment to see if this particular
     * interface is sufficient, before committing this convenience method to core.
     */
    store.onQuery = function (collectionName, callback) {
        this.shareClient.use('query', function (shareRequest, next) {
            if (collectionName !== shareRequest.collection) return next();
            var session = shareRequest.agent.connectSession;
            shareRequest.query = deepCopy(shareRequest.query);
            callback(shareRequest.query, session, next);
        });
    };

    /**
     * Delegate to ShareJS directly to protect fetches and subscribes. Will try to
     * come up with a different interface that does not expose this much of ShareJS
     * to the developer using racer.
     */

    store.shareClient.use('subscribe', protectRead);
    store.shareClient.use('fetch', protectRead);

    function protectRead (shareRequest, next) {
        if (shareRequest.collection !== 'users') return next();
        if (shareRequest.agent.connectSession)
            if (shareRequest.docName === shareRequest.agent.connectSession.userId) return next();
        return next(new Error('Not allowed to fetch users who are not you.'));
    }

    /**
     * Only allow users to modify or delete themselves. Only allow the server to
     * create users.
     */
    store.onChange('users', function (docId, opData, snapshotData, session, isServer, next) {
        if (docId === (session && session.userId)) {
            next();
        } else if (opData.del) {
            next(new Error('Not allowed to deleted users who are not you.'));
        } else if (opData.create) {
            if (isServer) {
                next();
            } else {
                next(new Error('Not allowed to create users.'));
            }
        } else {
            next(new Error('Not allowed to update users who are not you.'));
        }
    });
};