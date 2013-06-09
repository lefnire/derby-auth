var config = {
    ns: 'derby-auth'
    , filename: __filename
    , scripts: {
        register: require('./register')
        , login: require('./login')
        , changePassword: require('./changePassword')
    }
}

module.exports = function(app, options) {
    app.createLibrary(Object.create(config), options)
}
