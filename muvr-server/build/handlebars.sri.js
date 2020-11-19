const crypto = require('crypto');
const fs = require('fs');
const Handlebars = require("handlebars");

function getHashForFile(path) {
    return "sha256-" + crypto.createHash('sha256').update(fs.readFileSync(path, "utf8")).digest('base64');
}

function generateSriCaster() {
    var subresources = [
        {
            "fileName": "jquery-ui.css",
            "handlebarsName": "jqueryxuixcss",
            "filePath": "./public/app/caster/jquery-ui.css"
        },
        {
            "fileName": "rtc_caster.css",
            "handlebarsName": "rtcxcastercss",
            "filePath": "./public/app/webview/css/rtc_caster.css"
        },
        {
            "fileName": "caster.min.js",
            "handlebarsName": "casterxviewonlyxminxjs",
            "filePath": "./public/app/webview/js/caster.min.js"
        },
    ];
    var handlebarsTemplate = Handlebars.compile(fs.readFileSync("./muvr-hugo/static/app/caster/index.html", "utf8"));
    var templateObject = {};
    for (var i = 0; i < subresources.length; i++) {
        var fileName = subresources[i].fileName;
        var fileHash = getHashForFile(subresources[i].filePath);
        subresources[i].fileHash = fileHash;
        templateObject[subresources[i].handlebarsName] = fileHash;
    }
    var output = handlebarsTemplate(templateObject);
    console.log('Caster SRI Generation:');
    console.log(subresources);
    fs.writeFileSync('./public/app/caster/index.html', output);
}

function generateSriClient() {
    var subresources = [
        {
            "fileName": "jquery-ui.css",
            "handlebarsName": "jqueryxuixcss",
            "filePath": "./public/app/client/jquery-ui.css"
        },
        {
            "fileName": "rtc_viewer_vr.css",
            "handlebarsName": "rtcxviewerxvrxcss",
            "filePath": "./public/app/webview/css/rtc_viewer_vr.css"
        },
        {
            "fileName": "client.min.js",
            "handlebarsName": "clientxviewonlyxminxjs",
            "filePath": "./public/app/webview/js/client.min.js"
        },
    ];
    var handlebarsTemplate = Handlebars.compile(fs.readFileSync("./muvr-hugo/static/app/client/index.html", "utf8"));
    var templateObject = {};
    for (var i = 0; i < subresources.length; i++) {
        var fileName = subresources[i].fileName;
        var fileHash = getHashForFile(subresources[i].filePath);
        subresources[i].fileHash = fileHash;
        templateObject[subresources[i].handlebarsName] = fileHash;
    }
    var output = handlebarsTemplate(templateObject);
    console.log('Client SRI Generation:');
    console.log(subresources);
    fs.writeFileSync('./public/app/client/index.html', output);
}

function generateSriOculus() {
    var subresources = [
        {
            "fileName": "jquery-ui.css",
            "handlebarsName": "jqueryxuixcss",
            "filePath": "./public/app/oculus/jquery-ui.css"
        },
        {
            "fileName": "rtc_viewer_vr.css",
            "handlebarsName": "rtcxviewerxvrxcss",
            "filePath": "./public/app/webview/css/rtc_viewer_vr.css"
        },
        {
            "fileName": "oculus.min.js",
            "handlebarsName": "oculusxviewonlyxminxjs",
            "filePath": "./public/app/webview/js/oculus.min.js"
        },
    ];
    var handlebarsTemplate = Handlebars.compile(fs.readFileSync("./muvr-hugo/static/app/oculus/index.html", "utf8"));
    var templateObject = {};
    for (var i = 0; i < subresources.length; i++) {
        var fileName = subresources[i].fileName;
        var fileHash = getHashForFile(subresources[i].filePath);
        subresources[i].fileHash = fileHash;
        templateObject[subresources[i].handlebarsName] = fileHash;
    }
    var output = handlebarsTemplate(templateObject);
    console.log('Oculus SRI Generation:');
    console.log(subresources);
    fs.writeFileSync('./public/app/oculus/index.html', output);
}

generateSriCaster();
generateSriClient();
generateSriOculus();