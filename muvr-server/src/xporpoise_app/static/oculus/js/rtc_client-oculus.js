
var debug = true;

if (debug == true) {
    window.onerror = function (errorMsg, url, lineNumber) {
        alert('Error: ' + errorMsg + ' Script: ' + url + ' Line: ' + lineNumber);
    };

}

function displayModeSingle() {
    var videor = $('#videor');
    videor.remove();
    var videol = $('#videol');
    videol.css('max-width', '100%');
    var content = $('#content');
    content.css('width', '100%');
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

var connection = new RTCMultiConnection();
//AutoJoin
var loadstream = function (displayMode) {
    //if (document.readyState == "complete") {
    // ......................................................
    // ..................RTCMultiConnection Code.............
    // ......................................................



    // by default, socket.io server is assumed to be deployed on your own URL
    connection.socketURL = '/';

    // comment-out below line if you do not have your own socket.io server
    // connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';

    //connection.socketMessageEvent = 'screen-sharing-demo';

    connection.session = {
        screen: true,
        oneway: true,
        data: true
    };

    connection.codecs.video = 'H264';

    // both chrome/firefox now accepts 64 kilo-bits for each data-chunk
    //connection.chunkSize = 64 * 1000;

    connection.maxRelayLimitPerUser = 1;

    //Bandwidth in kbps
    connection.bandwidth = {
        audio: 0,  // 0 kbps
        video: 20000, // 10 mbps
        screen: 10000 // 300 kbps
    };

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

    connection.videosContainer = document.getElementById('videos-container');
    connection.onstream = function (event) {
        console.log('onstream tirggers');
        var existing = document.getElementById(event.streamid);
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }

        event.mediaElement.removeAttribute('src');
        event.mediaElement.removeAttribute('srcObject');
        event.mediaElement.muted = true;
        event.mediaElement.volume = 0;

        var videol = document.createElement('video');
        var videor = document.createElement('video');
        var newVideo = document.createElement('a-video');
        var assets = document.querySelector('a-assets');

        //video.id = 'multiporpoisevideo';

        try {
            //video.setAttributeNode(document.createAttribute('autoplay'));
            videol.setAttributeNode(document.createAttribute('playsinline'));
            videol.setAttributeNode(document.createAttribute('controls'));
            videor.setAttributeNode(document.createAttribute('playsinline'));
            videor.setAttributeNode(document.createAttribute('controls'));
        } catch (e) {
            //video.setAttribute('autoplay', true);
            videol.setAttribute('playsinline', true);
            videol.setAttribute('controls', true);
            videor.setAttribute('playsinline', true);
            videor.setAttribute('controls', true);
        }

        if (event.type === 'local') {
            videol.volume = 0;
            videor.volume = 0;
            try {
                //video.setAttributeNode(document.createAttribute('muted'));
            } catch (e) {
                //video.setAttribute('muted', true);
            }
        }

        videol.id = "videol";
        videor.id = "videor";


        //assets.appendChild(video);
        connection.videosContainer.appendChild(videol);
        connection.videosContainer.appendChild(videor);

        //video.addEventListener('loadeddata', () => {


        // Pointing this aframe entity to that video as its source
        //newVideo.setAttribute('src', `#multiporpoisevideo`);
        //newVideo.setAttribute('position', '0 0 -0.35');
        //document.getElementById('cameraview').appendChild(newVideo);
        //});
        console.log(event.stream);
        videol.srcObject = event.stream;
        videor.srcObject = event.stream;
        videol.play();
        videor.play();

        //Handle Single Display Mode
        if (displayMode == 'Single') {
            displayModeSingle();
        }
        //We are connected, so we can send rotation everts over UDP now
        var camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 1100);
        var controls = new THREE.DeviceOrientationControls(camera);
        window.addEventListener('deviceorientation', function (event) {
            controls.update();
            connection.send({ "rotationevent": camera.rotation });
        });

        //Wired and Bluetooth Gamepad API events

        // joypad.set({
        //     axisMovementThreshold: 0.3
        // });

        // joypad.on('axis_move', function (e) {
        //     connection.send({ "gamepadAxisMove": e.detail });
        // });

        // joypad.on('button_press', function (e) {
        //     connection.send({ "gamepadButtonPress": e.detail });
        // });
        gamepadInput.buttonCallbackFunction = function (e) {
            connection.send({ "gamepadButtonPress": e.detail });
        };
        gamepadInput.axesCallbackFunction = function (e) {
            connection.send({ "gamepadAxisMove": e.detail });
        };
        if (gamepadInput.gamepadInitialized == false) {
            gamepadInput.initialize();
        }

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

    connection.onPeerStateChanged = function (state) {
        if (state.iceConnectionState.search(/closed|failed/gi) !== -1) {
            alert('P2P Connection dropped');
        }
    };

    //Recieve zoom event from device
    connection.onmessage = function (message) {
        if (message.data.hasOwnProperty('zoom')) {
            if (message.data.zoom == 'in') {
                zoomin();
            }
            else {
                zoomout();
            }
        }

    };

    //Connect
    connection.sdpConstraints.mandatory = {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
    };

    connection.onopen = function (event) {
        var remoteUserId = event.userid;

        console.log('P2P data connection opened with ' + remoteUserId);
        console.log('Freeing socket...');
        connection.socket.disconnect(true);
        setLoadingSpinner(false);

    };

    //connection.dontCaptureUserMedia = true;

    function waitToJoinRoom() {
        connection.checkPresence(secureRandomRoom, function (isRoomExist, roomid) {
            if (isRoomExist === true) {
                connection.join(roomid);
                clearInterval(waitOnRoom);
            }
            else {
                setLoadingSpinner(true);
            }
        });
    }

    var waitOnRoom = setInterval(waitToJoinRoom, 2000);



};

