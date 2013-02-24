# Derby.js Authentication

Provides authentication middleware (using [Passport](http://passportjs.org/)) for use in your Derby projects.

###Step 1
Setup derby-auth strategies and configurations
```javascript
var
    auth = require('derby-auth'),

    // Pass in actual Passport Strategy objects as well as their configurations (see http://passportjs.org/guide/facebook/)
    // Note: this means you'd need "passport-facebook" in your package.json file
    strategies = {
      facebook: {
        strategy: require('passport-facebook').Strategy,
        conf: { clientID: process.env.FACEBOOK_KEY, clientSecret: process.env.FACEBOOK_SECRET }
    },

    // Pass in options. Domain defaults to localhost:3000, but consider it required
    // (It's a Passport technicality, if anyone has suggestions for determining domain on run-time, please message me)
    options = {
        domain: (process.env.NODE_ENV==='production' ? "http://my.com" : "http://localhost:3000" )
    }
```

###Step 2
Initialize the Store (queries, accessControl, etc)
```javascript
// initialize queries and accessControl
auth.store(store);
```

###Step 3
Use derby-auth's mounted middleware
```javascript
.use(store.modelMiddleware())
// derby-auth.middleware is inserted after modelMiddleware and before the app router to pass server accessible data to a model
.use(auth.middleware(strategies, options))
.use(app.router())
```

Also, *make sure* your express app is using sessions:
```javascript
# Uncomment and supply secret to add Derby session handling
# Derby session middleware creates req.session and socket.io sessions
.use(express.cookieParser())
.use(store.sessionMiddleware
  secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
  cookie: {maxAge: ONE_YEAR}
)
```

And finaly, we need to add form data parsing support:
```javascript
// Uncomment to add form data parsing support
.use(express.bodyParser())
```

###Step 4 (optional, recommended)
If you want drop-in Login and Register forms, including form validation, use the `<derby-auth:login />` and `<derby-auth:register />` [components](http://derbyjs.com/#component_libraries). To enable these, you'll need this in your `/lib/app/index.js` file:
```javascript
   derby.use(require('derby-auth/components'));
```

See the [example](https://github.com/lefnire/derby-auth/tree/master/example) for more details, as well as login / registration forms, sign-in buttons, etc.

## Roadmap
See my [Workflowy](https://workflowy.com/shared/2a5229b2-64b1-8f5c-e649-4b61c0a1e32a/)

## Why not EveryAuth?
This project was originally implemented with Everyauth ([see branch](https://github.com/lefnire/derby-auth/tree/everyauth)), but had some issues:
  1. Every provider had to be implemented individually in code. Passport has an abstraction layer, which is what allows us to pass in Strategy + conf objects in server/index.js for every provider we want enabled.
  2. Password authentication posed technical difficulties. See the [Google Group discussion](https://groups.google.com/forum/?fromgroups=#!topic/derbyjs/JuUqUNd9Rls)