validator = require('validator/validator-min.js')
check = validator.check
sanitize = validator.sanitize
utils = require('../../utils.coffee')

exports.init = (model) ->

exports.create = (model, dom) ->

    model.on 'change', 'password', (password) ->
        return unless password
        try
            check(password).len(6)
            model.set('errors.password', '')
        catch err
            model.set('errors.password', 'Password must be at least 6 characters')

    model.on 'change', 'passwordConfirmation', (passwordConfirmation) ->
        return unless passwordConfirmation
        try
            check(passwordConfirmation).equals(model.get('password'))
            model.set('errors.passwordConfirmation', '')
        catch err
            model.set('errors.passwordConfirmation', err.message)

    model.on 'change', 'errors.*', (error) ->
        m = model.get()
        canSubmit = !m.errors.passwordConfirmation && !m.errors.password &&
                    !!m.passwordConfirmation && !!m.password
        model.set('canSubmit', canSubmit)

exports.submitPasswordChange = (e, el) ->
    model = @model
    rootModel = model.parent().parent()
    $?.ajax
        url: '/password-change'
        type:'POST'
        data:
            uid: rootModel.get('_session.userId')
            oldPassword: model.get('oldPassword')
            newPassword: model.get('password')
        success: (data, textStatus, jqXHR ) ->
            alert("Password successfully changed")
        error: (jqXHR, textStatus, errorThrown ) ->
            model.set('errors.oldPassword', jqXHR.responseText)