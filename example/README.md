# Derby.js Authentication Example

Uses [derby-auth](https://github.com/lefnire/derby-auth) to provide authentication to DerbyJS. Salient example files:
 * `lib/server/index.js` - middleware initialization
 * `lib/auth/index.js` - component initialization (optional, use if you want derby-auth components in your views)
 * `views/auth/index.html` - oauth buttons and login / register using components `<derby-auth:login />` and `<derby-auth:register />`

To run this example:
 * `npm install && cd .. && npm install` - you need node_modules for both this & above directories
 * `npm start`
 * navigate to http://localhost:3000