var boopClickHeadphone = (function () {
  return {
    getAudioHandle: function () {
      //Create Audio Element
      var audioElement = document.createElement('AUDIO');
      audioElement.setAttribute('controls', true);
      audioElement.setAttributeNode(document.createAttribute('controls'));
      audioElement.setAttribute('loop', true);
      audioElement.id = 'audioElement';
      //audioElement.style.display = 'none';
      //Create Source Element
      var silenceMp3 = 'data:audio/mp3;base64,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';
      var sourceElement = document.createElement('SOURCE');
      sourceElement.setAttribute('type', 'audio/mpeg');
      //sourceElement.src = silence2SecondsMp3;
      sourceElement.src = 'https://' + document.domain + '/app/webview/silence.mp3'
      //Attach source to Audio
      audioElement.appendChild(sourceElement);
      //document.body.appendChild(audioElement);
      return audioElement
    },
    //Must be called by user interaction
    startMonitor: function (audioHandle, callbackFunc) {
      var callback = callbackFunc;
      var audioElment = audioHandle;
      audioElment.play();
      var audioStarted = false;
      if (audioElment.paused == false) {
        audioStarted = true;
      }
      audioElment.addEventListener("pause", function () {
        callback(true);
        audioElment.play();
      }, false);
      audioElment.addEventListener("play", function () {
        callback(false);
      }, false);
    },
    registerMainLoop: function (callbackFunc) {
      var audioHandle = boopClickHeadphone.getAudioHandle();
      boopClickHeadphone.startMonitor(audioHandle, callbackFunc);
    }
  }

})();