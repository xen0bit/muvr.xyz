var UglifyJS = require('uglify-es');
var JavaScriptObfuscator = require('javascript-obfuscator');
var fs = require('fs');

var debug = true;

function buildWebviewCaster() {
    var uglifySettings;
    if (debug == true) {
        uglifySettings = {
            warnings: true,
            mangle: false,
            compress: {
                sequences: false,
                dead_code: false,
                conditionals: false,
                booleans: false,
                unused: false,
                if_return: false,
                join_vars: false,
                drop_console: false
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        }
    }
    else {
        uglifySettings = {
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
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        };
    }
    var licensed = UglifyJS.minify(
        {
            "jquery.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/jquery-3.4.1.js", "utf8"),
            "jquery-ui.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/jquery-ui.js", "utf8"),
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/socket.io.js", "utf8"),
            "getHTMLMediaElement.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/getHTMLMediaElement.js", "utf8"),
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/RTCMultiConnection.js", "utf8"),
            "caster.license.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/caster.license.js", "utf8")
        },
        {
            warnings: true,
            mangle: false,
            compress: {
                sequences: false,
                dead_code: false,
                conditionals: false,
                booleans: false,
                unused: false,
                if_return: false,
                join_vars: false,
                drop_console: false
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        }
    );

    var homemade = UglifyJS.minify(
        {
            "gyroscope.grapher.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/gyroscope.grapher.js", "utf8"),
            "gyroscope.native.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/gyroscope.native.js", "utf8"),
            "security.messageSigning.caster.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/security.messageSigning.caster.js", "utf8"),
            "store.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/store.js", "utf8"),
            "settings.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/settings.js", "utf8"),
            "mobile.detect.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/mobile.detect.js", "utf8"),
            "input.gamepad.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/input.gamepad.js", "utf8"),
            "rtc_caster.js": fs.readFileSync("./src/xporpoise_app/static/caster/js/rtc_caster.js", "utf8"),
        },
        uglifySettings
    );

    //Build Licensed Code
    console.log(licensed.warnings);
    if (licensed.error !== undefined) {
        console.log(licensed.error);
    }
    else {
        //Prepend to expose Jquery to Electron
        licensed.code = "if (typeof module === 'object') { window.module = module; module = undefined; }" + licensed.code;
    }

    //Build homemade code
    console.log(homemade.warnings);
    if (homemade.error !== undefined) {
        console.log(homemade.error);
    }
    else {
        if (debug == true) {
            //Apppend to expose Jquery to Electron
            homemade.code = homemade.code + "if (window.module) module = window.module;"
        }
        else {
            //Apppend to expose Jquery to Electron
            homemade.code = homemade.code + "if (window.module) module = window.module;"
            var obfuscationResult = JavaScriptObfuscator.obfuscate(homemade.code,
                {
                    compact: true,
                    identifierNamesGenerator: 'hexadecimal',
                    controlFlowFlattening: false
                }
            );
            homemade.code = obfuscationResult.getObfuscatedCode();
        }
    }
    var output = licensed.code + homemade.code;
    fs.writeFileSync('./muvr-hugo/static/app/webview/js/caster.min.js', output);
}