function getEmailFromStore() {
    var emailList = store.getItem('email');
    if (emailList == null) {
        return []
    }
    else {
        return emailList
    }
}

function setEmailToStore(email) {
    var emailList = store.getItem('email');
    if (emailList == null) {
        emailList = [];
        emailList.push(email);
        store.setItem('email', emailList);
    }
    else {
        if (emailList.indexOf(email) < 0) {
            emailList.push(email);
            store.setItem('email', emailList);
        }
    }
}

function sendPairingEmail(toAddress, roomId) {
    $.post("/api/email",
        {
            toAddress: toAddress,
            room: roomId
        }).done(function (data) {
            console.log('Sent Email')
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

function detectiOS13() {
    //iPhone OS 13_
    if (navigator.userAgent.includes('iPhone OS 13_')) {
        return true;
    }
    else {
        return false;
    }
}

function zoomout() {
    var currHeight = Number($('#videol').css('max-width').split('%')[0]);
    var newHeight = (currHeight - 5) + '%';
    //var offSetTop = ((window.innerHeight / 2) - ((currHeight - 20) / 2)) + 'px';
    //$('#content').css('top', offSetTop);
    $('#videol').css('max-width', newHeight);
    $('#videor').css('max-width', newHeight);
}

function zoomin() {
    var currHeight = Number($('#videol').css('max-width').split('%')[0]);
    var newHeight = (currHeight + 5) + '%';
    //var offSetTop = ((window.innerHeight / 2) - ((currHeight - 20) / 2)) + 'px';
    //$('#content').css('top', offSetTop);
    $('#videol').css('max-width', newHeight);
    $('#videor').css('max-width', newHeight);
}

//Load and manipulate UI
function userInitiatedLoadStream() {
    if (detectiOS13()) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(function () {
                //Get displaymode
                var displayMode = $('#displayMode').val();
                //Remove start stream button
                document.getElementById('fieldset-displaysettings').remove();
                //Remove Logo
                document.getElementById('logo').remove();
                //Attach headphone input
                boopClickHeadphone.registerMainLoop(function (clickDown) {
                    connection.send({ "clickDown": clickDown });
                });
                //Sign message that authenticates client
                //RTC Connect and setup up video elemts
                if (!displayMode.includes('Default')) {
                    loadstream('Single');
                }
                else {
                    loadstream('Double');
                }

                //Connect to websocket and move mouse
                //connectAndEmitRotationEvents();
            })
        }
    }
    else {
        //Get displaymode
        var displayMode = $('#displayMode').val();
        //Remove start stream button
        document.getElementById('fieldset-displaysettings').remove();
        //Remove Logo
        document.getElementById('logo').remove();
        //Attach headphone input
        boopClickHeadphone.registerMainLoop(function (clickDown) {
            connection.send({ "clickDown": clickDown });
        });
        //RTC Connect and setup up video elemts
        loadstream('Single');
        //loadstream();
        try {
            document.body.requestFullscreen();
        }
        catch (e) { }

        //Connect to websocket and move mouse
        //connectAndEmitRotationEvents();
    }
}

$(document).ready(function () {
    //Import private key on startup
    //security.importKey();
    //Set up display settings

    $("#autocomplete").autocomplete({
        source: getEmailFromStore()
    });
    $("#displaySettings").controlgroup();
    $("#connect").on("click", function () {
        setEmailToStore($("#autocomplete").val());
        sendPairingEmail($("#autocomplete").val(), secureRandomRoom);
        userInitiatedLoadStream();
    });

});


