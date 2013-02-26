var derby = require('derby')
    , app = derby.createApp(module)
    , get = app.get

derby.use(require('derby-ui-boot'));
derby.use(require('../../ui'));
derby.use(require('../../../components'));

get('/', function(page, model) {
  model.query('users').withId(model.get('_userId')).subscribe(function(err, users) {
    model.ref('_user', users.at(0));
    page.render();
  });
});

app.ready(function(model) {
    // nothing here
});
