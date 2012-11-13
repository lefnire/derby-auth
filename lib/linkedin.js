module.exports = function(everyauth, conf, ctx){
    everyauth.linkedin
        .consumerKey(conf.linkedin.apiKey)
        .consumerSecret(conf.linkedin.apiSecret)
        .findOrCreateUser( function (session, accessToken, accessTokenSecret, linkedinUserMetadata) {
            var model = ctx.model;

            // Put it in the session for later use
            session.auth || (session.auth = {});
            session.auth.linkedin = linkedinUserMetadata.id;
            var q = model.query('users').withEveryauth('linkedin', linkedinUserMetadata.id);
            model.fetch(q, function(err, user) {
                if (everyauth.debug) console.log({ err: err, linkedinUserMetadata: linkedinUserMetadata });
                var id, u;
                id = user && (u = user.get()) && u.length > 0 && u[0].id;
                // # Has user been tied to facebook account already?
                if (id && id !== session.userId) {
                    return session.userId = id;
                    // # Else tie user to their facebook account
                } else {
                    model.setNull("users." + session.userId + ".auth", {
                        'linkedin': {}
                    });
                    return model.set("users." + session.userId + ".auth.linkedin", linkedinUserMetadata);
                }
            });
            return linkedinUserMetadata;
        })
//        .entryPath('/auth/linkedin')
//        .callbackPath('/auth/linkedin/callback');
        .redirectPath('/');
}