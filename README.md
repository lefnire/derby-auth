# Derby.js Authentication

Provides authentication middleware (using [Passport](http://passportjs.org/)) for use in your Derby projects.

###Step 1
Initialize derby-auth above `expressApp.use()` directives.
```javascript
var
    // Pass in actual Passport Strategy objects as well as their configurations (see http://passportjs.org/guide/facebook/)
    // Note: this means you'd need "passport-facebook" in your package.json file
    strategies = {
      facebook: {
        strategy: require('passport-facebook').Strategy,
        conf: { clientID: process.env.FACEBOOK_KEY, clientSecret: process.env.FACEBOOK_SECRET }
    },

    auth = require('derby-auth'),

    // Pass in options. Domain defaults to localhost:3000, but consider this required - you'll probably test something
    options = {
        domain: (process.env.NODE_ENV==='production ? "http://my.com" : "http://localhost:3000" )
    }

// Init. {expressApp} sets up routes, {store} sets up accessControl & queries
derbyAuth.init(expressApp, store, strategies, options);
```
###Step 2
Use derby-auth's middleware
```javascript
.use(store.modelMiddleware())
// derbyAuth.middleware is inserted after modelMiddleware and before the app router to pass server accessible data to a model
.use(derbyAuth.middleware())
.use(app.router())
```
###Step 3
User derby-auth's routes
```javascript
derbyAuth.routes();
```

See the [example](https://github.com/lefnire/derby-auth/tree/master/example) for more details, as well as login / registration forms, sign-in buttons, etc.

## Why not EveryAuth?
This project was originally implemented with Everyauth ([see branch](https://github.com/lefnire/derby-auth/tree/everyauth)), but had some issues:
  1. Every provider had to be implemented individually in code. Passport has an abstraction layer, which is what allows us to pass in Strategy + conf objects in server/index.js for every provider we want enabled.
  2. Password authentication posed technical difficulties. See the [Google Group discussion](https://groups.google.com/forum/?fromgroups=#!topic/derbyjs/JuUqUNd9Rls)