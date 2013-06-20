# Derby.js Authentication

NOTE: This 0.5 upgrade is a WIP, and may not be stable.

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
Initialize the Store. `auth.store.init` will add some required helper functions (see the code for details), and `auth.store.basicUserAccess` will add default access-control on the 'users' colleciton. This is likely not what you want, it's just there as a starting point and an example - so more than likely you'll exclude that line and replace with your own accessControl function.
```javascript
auth.store.init(store);
auth.store.basicUserAccess(store); // replace this with your own accessControl logic eventually
```

###Step 3
Make sure your express app is using sessions (obviously) & body-parsing (for form-data)
```javascript
# Uncomment and supply secret to add Derby session handling
# Derby session middleware creates req.session and socket.io sessions
.use(express.cookieParser())
.use(store.sessionMiddleware
  secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
  cookie: {maxAge: ONE_YEAR}
)
.use(express.bodyParser())
```

Use derby-auth's mounted middleware
```javascript
.use(store.modelMiddleware())
// derby-auth.middleware is inserted after modelMiddleware and before the app router to pass server accessible data to a model
.use(auth.middleware(strategies, options))
.use(app.router())
```

###Step 4 (optional, recommended)
If you want drop-in Login and Register forms, including form validation, use the `<derby-auth:login />` and `<derby-auth:register />` [components](http://derbyjs.com/#component_libraries). To enable these, you'll need this in your `/lib/app/index.js` file:
```javascript
   derby.use(require('derby-auth/components'));
```

See the [example](https://github.com/lefnire/derby-auth/tree/master/example) for more details, as well as login / registration forms, sign-in buttons, etc.

## Why not EveryAuth?
This project was originally implemented with Everyauth ([see branch](https://github.com/lefnire/derby-auth/tree/everyauth)), but had some issues:
  1. Every provider had to be implemented individually in code. Passport has an abstraction layer, which is what allows us to pass in Strategy + conf objects in server/index.js for every provider we want enabled.
  2. Password authentication posed technical difficulties. See the [Google Group discussion](https://groups.google.com/forum/?fromgroups=#!topic/derbyjs/JuUqUNd9Rls)