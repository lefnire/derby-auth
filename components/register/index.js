var check = require('validator').check,
    sanitize = require('validator').sanitize,
    utils = require('../../utils')

exports.init = function(model) {
}

exports.create = function(model, dom) {
    model.on('set', 'username', function(username){
        if (!username) return
        try {
            check(username).isAlphanumeric();
            model.set('errors.username', '');
        } catch (err) {
            model.set('errors.username', err.message);
        }
    });

    model.on('set', 'email', function(email){
        if (!email) return
        try {
            check(email).isEmail();
            model.set('errors.email', '');
        } catch (err) {
            model.set('errors.email', err.message);
        }
    });

    model.on('set', 'emailConfirmation', function(emailConfirmation){
        if (!emailConfirmation) return
        try {
            check(emailConfirmation).equals(model.get('email'));
            model.set('errors.emailConfirmation', '');
        } catch (err) {
            model.set('errors.emailConfirmation', err.message);
        }
    });

    model.on('set', 'password', function(password){
        if (!password) return
        try {
            check(password).len(6);
            model.set('errors.password', '');
        } catch (err) {
            model.set('errors.password', 'Password must be at least 6 characters');
        }
    });

    model.on('set', 'errors.*', function(error){
        var m = model.get(),
            canSubmit = false;
        if (!m.errors.username && !m.errors.email && !m.errors.emailConfirmation && !m.errors .password &&
            !!m.username && !!m.email && !!m.emailConfirmation && !!m.password) {
            canSubmit = true;
        }
        model.set('canSubmit', canSubmit);
    })
}

exports.usernameBlur = function(){
    // check username not already registered
    var model = this.model,
        rootModel = model.parent().parent(),
        q = rootModel.query('users').withUsername(model.get('username'));
    rootModel.fetch(q, function(err, users) {
        try {
            if (err) throw new Error(err);
            var userObj = utils.extractUser(users);
            if (userObj) throw new Error('Username already taken');
        } catch (err) {
            model.set('errors.username', err.message);
        }
    });
}

exports.emailBlur = function(){
    // check email not already registered
    var model = this.model,
        rootModel = model.parent().parent(),
        q = rootModel.query('users').withEmail(model.get('email'));
    rootModel.fetch(q, function(err, users) {
        try {
            if (err) throw new Error(err);
            var userObj = utils.extractUser(users);
            if (userObj) throw new Error('Email already taken');
        } catch (err) {
            model.set('errors.email', err.message);
        }
    });
}