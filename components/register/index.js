var validator = require('../../node_modules/validator/validator-min'),
    check = validator.check,
    sanitize = validator.sanitize,
    utils = require('../../utils.coffee')

exports.init = function(model) {
}

exports.create = function(model, dom) {
    model.on('change', 'username', function(username){
        if (!username) return
        try {
            check(username).isAlphanumeric();
            model.set('errors.username', '');
        } catch (err) {
            model.set('errors.username', err.message);
        }
    });

    model.on('change', 'email', function(email){
        if (!email) return
        try {
            check(email).isEmail();
            model.set('errors.email', '');
        } catch (err) {
            model.set('errors.email', err.message);
        }
    });

    model.on('change', 'passwordConfirmation', function(passwordConfirmation){
        if (!passwordConfirmation) return
        try {
            check(passwordConfirmation).equals(model.get('password'));
            model.set('errors.passwordConfirmation', '');
        } catch (err) {
            model.set('errors.passwordConfirmation', err.message);
        }
    });

    model.on('change', 'password', function(password){
        if (!password) return
        try {
            check(password).len(6);
            model.set('errors.password', '');
        } catch (err) {
            model.set('errors.password', 'Password must be at least 6 characters');
        }
    });

    model.on('change', 'errors.*', function(error){
        var m = model.get(),
            canSubmit = false;
        if (!m.errors.username && !m.errors.email && !m.errors.passwordConfirmation && !m.errors.password &&
            !!m.username && !!m.email && !!m.passwordConfirmation && !!m.password) {
            canSubmit = true;
        }
        model.set('canSubmit', canSubmit);
    })
}

exports.usernameBlur = function(){
    // check username not already registered
    var model = this.model,
        rootModel = model.parent().parent(),
        q = rootModel.query('users', {'auth.local.username':model.get('username'), $limit: 1});
    rootModel.fetch(q, function(err) {
        try {
            if (err) throw new Error(err);
            var userObj = q.get()[0]
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
        q = rootModel.query('users', {'auth.local.email':model.get('email'), $limit:1});
    rootModel.fetch(q, function(err) {
        try {
            if (err) throw new Error(err);
            var userObj = q.get()[0]
            if (userObj) throw new Error('Email already taken');
        } catch (err) {
            model.set('errors.email', err.message);
        }
    });
}