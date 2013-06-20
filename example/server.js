require('coffee-script')
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'debug') {
    require('./src/server').listen(3000);
} else {
    require('derby').run(__dirname + '/src/server', 3000);
}