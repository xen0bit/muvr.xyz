var { spawnSync } = require('child_process');
var path = require('path');
const process = require('process');
app = require('electron').remote.app;

module.exports.getWindowRectByName = function (windowName) {
    if (process.platform == 'win32') {
        var pythonPath = path.join(app.getAppPath(), '/app/native/win32/win32_getWindowRect.exe');
        var rect = spawnSync(pythonPath, [windowName], { encoding: 'utf-8' });
        if (!rect.stdout.includes('None')) {
            console.log(rect.stdout);
            return JSON.parse(rect.stdout);
        }
        else {
            return { "left": 0, "top": 0, "right": 1920, "bottom": 1080 }
        }
    }
    else {
        var pythonPath = path.join(app.getAppPath(), '/app/native/linux/x86_64_linux_getWindowRect.bin');
        var rect = spawnSync(pythonPath, [windowName], { encoding: 'utf-8' });
        if (!rect.stdout.includes('None')) {
            console.log(rect.stdout);
            return JSON.parse(rect.stdout);
        }
        else {
            return { "left": 0, "top": 0, "right": 1920, "bottom": 1080 }
        }
    }

}