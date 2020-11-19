var UglifyJS = require('uglify-js');
var fs = require('fs');

function buildWebviewCasterViewOnly() {
    var result = UglifyJS.minify(
        {
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/socket.io.js", "utf8"),
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/RTCMultiConnection.js", "utf8"),
            "qrcode.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/qrcode.js", "utf8"),
            "mousetrap.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/mousetrap.js", "utf8"),
            "rtc_caster-viewonly.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/rtc_caster-viewonly.js", "utf8"),
        },
        {
            warnings: true,
            mangle: true,
            compress: {
                sequences: true,
                dead_code: true,
                conditionals: true,
                booleans: true,
                unused: true,
                if_return: true,
                join_vars: true,
                drop_console: false
            }
        });

    console.log(result.warnings);
    if (result.error) {
        console.log(result.error);
    }
    else {
        fs.writeFileSync('./app/webview/js/caster-viewonly.min.js', result.code);
    }
}

function buildWebviewCasterFreeLook() {
    var result = UglifyJS.minify(
        {
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/socket.io.js", "utf8"),
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/RTCMultiConnection.js", "utf8"),
            "qrcode.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/qrcode.js", "utf8"),
            "mousetrap.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/mousetrap.js", "utf8"),
            "rtc_caster-freelook.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/rtc_caster-freelook.js", "utf8"),
        },
        {
            warnings: true,
            mangle: true,
            compress: {
                sequences: true,
                dead_code: true,
                conditionals: true,
                booleans: true,
                unused: true,
                if_return: true,
                join_vars: true,
                drop_console: false
            }
        });

    console.log(result.warnings);
    if (result.error) {
        console.log(result.error);
    }
    else {
        fs.writeFileSync('./app/webview/js/caster-freelook.min.js', result.code);
    }
}

function buildWebviewCasterFreeLookDolphin() {
    var result = UglifyJS.minify(
        {
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/socket.io.js", "utf8"),
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/RTCMultiConnection.js", "utf8"),
            "qrcode.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/qrcode.js", "utf8"),
            "mousetrap.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/mousetrap.js", "utf8"),
            "rtc_caster-freelookdolphin.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/rtc_caster-freelookdolphin.js", "utf8"),
        },
        {
            warnings: true,
            mangle: true,
            compress: {
                sequences: true,
                dead_code: true,
                conditionals: true,
                booleans: true,
                unused: true,
                if_return: true,
                join_vars: true,
                drop_console: false
            }
        });

    console.log(result.warnings);
    if (result.error) {
        console.log(result.error);
    }
    else {
        fs.writeFileSync('./app/webview/js/caster-freelookdolphin.min.js', result.code);
    }
}

function buildWebviewClientViewOnly() {
    var result = UglifyJS.minify(
        {
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/client/js/RTCMultiConnection.js", "utf8"),
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/client/js/socket.io.js", "utf8"),
            "three.js": fs.readFileSync("./src/xporpoise_app/static/client/js/three.js", "utf8"),
            "DeviceOrientationControls.js": fs.readFileSync("./src/xporpoise_app/static/client/js/DeviceOrientationControls.js", "utf8"),
            "gyronorm.complete.js": fs.readFileSync("./src/xporpoise_app/static/client/js/gyronorm.complete.js", "utf8"),
            "jquery.js": fs.readFileSync("./src/xporpoise_app/static/client/js/jquery-3.4.1.js", "utf8"),
            "rtc_client-viewonly.js": fs.readFileSync("./src/xporpoise_app/static/client/js/rtc_client-viewonly.js", "utf8")
        },
        {
            warnings: true,
            mangle: true,
            compress: {
                sequences: true,
                dead_code: true,
                conditionals: true,
                booleans: true,
                unused: true,
                if_return: true,
                join_vars: true,
                drop_console: true
            }
        });

    console.log(result.warnings);
    if (result.error) {
        console.log(result.error);
    }
    else {
        fs.writeFileSync('./app/webview/js/client-viewonly.min.js', result.code);
    }
}

