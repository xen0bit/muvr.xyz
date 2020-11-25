function setStreamConstraints(width, height, fps) {
    //Template onstraints object, mandatory is required for electron otherwise it defaults to the camera of the PC
    //for no obvious reason
    //...and you get to see an image of your frustrated face staring back at you. 0/10, would not recommend
    //
    //video stream constraints
    //https://blog.addpipe.com/getusermedia-video-constraints/
    //keywords: min, max, exact

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
    var streamConstraints = {
        audio: false,
        video: {
        }
    };
    streamConstraints.video.width = width;
    streamConstraints.video.height = height;
    streamConstraints.video.frameRate = fps;
    //Save config to disk
    store.setItem('streamConstraints', streamConstraints);
}

function setMode(onOff){
    if(onOff == 'on'){
        store.setItem('mode', {viewOnly: true});
    }
    else{
        store.setItem('mode', {viewOnly: false});
    }
    
}

function getWAndHFromText(text){
    //Example input
    //320x240 (QVGA)
    var width = parseInt(text.split(' ')[0].split('x')[0]);
    var height = parseInt(text.split(' ')[0].split('x')[1])
    return [width, height]
}

function getFpsFromText(text){
    //Example input
    //'30'
    return parseInt(text)
}


$( document ).ready(function() {
    $( "#settings" ).controlgroup();
    //If a config already exists, populate selection placeholders
    // try{
    //     if(store.getItem('streamConstraints')){
    //         var streamConstraints = JSON.parse(store.getItem('streamConstraints'));
    //         $('#resolutioninput')[0].placeholder = (streamConstraints.video.width.toString() + 'x' + streamConstraints.video.height.toString());
    //         $('#fpsinput')[0].placeholder = (streamConstraints.video.frameRate.toString());
    //     }
    // }
    // catch(e){
    //     store.clear();
    // }
    

    $( '#savebutton' ).on('click', function(){
        var textResolution = $('#Resolution').val();
        var textFps = $('#fps').val();
        var intArrayResolution = getWAndHFromText(textResolution);
        var intFps = getFpsFromText(textFps);
        var viewOnly = $('#view-only-mode:checked').val();
        //Clear existing config
        store.clear();
        setStreamConstraints(intArrayResolution[0], intArrayResolution[1], intFps);
        setMode(viewOnly);
    });
  });