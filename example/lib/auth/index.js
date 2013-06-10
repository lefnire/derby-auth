var app = require('derby').createApp(module);

app
    .use(require('derby-ui-boot'))
    .use(require('../../ui'))
    .use(require('../../../components'));

app.get('/', function(page, model) {
  var user = model.at('users.' +  model.get('_session.userId'));
  user.subscribe(function(err) {
    if (err) throw err
    model.ref('_session.user', user);
    page.render();
  });
});

app.ready(function(model) {
    // nothing here
});
