//AutoCast
var connection = new RTCMultiConnection();
//var store = localStorage;

var debug = true;
if (debug == false) {
    //redirect info messages to visible text box
    console.info = function () {
        var currentVal = $('#status').val();
        var newVal = currentVal + '\n' + arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            var newVal = newVal + '\n' + arguments[i];
        }
        $('#status').val(newVal);
    }

    console.log = function () {
        var currentVal = $('#status').val();
        var newVal = currentVal + '\n' + arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            var newVal = newVal + '\n' + arguments[i];
        }
        $('#status').val(newVal);
    }

    console.debug = function () {
        var currentVal = $('#status').val();
        var newVal = currentVal + '\n' + arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            var newVal = newVal + '\n' + arguments[i];
        }
        $('#status').val(newVal);
    }

    console.debug = function () {
        var currentVal = $('#status').val();
        var newVal = currentVal + '\n' + arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            var newVal = newVal + '\n' + arguments[i];
        }
        $('#status').val(newVal);
    }

}

function secureRandomString() {
    var array = new Uint32Array(10);
    window.crypto.getRandomValues(array);
    var randomString = '';
    for (i = 0; i < array.length; i++) {
        randomString += array[i].toString(16);
    }
    return randomString
}


var secureRandomRoom = secureRandomString();
if(location.hash != ""){
    secureRandomRoom = location.hash.split('#')[1]
}


function displayLogs() {
    $('#logDiv').css('display', 'none');
    $('#status').css('display', 'inline');
}

/* Client Input Handling Functions */
//===================================

//gyroGraph loop
var graphOnDOM = false;
var graphCanvas;
function renderGraph(euler) {
    if (graphOnDOM == false) {
        //graphCanvas = gyroGraph.setupGraphCanvas(512, 512, 'graphCanvas');
        //$('#inputDemo').append(graphCanvas);
        graphCanvas = document.getElementById('graphCanvas');
        graphOnDOM = true;
    }
    gyroGraph.renderEuler(graphCanvas, euler);
}

function clickMouse(bool) {
    if (window.muvrNative) {
        xgo.MouseClick("left", false);
    }
    else {
        var currentVal = $('#mouseLogs').val();
        var newVal;
        if (bool) {
            var d = new Date();
            var n = d.getTime();
            newVal = n.toString() + ' - Mouse Click: DOWN' + '\n' + currentVal;
        }
        else {
            var d = new Date();
            var n = d.getTime();
            newVal = n.toString() + ' - Mouse Click: UP' + '\n' + currentVal;
        }
        $('#mouseLogs').val(newVal);
    }

}

// function gamepadLogger(message) {
//     var currentVal = $('#gamepadLogs').val();
//     var newVal;
//     var d = new Date();
//     var n = d.getTime();
//     newVal = n.toString() + ' ' + JSON.stringify(message);

//     $('#gamepadLogs').val(newVal);
// }

