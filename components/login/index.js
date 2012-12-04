var utils = require('../../utils')

exports.init = function(model) {
}

exports.create = function(model, dom) {
}

exports.usernameBlur = function(){
    // check username registered
    var model = this.model,
        rootModel = model.parent().parent(),
        q = rootModel.query('users').withUsername(model.get('username'));
    rootModel.fetch(q, function(err, users) {
        try {
            if (err) throw new Error(err);
            var userObj = utils.extractUser(users);
            if (!userObj) {
                throw new Error('Username not registered.');
            } else {
                model.set('canSubmit', true);
                model.set('errors.username', '');
            }
        } catch (err) {
            model.set('canSubmit', false);
            model.set('errors.username', err.message);
        }
    });
}

exports.loginSubmit = function(e, el){
    var model = this.model,
        rootModel = model.parent().parent(),
        username = model.get('username'),
        password = model.get('password'),
        q = rootModel.query('users').withUsername(username);
    rootModel.fetch(q, function(err, users) {
        if (err) return model.set('errors.password', err);
        var userObj = utils.extractUser(users); // should be legit because already tested in usernameBlur
        q = model.query('users').withLogin(username, utils.encryptPassword(password, userObj.auth.local.salt));
        rootModel.fetch(q, function(err, users) {
            if (err) return model.set('errors.password', err);
            var userObj = utils.extractUser(users);
            if (!userObj) return model.set('errors.password', 'Invalid Login.');
            //TODO then actually submit form
        });
    });
}