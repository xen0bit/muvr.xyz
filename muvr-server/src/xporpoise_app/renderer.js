// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.
// In the renderer process.

//export desktopCapturer to electron process
//const { desktopCapturer } = require('electron')
//export jquery so we can use it in the webview
window.$ = window.jQuery = require('jquery');
//Export store to persist JSON configurations to disk
const Store = require('electron-store');
window.store = new Store();

mfl = require("./mousefreelook_fullres.js");
mfc = require("./mousefreelook_boopclick.js");
mfr = require("./mousefreelook_getrect.js");

window.xporpoise_domain = '192.168.1.157:9001';

window.getFilteredStreamList = function (streamList) {
  return streamList.streamName !== 'MultiPorpoise'
}

window.getStreamList = function (callback) {
  desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
    var streamList = [];
    for (const source of sources) {
      streamList.push({
        streamName: source.name,
        dataURLImage: source.thumbnail.toDataURL()
      });
    }
    callback(streamList.filter(getFilteredStreamList));
  })
}

//Available constraints
var supportedConstraints = {
  "aspectRatio": true,
  "autoGainControl": true,
  "brightness": true,
  "channelCount": true,
  "colorTemperature": true,
  "contrast": true,
  "deviceId": true,
  "echoCancellation": true,
  "exposureCompensation": true,
  "exposureMode": true,
  "facingMode": true,
  "focusMode": true,
  "frameRate": true,
  "groupId": true,
  "height": true,
  "iso": true,
  "latency": true,
  "noiseSuppression": true,
  "pointsOfInterest": true,
  "sampleRate": true,
  "sampleSize": true,
  "saturation": true,
  "sharpness": true,
  "torch": true,
  "volume": true,
  "whiteBalanceMode": true,
  "width": true,
  "zoom": true
};

window.setStream = function (sourceName, streamConstraints) {
  desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
    for (const source of sources) {
      if (source.name === sourceName) {
        //Retrives coordinates and viewport of window being casted
        mfl.setWindowResolution(mfr.getWindowRectByName(sourceName));
        //Set stream id in constraints
        streamConstraints.video.mandatory.chromeMediaSourceId = source.id;
        navigator.mediaDevices.getUserMedia(
          streamConstraints
        ).then((stream) => {
          window.globalStreamHandler(stream)
        }).catch((e) => {
          console.log(e)
        })

        return
      }
      //Dolphin mode
      if (source.name.includes('Dolphin') && source.name.includes('FPS')) {
        //Enable dolphin mode
        mfl.setDolphinMode(true);
        //Retrives coordinates and viewport of window being casted
        mfl.setWindowResolution(mfr.getWindowRectByName('DolphinMode'));
        //Set stream id in constraints
        streamConstraints.video.mandatory.chromeMediaSourceId = source.id;
        navigator.mediaDevices.getUserMedia(
          streamConstraints
        ).then((stream) => {
          window.globalStreamHandler(stream)
        }).catch((e) => {
          console.log(e)
        })

        return
      }
    }
  })
}

$(document).ready(function () {
  // Handler when the DOM is fully loaded that laucnhes the rest of the app
  setTimeout(function () { rtcCasterEntryPoint(); }, 1000);

  //createQRCode("https://10.0.0.168:9001/", "viewerConnectCodeCanvas");
});