window.globalStreamHandler = function (screenStream) {
    // ......................................................
    // ..................RTCMultiConnection Code.............
    // ......................................................

    //var connection = new RTCMultiConnection();

    // by default, socket.io server is assumed to be deployed on your own URL
    connection.socketURL = '/';
    // allow only one user other than caster
    // it will become one-to-one video chat
    connection.maxParticipantsAllowed = 2;

    //connection.socketMessageEvent = 'screen-sharing-demo';

    connection.session = {
        screen: true,
        oneway: true,
        data: true
    };

    connection.codecs.video = 'H264';
    //Bandwidth in kbps
    connection.bandwidth = {
        audio: 0,  // 0 kbps
        video: 20000, // 10 mbps
        screen: 10000 // 300 kbps
    };

    // both chrome/firefox now accepts 64 kilo-bits for each data-chunk
    connection.chunkSize = 64 * 1000;

    connection.maxRelayLimitPerUser = 0;

    connection.sdpConstraints.mandatory = {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
    };

    // https://www.rtcmulticonnection.org/docs/iceServers/
    // use your own TURN-server here!
    connection.iceServers = [{
        'urls': [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun.l.google.com:19302?transport=udp',
        ]
    }];

    // connection.iceServers = [{
    //     'urls': []
    // }];

    connection.videosContainer = document.getElementById('videosContainer');

    connection.onstream = function (event) {
        console.log('stream started');
        var existing = document.getElementById(event.streamid);
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }

        event.mediaElement.removeAttribute('src');
        event.mediaElement.removeAttribute('srcObject');
        event.mediaElement.muted = true;
        event.mediaElement.volume = 0;

        var video = document.createElement('video');

        try {
            video.setAttributeNode(document.createAttribute('autoplay'));
            video.setAttributeNode(document.createAttribute('playsinline'));
        } catch (e) {
            video.setAttribute('autoplay', true);
            video.setAttribute('playsinline', true);
        }

        if (event.type === 'local') {
            video.volume = 0;
            try {
                video.setAttributeNode(document.createAttribute('muted'));
            } catch (e) {
                video.setAttribute('muted', true);
            }
        }
        video.srcObject = event.stream;
        video.id = 'mediaCaptureVideo';

        var width = innerWidth - 80;
        // var mediaElement = getHTMLMediaElement(video, {
        //     title: event.userid,
        //     buttons: ['full-screen'],
        //     width: width,
        //     showOnMouseEnter: false
        // });

        connection.videosContainer.appendChild(mediaElement);

        // setTimeout(function() {
        //     mediaElement.media.play();
        // }, 5000);

        mediaElement.id = event.streamid;
        //Kill Websocket after 15 seconds
        //setTimeout(connection.socket.disconnect(true), 15000);
    };

    connection.onstreamended = function (event) {
        var mediaElement = document.getElementById(event.streamid);
        if (mediaElement) {
            mediaElement.parentNode.removeChild(mediaElement);

            if (event.userid === connection.sessionid && !connection.isInitiator) {
                alert('Broadcast is ended. We will reload this page to clear the cache.');
                location.reload();
            }
        }
    };

    connection.onMediaError = function (e) {
        if (e.message === 'Concurrent mic process limit.') {
            if (DetectRTC.audioInputDevices.length <= 1) {
                alert('Please select external microphone. Check github issue number 483.');
                return;
            }

            var secondaryMic = DetectRTC.audioInputDevices[1].deviceId;
            connection.mediaConstraints.audio = {
                deviceId: secondaryMic
            };

            connection.join(connection.sessionid);
        }
    };

    //Cast
    //Required to bypass errors that occur when trying to use native API to capture user stream
    connection.dontCaptureUserMedia = true;
    //Log the incoming stream from electron API
    console.log(screenStream);
    //Attach the stream
    connection.attachStreams = [screenStream];
    //Connect to the room and broadcast stream

    //connection.applyConstraints(streamConstraints);
    //Socket.io Message signing implementation

    connection.onopen = function (event) {
        var remoteUserId = event.userid;

        console.log('P2P data connection opened with ' + remoteUserId);
        console.log('Freeing WebSocket...');
        connection.socket.disconnect(true);

        //Clean up UI
        $('#startmenu').css('display', 'none');
        $('#qrModal').css('display', 'none');
        $('#nativeStreamGrid').css('display', 'none');
        $('#inputDemo').removeClass('hidden');
        //Allow user to set up gamepad mappings
        if (window.muvrNative) {
            $('#fieldset-gamepadMappings').removeClass('hidden');
        }



    };

    connection.beforeAddingStream = function (stream, peer) {
        if (connection.password) {
            //Generate new key and revoke trust of old keypair
            security.generateKey();
        }
        return stream
    };
    //Initiate connection
    connection.open(secureRandomRoom);


    connection.onmessage = function (message) {
        if (message.data.hasOwnProperty('rotationevent')) {
            if (window.muvrNative && settings.activeSettings.mouse == 'gyroscope') {
                gyroDesktop.moveMouse(message.data.rotationevent);
            }
            else {
                renderGraph(message.data.rotationevent);
            }
        }
        if (message.data.hasOwnProperty('clickDown')) {
            clickMouse(message.data.clickDown);
        }
        if (message.data.hasOwnProperty('gamepadAxisMove')) {
            gamepadInput.handleMessageAxis(message.data.gamepadAxisMove);
            //console.log(message.data.gamepadAxisMove);
        }
        if (message.data.hasOwnProperty('gamepadButtonPress')) {
            gamepadInput.handleMessageButton(message.data.gamepadButtonPress);
            //console.log(message.data.gamepadButtonPress);
        }

    };

};

getStreamList = function (callback) {
    //Is this being called from a native context
    if (window.ElectronDesktopCapturer) {
        //Filter out self Window
        window.getFilteredStreamList = function (streamList) {
            return streamList.streamName !== 'MUVR Caster'
        }
        window.ElectronDesktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
            var streamList = [];
            for (const source of sources) {
                streamList.push({
                    streamName: source.name,
                    dataURLImage: source.thumbnail.toDataURL()
                });
            }
            callback(streamList.filter(getFilteredStreamList));
            //console.log(streamList.filter(getFilteredStreamList));
        })
    }
    else {
        if (navigator.getDisplayMedia) {
            navigator.getDisplayMedia(getStreamConstraints('web')).then(callback)
                .catch(function (err) {
                    console.log(err);
                });
        } else if (navigator.mediaDevices.getDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia(getStreamConstraints('web')).then(callback)
                .catch(function (err) {
                    console.log(err);
                });
        }
    }

    // else {
    //     navigator.mediaDevices.getUserMedia({ video: { mediaSource: 'screen' } }).then(callback)
    //         .catch(function (err) {
    //             console.log(err);
    //         });
    // }
}

