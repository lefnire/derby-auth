var derby = require('derby')
    , app = derby.createApp(module)
    , get = app.get

derby.use(require('derby-ui-boot'));
derby.use(require('../../ui'));
derby.use(require('../../../components')); // replace with `require('derby-auth/components')` in your project

get('/', function(page, model) {
    var q = model.query('users').withId(model.session.userId);
    model.subscribe(q, function(err, users) {
        model.ref('_users', users);
        model.ref('_user', users.at(0));
        page.render();
    });
});

app.ready(function(model) {
    // nothing here
});
