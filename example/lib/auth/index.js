var derby = require('derby')
    , app = derby.createApp(module)
    , get = app.get

derby.use(require('derby-ui-boot'));
derby.use(require('../../ui'));
derby.use(require('../../../components'));

get('/', function(page, model) {
  model.subscribe('users.' + model.session.userId, function(err, user) {
    model.ref('_user', user);
    page.render();
  });
});

app.ready(function(model) {
    // nothing here
});
