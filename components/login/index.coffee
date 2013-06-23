utils = require('../../utils.coffee')
jQuery = undefined

exports.init = (model) ->

exports.create = (model, dom) ->
  jQuery = window?.jQuery or require('../../vendor/jquery-1.10.1.min.js')

exports.usernameBlur = ->
    # check username registered
    model = @model
    rootModel = model.parent().parent()
    $q = rootModel.query 'auth', {'local.username': model.get('username'), $limit: 1}
    $q.fetch (err) ->
        try
            throw new Error(err) if err
            if $q.get()[0]
              model.set('errors.username', '')
            else
              throw new Error "Username not registered. Make sure you're using the same capitalization you used to register!"
        catch err
            model.set('errors.username', err.message)

exports.loginSubmit = (e, el) ->
    # TODO handle server-side login failure response message here, via model.set('errors.password',..)

exports.showPasswordReset = () ->
    document.getElementById('derby-auth-password-reset').style.display = ""

exports.submitPasswordReset = () ->
    # check username registered
    model = @model
    rootModel = model.parent().parent()
    $q = rootModel.query('auth', {'local.email': model.get('passwordResetEmail'), $limit: 1});
    $q.fetch (err) ->
        try
            throw new Error(err) if err
            unless $q.get()[0]
                throw new Error('Email not registered.')
            else
                model.set('errors.passwordReset', '')
                jQuery.ajax
                    type: 'POST',
                    url: "/password-reset",
                    data:
                        email: model.get('passwordResetEmail')
                    success: (response) ->
                        model.set('success.passwordReset', response)
                    error: (e) ->
                        console.log(e)
                        throw e.responseText
        catch err
            model.set('errors.passwordReset', err.message)