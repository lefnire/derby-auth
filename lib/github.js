module.exports = function(everyauth, conf, ctx) {
    everyauth.github
        .appId(conf.github.appId)
        .appSecret(conf.github.appSecret)
        .findOrCreateUser( function (session, accessToken, accessTokenExtra, githubUserMetadata) {
            var model = ctx.model;

            // Put it in the session for later use
            session.auth || (session.auth = {});
            session.auth.github = githubUserMetadata.id;
            var q = model.query('users').withEveryauth('github', githubUserMetadata.id);
            model.fetch(q, function(err, user) {
                if (everyauth.debug) console.log({ err: err, githubUserMetadata: githubUserMetadata });
                var id, u;
                id = user && (u = user.get()) && u.length > 0 && u[0].id;
                // # Has user been tied to facebook account already?
                if (id && id !== session.userId) {
                    return session.userId = id;
                    // # Else tie user to their linkedin account
                } else {
                    model.setNull("users." + session.userId + ".auth", {
                        'github': {}
                    });
                    return model.set("users." + session.userId + ".auth.github", githubUserMetadata);
                }
            });
            return githubUserMetadata;
        })
        .redirectPath('/');
         /*
         .entryPath('/auth/github')
         .callbackPath('/auth/github/callback')
         .scope('repo'); // Defaults to undefined
                         // Can be set to a combination of: 'user', 'public_repo', 'repo', 'gist'
                         // For more details, see http://develop.github.com/p/oauth.html
         */
}