function buildWebviewClient() {
    var uglifySettings;
    if (debug == true) {
        uglifySettings = {
            warnings: true,
            mangle: false,
            compress: {
                sequences: false,
                dead_code: false,
                conditionals: false,
                booleans: false,
                unused: false,
                if_return: false,
                join_vars: false,
                drop_console: false
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        }
    }
    else {
        uglifySettings = {
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
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        };
    }
    var licensed = UglifyJS.minify(
        {
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/client/js/RTCMultiConnection.js", "utf8"),
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/client/js/socket.io.js", "utf8"),
            "three.js": fs.readFileSync("./src/xporpoise_app/static/client/js/threejs-custom-r67.js", "utf8"),
            "DeviceOrientationControls.js": fs.readFileSync("./src/xporpoise_app/static/client/js/DeviceOrientationControls.js", "utf8"),
            "jquery.js": fs.readFileSync("./src/xporpoise_app/static/client/js/jquery-3.4.1.js", "utf8"),
            "jquery-ui.js": fs.readFileSync("./src/xporpoise_app/static/client/js/jquery-ui.js", "utf8"),
            "client.license.js": fs.readFileSync("./src/xporpoise_app/static/client/js/client.license.js", "utf8")
        },
        {
            warnings: true,
            mangle: false,
            compress: {
                sequences: false,
                dead_code: false,
                conditionals: false,
                booleans: false,
                unused: false,
                if_return: false,
                join_vars: false,
                drop_console: false
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        }
    );
    var homemade = UglifyJS.minify(
        {
            "boopclick.headphone.js": fs.readFileSync("./src/xporpoise_app/static/client/js/boopclick.headphone.js", "utf8"),
            "input.gamepad.js": fs.readFileSync("./src/xporpoise_app/static/client/js/input.gamepad.js", "utf8"),
            "security.messageSigning.client.js": fs.readFileSync("./src/xporpoise_app/static/client/js/security.messageSigning.client.js", "utf8"),
            "rtc_client.js": fs.readFileSync("./src/xporpoise_app/static/client/js/rtc_client.js", "utf8")
        },
        {
            warnings: true,
            mangle: false,
            compress: {
                sequences: false,
                dead_code: false,
                conditionals: false,
                booleans: false,
                unused: false,
                if_return: false,
                join_vars: false,
                drop_console: false
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        }
    );

    //Build Licensed Code
    console.log(licensed.warnings);
    if (licensed.error !== undefined) {
        console.log(licensed.error);
    }

    //Build homemade code
    console.log(homemade.warnings);
    if (homemade.error !== undefined) {
        console.log(homemade.error);
    }
    else {
        if (debug == true) {
            homemade.code = homemade.code;
        }
        else {
            var obfuscationResult = JavaScriptObfuscator.obfuscate(homemade.code,
                {
                    compact: true,
                    identifierNamesGenerator: 'hexadecimal',
                    controlFlowFlattening: false
                }
            );
            homemade.code = obfuscationResult.getObfuscatedCode();
        }
    }
    var output = licensed.code + homemade.code;
    fs.writeFileSync('./muvr-hugo/static/app/webview/js/client.min.js', output);
}

function buildWebviewOculus() {
    var uglifySettings;
    if (debug == true) {
        uglifySettings = {
            warnings: true,
            mangle: false,
            compress: {
                sequences: false,
                dead_code: false,
                conditionals: false,
                booleans: false,
                unused: false,
                if_return: false,
                join_vars: false,
                drop_console: false
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        }
    }
    else {
        uglifySettings = {
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
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        };
    }
    var licensed = UglifyJS.minify(
        {
            "RTCMultiConnection.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/RTCMultiConnection.js", "utf8"),
            "socket.io.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/socket.io.js", "utf8"),
            "three.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/threejs-custom-r67.js", "utf8"),
            "DeviceOrientationControls.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/DeviceOrientationControls.js", "utf8"),
            "jquery.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/jquery-3.4.1.js", "utf8"),
            "jquery-ui.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/jquery-ui.js", "utf8"),
            "client.license.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/client.license.js", "utf8")
        },
        {
            warnings: true,
            mangle: false,
            compress: {
                sequences: false,
                dead_code: false,
                conditionals: false,
                booleans: false,
                unused: false,
                if_return: false,
                join_vars: false,
                drop_console: false
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        }
    );
    var homemade = UglifyJS.minify(
        {
            "boopclick.headphone.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/boopclick.headphone.js", "utf8"),
            "input.gamepad.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/input.gamepad.js", "utf8"),
            "security.messageSigning.client.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/security.messageSigning.client.js", "utf8"),
            "store.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/store.js", "utf8"),
            "rtc_client-oculus.js": fs.readFileSync("./src/xporpoise_app/static/oculus/js/rtc_client-oculus.js", "utf8")
        },
        {
            warnings: true,
            mangle: false,
            compress: {
                sequences: false,
                dead_code: false,
                conditionals: false,
                booleans: false,
                unused: false,
                if_return: false,
                join_vars: false,
                drop_console: false
            },
            output: {
                code: true,
                comments: "/^\/*!/"
            }
        }
    );

    //Build Licensed Code
    console.log(licensed.warnings);
    if (licensed.error !== undefined) {
        console.log(licensed.error);
    }

    //Build homemade code
    console.log(homemade.warnings);
    if (homemade.error !== undefined) {
        console.log(homemade.error);
    }
    else {
        if (debug == true) {
            homemade.code = homemade.code;
        }
        else {
            var obfuscationResult = JavaScriptObfuscator.obfuscate(homemade.code,
                {
                    compact: true,
                    identifierNamesGenerator: 'hexadecimal',
                    controlFlowFlattening: false
                }
            );
            homemade.code = obfuscationResult.getObfuscatedCode();
        }
    }
    var output = licensed.code + homemade.code;
    fs.writeFileSync('./muvr-hugo/static/app/webview/js/oculus.min.js', output);
}


//Run build
buildWebviewCaster();
buildWebviewClient();
buildWebviewOculus();