nativeSetStream = function (sourceName, streamConstraints) {
    ElectronDesktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
        for (const source of sources) {
            if (source.name === sourceName) {
                //Set stream id in constraints
                streamConstraints.video.mandatory.chromeMediaSourceId = source.id;
                navigator.mediaDevices.getUserMedia(
                    streamConstraints
                ).then((stream) => {
                    window.globalStreamHandler(stream);
                }).catch((e) => {
                    console.log(e)
                });
                //Automatically scope to the active window if not capturing full screen
                if (source.name.includes('Screen')) {
                    gyroDesktop.setScreenRect();
                    gamepadInput.setScreenRect();
                }
                else {
                    setTimeout(function () {
                        gyroDesktop.setWindowRect();
                        gamepadInput.setWindowRect();
                    }, 3000);

                }

                return
            }
        }
    })
}

function createQRCode(stringUrl, canvasId) {
    setLoadingSpinner(true);
    $.post("/api/qrcode", { data: stringUrl })
        .done(function (data) {
            $('#qr-connect').html(data);
            var modal = $('#qrModal');
            var span = $('.close');
            modal.css('display', 'block');
            span.on('click', function () {
                modal.css('display', 'none');
            });
            setLoadingSpinner(false);
            $('#viewerConnectCodeCanvas').removeClass('hidden');
        });

}

function setLoadingSpinner(trueFalse) {
    if (trueFalse) {
        $('.spinner').removeClass('hidden');
    }
    else {
        $('.spinner').addClass('hidden');
    }
}

function addGridToDOM(streamList) {
    //console.log(streamList);
    var webViewStreamList = $('div.webview-stream-list');
    $.each(streamList, function (i) {
        var gridItem = $('<div/>')
            .addClass('griditem')
            .text(streamList[i].streamName)
            .appendTo(webViewStreamList);
        var gridImage = $('<img/>')
            .addClass('gridimage')
            .attr("src", streamList[i].dataURLImage)
            .appendTo(gridItem);
        //Sets a click event handler on the grid that passes the stream name and constraints to the electron desktopCapturer API
        gridItem.on("click", function () {
            setLoadingSpinner(true);
            nativeSetStream($(this).text(), getStreamConstraints('native'));
            createQRCode("https://" + document.domain + "/app/client#" + secureRandomRoom + "!" + connection.exportedPrivateKey, "viewerConnectCodeCanvas");
            setLoadingSpinner(false);
        });
    });
    setLoadingSpinner(false);
}

function getStreamConstraints(webOrNative) {
    //Custom Constraints disabled for Alpha
    //return JSON.parse(store.getItem('streamConstraints'))
    if (webOrNative == 'web') {
        var webDefault = {
            audio: true,
            video: true
        };
        if (store.getItem('streamConstraints')) {
            console.log(store.getItem('streamConstraints'));
            return store.getItem('streamConstraints');
        }
        else {
            return webDefault
        }

    }
    //Native
    else {
        var nativeDefault = {
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop'
                },
            }
        };
        if (store.getItem('streamConstraints')) {
            var streamConstraints = store.getItem('streamConstraints');
            console.log(streamConstraints);
            nativeDefault.video.mandatory.maxWidth = streamConstraints.video.width;
            nativeDefault.video.mandatory.maxHeight = streamConstraints.video.height;
            nativeDefault.video.mandatory.maxFrameRate = streamConstraints.video.frameRate;
            console.log(nativeDefault);
            return nativeDefault
        }
        else {
            return webDefault
        }
    }
}

//Main
function rtcCasterEntryPoint() {
    if (window.muvrNative) {
        gamepadInput.init();
        //Native
        //Set loading spinner for async stream querying
        setLoadingSpinner(true);
        getStreamList(addGridToDOM);
        //Clean up UI
        $('#startmenu').css('display', 'none');
        //createQRCode("https://" + document.domain + "/app/client#" + secureRandomRoom, "viewerConnectCodeCanvas");
        console.log("https://" + document.domain + "/app/client#" + secureRandomRoom + "!" + connection.exportedPrivateKey);
    }
    else {
        //Web
        gamepadInput.init();
        getStreamList(globalStreamHandler);
        createQRCode("https://" + document.domain + "/app/client#" + secureRandomRoom + "!" + connection.exportedPrivateKey, "viewerConnectCodeCanvas");
        console.log("https://" + document.domain + "/app/client#" + secureRandomRoom + "!" + connection.exportedPrivateKey);
    }

}
$(document).ready(function () {
    //Generate signing keys upon load
    security.generateKey();
    //Setup jquery UI
    $("#settings").controlgroup();
    $("#inputSettings").controlgroup();
    $('#gamepadMapping').controlgroup();
    $('#buttonMapping').selectmenu().selectmenu("menuWidget").addClass("overflow");
    //Set up the connect button to save constraints
    settings.attachSaveEvent();
    //Check if mobile device is attempting to load the caster
    var isDeviceMobile = isMobile.detect();
    $("#dialog").dialog({
        autoOpen: false,
        width: screen.width * 0.75,
        buttons: [
            {
                text: "Ok",
                click: function () {
                    $(this).dialog("close");
                }
            }
        ]
    });
    if (isDeviceMobile && !window.muvrNative) {
        $("#dialog").dialog("open");
    }

});
