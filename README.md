# Derby.js Authentication

Provides authentication middleware (using [Everyauth](https://github.com/bnoguchi/everyauth/tree/express3)) for use in your Derby projects. Currently only supports Facebook integration, but more integration is on the way. Please do scratch your own itch with other Everyauth implementations and provide pull requests. See [Everyauth's sample code](https://github.com/bnoguchi/everyauth/tree/express3/example) for details. For usage details, see [lefnire/derby-examples/authentication](https://github.com/lefnire/derby-examples/blob/master/authentication); specifically, [server/index.js](https://github.com/lefnire/derby-examples/blob/master/authentication/src/server/index.coffee).

## Caveats
 * Keys are set as environment variables (~/.profile) instead of a conf file for security-sake - it's how sensitive variables 
are accessed on PaaS providers such as Heroku.
 * Password authentication may prove difficult. See [this issue](https://groups.google.com/d/msg/derbyjs/JuUqUNd9Rls/MgHOXuYwDMgJ) for details, but the gist is derby-auth may be moving to Passport in the near future.