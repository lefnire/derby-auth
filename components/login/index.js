var utils = require('../../utils')

exports.init = function(model) {
}

exports.create = function(model, dom) {
    // sorry but we need jquery, especially for ajax
    if (!window.$) require('../../vendor/jquery-1.8.3.min.js');
}

exports.usernameBlur = function(){
    // check username registered
    var model = this.model,
        rootModel = model.parent().parent(),
        q = rootModel.query('users').withUsername(model.get('username'));
    rootModel.fetch(q, function(err, users) {
        try {
            if (err) throw new Error(err);
            var userObj = users.get()
            if (!userObj) {
                throw new Error("Username not registered. Make sure you're using the same capitalization you used to register!");
            } else {
                model.set('errors.username', '');
            }
        } catch (err) {
            model.set('errors.username', err.message);
        }
    });
}

exports.loginSubmit = function(e, el){
    // TODO handle server-side login failure response message here, via model.set('errors.password',..)
}

exports.showPasswordReset = function() {
    document.getElementById('derby-auth-password-reset').style.display = "";
}

exports.submitPasswordReset = function() {
    // check username registered
    var model = this.model,
        rootModel = model.parent().parent(),
        q = rootModel.query('users').withEmail(model.get('passwordResetEmail'));
    rootModel.fetch(q, function(err, users) {
        try {
            if (err) throw new Error(err);
            var userObj = users.get()
            if (!userObj) {
                throw new Error('Email not registered.');
            } else {
                model.set('errors.passwordReset', '');
                $.ajax({
                    type: 'POST',
                    url: "/password-reset",
                    data: {
                        email: model.get('passwordResetEmail')
                    },
                    success: function(response){
                        model.set('success.passwordReset', response);
                    },
                    error: function(e) {
                        console.log(e);
                        throw e.responseText;
                    }
                })

            }
        } catch (err) {
            model.set('errors.passwordReset', err.message);
        }
    });
}