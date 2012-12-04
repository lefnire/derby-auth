// Encryption using http://dailyjs.com/2010/12/06/node-tutorial-5/
// Note: would use [password-hash](https://github.com/davidwood/node-password-hash), but we need to run
// model.query().equals(), so it's a PITA to work in their verify() function

var crypto = require('crypto');

module.exports.encryptPassword = function(password, salt) {
    return crypto.createHmac('sha1', salt).update(password).digest('hex');
}

module.exports.makeSalt = function() {
    var len = 10;
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').substring(0, len);
}

/**
 * When a query is run against the model, a resultset is returned. This extracts the first object returned
 * @param the query results, a model.at object
 * @return the first user object from the results
 */
module.exports.extractUser = function(modelAt) {
    var u;
    return modelAt && (u = modelAt.get()) && u.length > 0 && u[0];
}