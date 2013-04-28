var derby = require('derby');

// initialize components (must come before derby.createApp)
derby.use(require('derby-ui-boot'));
derby.use(require('../../ui'));
derby.use(require('../../../components'));

var app = derby.createApp(module);

app.get('/', function(page, model) {
  model.query('users').withId(model.get('_userId')).subscribe(function(err, user) {
    model.ref('_user', user);
    page.render();
  });
});

app.ready(function(model) {
    // nothing here
});
