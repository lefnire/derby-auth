# Encryption using http://dailyjs.com/2010/12/06/node-tutorial-5/
# Note: would use [password-hash](https://github.com/davidwood/node-password-hash), but we need to run
# model.query().equals(), so it's a PITA to work in their verify() function
crypto = require("crypto")
module.exports.encryptPassword = (password, salt) ->
  crypto.createHmac("sha1", salt).update(password).digest "hex"

module.exports.makeSalt = ->
  len = 10
  crypto.randomBytes(Math.ceil(len / 2)).toString("hex").substring 0, len