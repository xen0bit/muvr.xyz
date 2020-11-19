var xgo = require('./index.js').cmd;
var desktopInput = xgo.init();
setTimeout(function () {
    desktopInput.then(function () {
        xgo.ScrollMouse(5, "down")
        xgo.close();
    });
}, 3000);
//console.log(xgo);











































