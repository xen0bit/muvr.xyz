const { desktopCapturer } = require('electron')
module.exports.getStreamUI = function () {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
        for (const source of sources) {
            console.log(source.name);
        }
    })
}