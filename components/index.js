function components(derby, options) {
    var config = {
        ns: 'derby-auth'
        , filename: __filename
        , scripts: {
            register: require('./register')
            , login: require('./login')
            , account: require('./account')
        }
    }
    derby.createLibrary(config, options);
    return this;
}

components.decorate = 'derby';
module.exports = components;