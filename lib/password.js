module.exports = function(everyauth, request){
    everyauth.password
        .loginWith('email')
        .getLoginPath('/login')
        .postLoginPath('/login')
        .authenticate(function(login, password) {
            var errors, user;
            errors = [];
            if (!login) {
                errors.push("Missing login");
            }
            if (!password) {
                errors.push("Missing password");
            }
            if (errors.length) {
                return errors;
            }
            user = usersByLogin[login];
            if (!user) {
                return ["Login failed"];
            }
            if (user.password !== password) {
                return ["Login failed"];
            }
            return user;
        }).getRegisterPath("/register").postRegisterPath("/register").validateRegistration(function(newUserAttrs, errors) {
            var model = request.model, sess = model.session,
                login = newUserAttrs.login,
                q = model.query('users').withEveryauth('password', login);

            return model.fetch(q, function(err, user) {
                if (everyauth.debug) console.log({ err: err, user: user });
                var u;
                if (user && (u = user.get()) && u.length > 0 && u[0].id) {
                    errors.push("Login already taken");
                }
                return errors;
            });
        }).registerUser(function(newUserAttrs) {
            var login;
            login = newUserAttrs[this.loginKey()];
            return model.set("users." + sess.userId + ".auth.password", newUserAttrs);
        })
        .loginSuccessRedirect("/")
        .registerSuccessRedirect("/");
}