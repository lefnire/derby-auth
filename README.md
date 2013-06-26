# Derby.js Authentication

NOTE: Please use the [0.5 branch](https://github.com/lefnire/derby-auth/tree/0.5) if you're using Derby/Racer 0.5

Provides authentication middleware (using [Passport](http://passportjs.org/)) for use in your Derby projects.

Please use the `example` directory as boilerplate for setting up your own project, but the basics are outlined here.

###Step 1
```coffeescript
###
Setup a hash of strategies you'll use - strategy objects and their configurations
Note, API keys should be stored as environment variables (eg, process.env.FACEBOOK_KEY) or you can use nconf to store
them in config.json, which we're doing here
###
auth = require("derby-auth")
strategies =
  facebook:
    strategy: require("passport-facebook").Strategy
    conf:
      clientID: conf.get('fb:appId')
      clientSecret: conf.get('fb:appSecret')
```

###Step 1.5
```coffeescript
###
Optional parameters passed into auth.middleware(). Most of these will get sane defaults, so it's not entirely necessary
to pass in this object - but I want to show you here to give you a feel. @see derby-auth/middeware.coffee for options
###
options =
  passport:
    failureRedirect: '/'
    successRedirect: '/'
  site:
    domain: 'http://localhost:3000'
    name: 'My Site'
    email: 'admin@mysite.com'
  smtp:
    service: 'Gmail'
    user: 'admin@mysite.com'
    pass: 'abc'
```

###Step 2
```coffeescript
###
Initialize the store. This will add utility accessControl functions (see store.coffee for more details), as well
as the basic specific accessControl for the `auth` collection, which you can use as boilerplate for your own `users`
collection or what have you. The reason we need `mongo` & `strategies` is to run db.ensureIndexes() on first run,
and we may need in the future to access sensitive auth properties due to missing mongo projections feature
in Racer 0.5 (@see http://goo.gl/mloKO)
###
auth.store(store, mongo, strategies)
```

###Step 3
Make sure your express app is using sessions & body-parsing
```coffeescript
expressApp
    ...
    .use(express.cookieParser())
    .use(express.session({
        secret: conf.get('SESSION_SECRET')
        store: new MongoStore({url: mongoUrl, safe: true})
    }))
    .use(express.bodyParser())
    .use(express.methodOverride())
```

Use derby-auth's mounted middleware
```coffeescript
    ...
    # derbyAuth.middleware is inserted after modelMiddleware and before the app router to pass server accessible data to a model
    # Pass in {store} (sets up accessControl & queries), {strategies} (see above), and options
    .use(auth.middleware(strategies, options))
    ...
```

###Step 4 (optional, recommended)
If you want drop-in Login and Register forms, including form validation, use the `<derby-auth:login />` and `<derby-auth:register />` [components](http://derbyjs.com/#component_libraries). To enable these, you'll need this in your `/src/app/index.coffee` file:
```coffeescript
   app.use require("derby-auth/components/index.coffee")
```

See the [example](https://github.com/lefnire/derby-auth/tree/master/example) for more details, as well as login / registration forms, sign-in buttons, etc.

## Why not EveryAuth?
This project was originally implemented with Everyauth ([see branch](https://github.com/lefnire/derby-auth/tree/everyauth)), but had some issues:
  1. Every provider had to be implemented individually in code. Passport has an abstraction layer, which is what allows us to pass in Strategy + conf objects in server/index.js for every provider we want enabled.
  2. Password authentication posed technical difficulties. See the [Google Group discussion](https://groups.google.com/forum/?fromgroups=#!topic/derbyjs/JuUqUNd9Rls)

The [derby-examples/auth folder](https://github.com/codeparty/derby-examples/tree/master/auth), written by the creators of Derby, uses Everyauth - so if you can't get derby-auth working, you may want to give that a shot. Note, it doesn't yet implement username / password authentication.
