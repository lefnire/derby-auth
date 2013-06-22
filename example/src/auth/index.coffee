app = require("derby").createApp(module)
app
  .use(require("derby-ui-boot"))
  .use(require("../../ui"))
  .use require("../../../components")

app.get "/", (page, model) ->
  $user = model.at "auth.#{model.get("_session.userId")}"
  $user.subscribe (err) ->
    throw err if err
    model.ref "_page.user", $user
    page.render()

app.ready (model) ->
  # nothing here