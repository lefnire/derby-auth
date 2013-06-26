config =
    ns: "derby-auth"
    filename: __filename
    scripts:
        register: require("./register/index.coffee")
        login: require("./login/index.coffee")
        changePassword: require("./changePassword/index.coffee")

module.exports = (app, options) ->
    app.createLibrary config, options