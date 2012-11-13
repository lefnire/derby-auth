module.exports = function(everyauth, request) {
    everyauth.facebook
        .appId(process.env.FACEBOOK_KEY)
        .appSecret(process.env.FACEBOOK_SECRET)
        .findOrCreateUser(function(session, accessToken, accessTokenExtra, fbUserMetadata) {
            var model = request.model;

            // Put it in the session for later use
            session.auth || (session.auth = {});
            session.auth.facebook = fbUserMetadata.id;
            var q = model.query('users').withEveryauth('facebook', fbUserMetadata.id);
            model.fetch(q, function(err, user) {
                var id, u;
                console.log({
                    err: err,
                    fbUserMetadata: fbUserMetadata
                });
                id = user && (u = user.get()) && u.length > 0 && u[0].id;
                // # Has user been tied to facebook account already?
                if (id && id !== session.userId) {
                    return session.userId = id;
                    // # Else tie user to their facebook account
                } else {
                    model.setNull("users." + session.userId + ".auth", {
                        'facebook': {}
                    });
                    return model.set("users." + session.userId + ".auth.facebook", fbUserMetadata);
                }
            });
            return fbUserMetadata;
        }).redirectPath("/");
}