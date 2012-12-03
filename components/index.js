function components(derby, options) {
    var config = {
        ns: 'derby-auth'
        , filename: __filename
        , scripts: {
            register: require('./register')
            , login: require('./login')
        }
    }
    derby.createLibrary(config, options);
    return this;
}

components.decorate = 'derby';
module.exports = components;