// http://127.0.0.1:9001
// http://localhost:9001

var server = require('https'),
    url = require('url'),
    path = require('path'),
    fs = require('fs');
//mfl = require("./mousefreelook_fullres.js");

module.exports.startServer = function () {
    function serverHandler(request, response) {
        var uri = url.parse(request.url).pathname,
            filename = path.join(__dirname, uri);

        fs.exists(filename, function (exists) {
            if (!exists) {
                response.writeHead(404, {
                    'Content-Type': 'text/plain'
                });
                response.write('404 Not Found: ' + filename + '\n');
                response.end();
                return;
            }

            if (filename.indexOf('favicon.ico') !== -1) {
                return;
            }

            var isWin = !!process.platform.match(/^win/);

            if (fs.statSync(filename).isDirectory() && !isWin) {
                filename += '/index.html';
            } else if (fs.statSync(filename).isDirectory() && !!isWin) {
                filename += '\\index.html';
            }

            fs.readFile(filename, 'binary', function (err, file) {
                if (err) {
                    response.writeHead(500, {
                        'Content-Type': 'text/plain'
                    });
                    response.write(err + '\n');
                    response.end();
                    return;
                }

                var contentType;

                if (filename.indexOf('.html') !== -1) {
                    contentType = 'text/html';
                }

                if (filename.indexOf('.js') !== -1) {
                    contentType = 'application/javascript';
                }

                if (contentType) {
                    response.writeHead(200, {
                        'Content-Type': contentType
                    });
                } else response.writeHead(200);

                response.write(file, 'binary');
                response.end();
            });
        });
    }

    var config = {
        "socketURL": "/",
        "dirPath": "",
        "homePage": "/",
        "socketMessageEvent": "MUVR-Message",
        "socketCustomEvent": "MUVR-Message-Custom",
        "port": 9001,
        "enableLogs": false,
        "isUseHTTPs": true,
        "enableAdmin": false
    };

    var options = {
        // key: fs.readFileSync('fake-keys/privatekey.pem'),
        // cert: fs.readFileSync('fake-keys/certificate.pem')
        key: fs.readFileSync(path.join(__dirname, 'dev-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'dev-cert.pem'))
    };

    var RTCMultiConnectionServer = require('rtcmulticonnection-server');
    var ioServer = require('socket.io');

    var app = server.createServer(options, serverHandler);
    RTCMultiConnectionServer.beforeHttpListen(app, config);
    app = app.listen(process.env.PORT || 9001, process.env.IP || "0.0.0.0", function () {
        RTCMultiConnectionServer.afterHttpListen(app, config);
    });

    // --------------------------
    // socket.io codes goes below

    ioServer(app).on('connection', function (socket) {
        RTCMultiConnectionServer.addSocket(socket, config);
        console.log('wss connection establisted');

        // ----------------------
        // below code is optional

        const params = socket.handshake.query;

        if (!params.socketCustomEvent) {
            params.socketCustomEvent = 'custom-message';
        }

        socket.on(params.socketCustomEvent, function (message) {
            console.log(message);
            socket.broadcast.emit(params.socketCustomEvent, message);
        });

        //Removed in favor of UDP connection
        /*socket.on('rotationevent', function (euler) {
            //console.log(euler);
            mfl.lookAt(euler);
        });*/
    });
};