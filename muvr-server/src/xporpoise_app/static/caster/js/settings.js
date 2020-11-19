var settings = (function () {
    return {
        setStreamConstraints: function (width, height, fps) {
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
        },
        setMode: function (onOff) {
            if (onOff == 'on') {
                store.setItem('mode', { viewOnly: true });
            }
            else {
                store.setItem('mode', { viewOnly: false });
            }

        },
        saveInputSettings: function (mouseAxis, mouseClick, mouseScroll) {
            var mouseAxisSetting, mouseClickSetting;
            if (mouseAxis.includes('Gyroscope')) {
                mouseAxisSetting = 'gyroscope';
            }
            else {
                mouseAxisSetting = 'gamepad';
            }
            if (mouseClick.includes('Plick')) {
                mouseClickSetting = 'plick';
            }
            else {
                mouseClickSetting = 'gamepad';
            }
            if (mouseScroll) {
                mouseScrollSetting = true;
            }
            else {
                mouseScrollSetting = false;
            }
            //Save
            store.setItem('inputSettings',
                {
                    mouse: mouseAxisSetting,
                    click: mouseClickSetting,
                    scroll: mouseScrollSetting
                });

            settings.activeSettings = {
                mouse: mouseAxisSetting,
                click: mouseClickSetting,
                scroll: mouseScrollSetting
            };
        },
        setMapping: function () {
            //init object if not exist
            if (!gamepadInput.mappings) {
                gamepadInput.mappings = {};
            }
            //{"buttonName":"button_0","button":{},"index":0,"gamepad":{}}
            var key = gamepadInput.activelySettingGamepadButton.buttonName;
            gamepadInput.mappings[key] = $('#buttonMapping').val();

        },
        reloadMapping: function () {
            //Set mappings to active
            gamepadInput.activeMappingsSet = gamepadInput.mappings;
            //Re-init Gamepad
            gamepadInput.init();
        },
        resetMapping: function () {
            gamepadInput.activeMappingsSet = undefined;
            gamepadInput.mappings = undefined;
        },
        getWAndHFromText: function (text) {
            //Example input
            //320x240 (QVGA)
            var width = parseInt(text.split(' ')[0].split('x')[0]);
            var height = parseInt(text.split(' ')[0].split('x')[1])
            return [width, height]
        },
        getFpsFromText: function (text) {
            //Example input
            //'30'
            return parseInt(text)
        },
        attachSaveEvent: function () {
            $('#savebutton').on('click', function () {
                var textResolution = $('#Resolution').val();
                var textFps = $('#fps').val();
                var intArrayResolution = settings.getWAndHFromText(textResolution);
                var intFps = settings.getFpsFromText(textFps);
                var viewOnly = $('#view-only-mode:checked').val();
                //Clear existing config
                //store.clear();
                //Save the junk
                settings.setStreamConstraints(intArrayResolution[0], intArrayResolution[1], intFps);
                settings.setMode(viewOnly);
                //Input settings
                var mouseAxis = $('#mouseAxis').val();
                var mouseClick = $('#mouseClick').val();
                var mouseScroll = $('#right-analog-scroll:checked').val();
                settings.saveInputSettings(mouseAxis, mouseClick, mouseScroll);
                //
                //Kick off the main casting function
                rtcCasterEntryPoint();
            });
            // $('#saveinputbutton').on('click', function () {
            //     var mouseAxis = $('#mouseAxis').val();
            //     var mouseClick = $('#mouseClick').val();
            //     settings.saveInputSettings(mouseAxis, mouseClick);
            // });

            $('#setmappingbutton').on('click', function () {
                settings.setMapping();
            });

            $('#reloadallmappingsbutton').on('click', function () {
                settings.reloadMapping();
            });

            $('#resetallmappingsbutton').on('click', function () {
                settings.resetMapping();
            });

        }
    }

})();