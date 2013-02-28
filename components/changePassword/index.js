var validator = require('../../node_modules/validator/validator-min'),
    check = validator.check,
    sanitize = validator.sanitize,
    utils = require('../../utils')

exports.init = function(model) {
}

exports.create = function(model, dom) {
    // sorry but we need jquery, especially for ajax
    if (!window.$) require('../../vendor/jquery-1.8.3.min.js');

    model.on('set', 'password', function(password){
        if (!password) return
        try {
            check(password).len(6);
            model.set('errors.password', '');
        } catch (err) {
            model.set('errors.password', 'Password must be at least 6 characters');
        }
    });

    model.on('set', 'passwordConfirmation', function(passwordConfirmation){
        if (!passwordConfirmation) return
        try {
            check(passwordConfirmation).equals(model.get('password'));
            model.set('errors.passwordConfirmation', '');
        } catch (err) {
            model.set('errors.passwordConfirmation', err.message);
        }
    });

    model.on('set', 'errors.*', function(error){
        var m = model.get(),
            canSubmit = false;
        if (!m.errors.passwordConfirmation && !m.errors.password &&
            !!m.passwordConfirmation && !!m.password) {
            canSubmit = true;
        }
        model.set('canSubmit', canSubmit);
    })
}

exports.submitPasswordChange = function(e, el) {
    var model = this.model,
        rootModel = model.parent().parent();
    $.ajax({
        url: '/password-change',
        type:'POST',
        data: {
            uid: rootModel.get('_userId'),
            oldPassword: model.get('oldPassword'),
            newPassword: model.get('password')
        },
        success: function(data, textStatus, jqXHR ){
            alert("Password successfully changed");
        },
        error: function(jqXHR, textStatus, errorThrown ){
            model.set('errors.oldPassword', jqXHR.responseText);
        }
    })
}