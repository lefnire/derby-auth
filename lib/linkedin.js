module.exports = function(everyauth, conf, ctx){
    everyauth.linkedin
        .consumerKey(conf.linkedin.apiKey)
        .consumerSecret(conf.linkedin.apiSecret)
        .findOrCreateUser( function (session, accessToken, accessTokenSecret, linkedinUserMetadata) {
            // find or create user logic goes here
        })
//        .entryPath('/auth/linkedin')
//        .callbackPath('/auth/linkedin/callback');
        .redirectPath('/');
}