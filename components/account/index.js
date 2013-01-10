var check = require('validator').check,
    sanitize = require('validator').sanitize,
    utils = require('../../utils')

exports.init = function(model) {
    model.ref('_user', model.parent().parent().at('_user'));
}

exports.create = function(model, dom) {

    model.on('set', 'newPassword', function(password){
        if (!password) return
        try {
            check(password).len(6);
            model.set('errors.newPassword', '');
        } catch (err) {
            model.set('errors.newPassword', 'Password must be at least 6 characters');
        }
    });

    model.on('set', 'newPasswordConfirm', function(password){
        if (!password) return
        try {
            check(password).equals(model.get('newPassword'));
            model.set('errors.newPasswordConfirm', '');
        } catch (err) {
            model.set('errors.newPasswordConfirm', err.message);
        }
    });

    model.on('set', 'errors.*', function(error){
        var m = model.get(),
            canSubmit = false;
        if (!m.errors.currentPassword && !m.errors.newPassword && !m.errors.newPasswordConfirm &&
            !!m.currentPassword && !!m.newPassword && !!m.newPasswordConfirm ) {
            canSubmit = true;
        }
        model.set('canSubmit', canSubmit);
    })
}

exports.currentPasswordBlur = function(){
    var model = this.model,
        rootModel = model.parent().parent(),
        username = rootModel.get('_user.auth.local.username'),
        password = model.get('currentPassword'),
        salt = rootModel.get('_user.auth.local.salt'),
        q = rootModel.query('users').withLogin(username, password, salt);

    rootModel.fetch(q, function(err, users) {
        try {
            if (err) throw new Error(err);
            var userObj = utils.extractUser(users);
            if (!userObj) throw new Error('Nope');
        } catch (err) {
            model.set('errors.currentPassword', err.message);
        }
    });
}

exports.changePasswordSubmit = function() {
    //TODO send to server
}