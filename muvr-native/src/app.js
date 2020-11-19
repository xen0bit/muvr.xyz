// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.
// In the renderer process.
window.muvrNative = true;
//export desktopCapturer to browser window
window.ElectronDesktopCapturer = require('electron').desktopCapturer;
//export xgo module to window
window.xgo = require('xgo').cmd;
var desktopInput = xgo.init();
// desktopInput.then(function () {
//     console.log(xgo);
// });


//export jquery so we can use it in the webview
//window.$ = window.jQuery = require('jquery');
//Export store to persist JSON configurations to disk
const ElectronStore = require('electron-store');
window.ElectronStore = new ElectronStore();
