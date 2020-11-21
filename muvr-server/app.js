var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
//var redis = require('socket.io-redis');
//io.adapter(redis({ host: 'localhost', port: 6379 }));
var path = require('path');
var cookieParser = require('cookie-parser');
var compression = require('compression');
var logger = require('morgan');
var fs = require('fs');
var RTCMultiConnectionServer = require('rtcmulticonnection-server');

var api = require('./routes/api.js');

//var app = express();
app.set('trust proxy', true);
app.use(compression())
app.use(logger('common'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', api);
app.use(express.static(path.join(__dirname, 'public'), {
    maxage: '0h'
}));


var config = {
    "socketURL": "/",
    "dirPath": "",
    "homePage": "/",
    "socketMessageEvent": "MUVR-WS",
    //"socketCustomEvent": "RTCMultiConnection-Custom-Message",
    "port": 8080,
    "enableLogs": false,
    "isUseHTTPs": false,
    "enableAdmin": false
};



io.on('connection', function (socket) {
    RTCMultiConnectionServer.addSocket(socket, config);
    console.log('Connected: ' + socket.id);

    // ----------------------
    // below code is optional

    const params = socket.handshake.query;
    //Kill any socket left open longer then 2 minutes
    setTimeout(() => socket.disconnect(true), 120000);

    if (!params.socketCustomEvent) {
        params.socketCustomEvent = 'MUVR-WS-Custom';
    }

    socket.on(params.socketCustomEvent, function (message) {
        console.log(message);
        socket.broadcast.emit(params.socketCustomEvent, message);
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket Disconnected: ' + socket.id + reason);
    });
});

module.exports = { app: app, server: server };
