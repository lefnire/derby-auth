var http = require('http')
  , path = require('path')
  , express = require('express')
  , gzippo = require('gzippo')
  , derby = require('derby')
  , app = require('../auth')
  , serverError = require('./serverError')
  , MongoStore = require('connect-mongo')(express)
  , dbUri = 'mongodb://localhost/derby-auth'

var expressApp = express(),
    server = http.createServer(expressApp)

derby.use(require('racer-db-mongo'));
var store = derby.createStore({
  db: { type: 'Mongo', uri: dbUri },
  listen: server
});

module.exports = server

var ONE_YEAR = 1000 * 60 * 60 * 24 * 365
    , root = path.dirname(path.dirname(__dirname))
    , publicPath = path.join(root, 'public')

/**
 * (1)
 * Setup a hash of strategies you'll use - strategy objects and their configurations
 * Note, API keys should be stored as environment variables (eg, process.env.FACEBOOK_KEY, process.env.FACEBOOK_SECRET)
 * rather than a configuration file. We're storing it in conf.js for demo purposes.
 */
var
    // change to `require('derby-auth')` in your project
    auth = require('../../../index')

  , keys = require('./conf')

  , strategies = {
      facebook: {
        strategy: require('passport-facebook').Strategy,
        conf: {
          clientID: process.env.FACEBOOK_KEY || keys.fb.appId,
          clientSecret: process.env.FACEBOOK_SECRET || keys.fb.appSecret
        }
      },
      linkedin: {
        strategy: require('passport-linkedin').Strategy,
        conf: {
          consumerKey: process.env.LINKEDIN_API_KEY || keys.linkedin.apiKey,
          consumerSecret: process.env.LINKEDIN_SECRET_KEY || keys.linkedin.apiSecret
        }
      },
      github: {
        strategy: require('passport-github').Strategy,
        conf: {
          clientID: process.env.GITHUB_CLIENT_ID || keys.github.appId,
          clientSecret: process.env.GITHUB_CLIENT_SECRET || keys.github.appSecret,
          callbackURL: "http://127.0.0.1:3000/auth/github/callback"
        }
      },
      twitter: {
        strategy: require('passport-twitter').Strategy,
        conf: {
          consumerKey: process.env.TWITTER_CONSUMER_KEY || keys.twit.consumerKey,
          consumerSecret: process.env.TWITTER_CONSUMER_SECRET || keys.twit.consumerSecret,
          // You can optionally pass in per-strategy configuration options (consult Passport documentation)
          callbackURL: "http://127.0.0.1:3000/auth/twitter/callback"
        }
      }
    }

    // optional parameters passed into derby-auth.init, domain is required due to some Passport technicalities,
    // allowPurl lets people access non-authenticated accounts at /:uuid, and schema sets up default user
    // account schema structures
  , options = { domain: 'http://localhost:3000' }
  ;

expressApp
    .use(express.favicon())
    .use(gzippo.staticGzip(publicPath, {maxAge: ONE_YEAR}))
    .use(express.compress()).use(express.bodyParser())
    .use(express.methodOverride())
    .use(express.cookieParser())
    .use(store.sessionMiddleware({
        secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE',
        cookie: {maxAge: ONE_YEAR},
        store: new MongoStore({ url: dbUri })
    }))
    .use(store.modelMiddleware())

    /**
     * (2)
     * derbyAuth.middleware is inserted after modelMiddleware and before the app router to pass server accessible data to a model
     * Pass in {store} (sets up accessControl & queries), {strategies} (see above), and options
     */
    .use(auth(store, strategies, options))

    .use(app.router())
    .use(expressApp.router)
    .use(serverError(root)
);

expressApp.all('*', function(req) {
  throw "404: " + req.url;
});
