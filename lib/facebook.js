module.exports = function(everyauth, conf, ctx) {
    everyauth.facebook
        .appId(conf.fb.appId)
        .appSecret(conf.fb.appSecret)
        .findOrCreateUser(function(session, accessToken, accessTokenExtra, fbUserMetadata) {
            var model = ctx.model;

            // Put it in the session for later use
            session.auth || (session.auth = {});
            session.auth.facebook = fbUserMetadata.id;
            var q = model.query('users').withEveryauth('facebook', fbUserMetadata.id);
            model.fetch(q, function(err, user) {
                if (everyauth.debug) console.log({ err: err, fbUserMetadata: fbUserMetadata });
                var id, u;
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