function buildWebviewClientFreeLook() {
    var result = UglifyJS.minify(
        {
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/client/js/RTCMultiConnection.js", "utf8"),
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/client/js/socket.io.js", "utf8"),
            "three.js": fs.readFileSync("./src/xporpoise_app/static/client/js/three.js", "utf8"),
            "DeviceOrientationControls.js": fs.readFileSync("./src/xporpoise_app/static/client/js/DeviceOrientationControls.js", "utf8"),
            "gyronorm.complete.js": fs.readFileSync("./src/xporpoise_app/static/client/js/gyronorm.complete.js", "utf8"),
            "jquery.js": fs.readFileSync("./src/xporpoise_app/static/client/js/jquery-3.4.1.js", "utf8"),
            "boopclick.headphone.js": fs.readFileSync("./src/xporpoise_app/static/client/js/boopclick.headphone.js", "utf8"),
            "rtc_client-freelook.js": fs.readFileSync("./src/xporpoise_app/static/client/js/rtc_client-freelook.js", "utf8")
        },
        {
            warnings: true,
            mangle: true,
            compress: {
                sequences: true,
                dead_code: true,
                conditionals: true,
                booleans: true,
                unused: true,
                if_return: true,
                join_vars: true,
                drop_console: true
            }
        });

    console.log(result.warnings);
    if (result.error) {
        console.log(result.error);
    }
    else {
        fs.writeFileSync('./app/webview/js/client-freelook.min.js', result.code);
    }
}

function buildWebviewClientFreeLookDolphin() {
    var result = UglifyJS.minify(
        {
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/client/js/RTCMultiConnection.js", "utf8"),
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/client/js/socket.io.js", "utf8"),
            "three.js": fs.readFileSync("./src/xporpoise_app/static/client/js/three.js", "utf8"),
            "DeviceOrientationControls.js": fs.readFileSync("./src/xporpoise_app/static/client/js/DeviceOrientationControls.js", "utf8"),
            "gyronorm.complete.js": fs.readFileSync("./src/xporpoise_app/static/client/js/gyronorm.complete.js", "utf8"),
            "jquery.js": fs.readFileSync("./src/xporpoise_app/static/client/js/jquery-3.4.1.js", "utf8"),
            "boopclick.headphone.js": fs.readFileSync("./src/xporpoise_app/static/client/js/boopclick.headphone.js", "utf8"),
            "rtc_client-freelookdolphin.js": fs.readFileSync("./src/xporpoise_app/static/client/js/rtc_client-freelookdolphin.js", "utf8")
        },
        {
            warnings: true,
            mangle: true,
            compress: {
                sequences: true,
                dead_code: true,
                conditionals: true,
                booleans: true,
                unused: true,
                if_return: true,
                join_vars: true,
                drop_console: true
            }
        });

    console.log(result.warnings);
    if (result.error) {
        console.log(result.error);
    }
    else {
        fs.writeFileSync('./app/webview/js/client-freelookdolphin.min.js', result.code);
    }
}


function buildWebviewXporpoiseStartpage() {
    var result = UglifyJS.minify(
        {
            "xporpoise-startpage.js": fs.readFileSync("./src/xporpoise_app/static/startpage/js/xporpoise-startpage.js", "utf8")
        },
        {
            warnings: true,
            mangle: true,
            compress: {
                sequences: true,
                dead_code: true,
                conditionals: true,
                booleans: true,
                unused: true,
                if_return: true,
                join_vars: true,
                drop_console: false
            }
        });

    console.log(result.warnings);
    if (result.error) {
        console.log(result.error);
    }
    else {
        fs.writeFileSync('./app/webview/js/xporpoise-startpage.min.js', result.code);
    }
}

//Run build
buildWebviewCasterViewOnly();
buildWebviewCasterFreeLook();
buildWebviewCasterFreeLookDolphin();
buildWebviewClientViewOnly();
buildWebviewClientFreeLook();
buildWebviewClientFreeLookDolphin();
buildWebviewXporpoiseStartpage();