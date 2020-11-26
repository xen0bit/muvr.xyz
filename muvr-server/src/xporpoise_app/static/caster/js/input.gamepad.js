var gamepadInput = (function () {
    return {
        init: function () {
            var mouseSettings = store.getItem('inputSettings');
            if (mouseSettings.mouse == 'gamepad') {
                gamepadInput.mouse = true;
            }
            else {
                gamepadInput.mouse = false;
            }
            if (mouseSettings.click == 'gamepad') {
                //Load mappings
                gamepadInput.click = true;
            }
            else {
                gamepadInput.click = false;
            }
        },
        gamepadLogger: function (message) {
            var currentVal = $('#gamepadLogs').val();
            var newVal;
            var d = new Date();
            var n = d.getTime();
            newVal = n.toString() + ' ' + JSON.stringify(message);

            $('#gamepadLogs').val(newVal);
        },
        handleMessageAxis: function (message) {
            if (window.muvrNative) {
                if (gamepadInput.mouse) {
                    gamepadInput.moveMouse(message);
                }
                // else {
                //     //Need to allow user to set bindings later
                //     gamepadInput.gamepadLogger(message);
                // }
            }
            else {
                gamepadInput.gamepadLogger(message);
            }
        },
        handleMessageButton: function (message) {
            if (!gamepadInput.click) {
                gamepadInput.gamepadLogger(message);
            }
            if (gamepadInput.click) {
                //If active mappings are not set, intercept button press and allow user to map it.
                if (!gamepadInput.activeMappingsSet) {
                    gamepadInput.activelySettingGamepadButton = message;
                    $('#activelySettingGamepadButton').text(JSON.stringify(message));
                }
                else {
                    gamepadInput.pressInput(message);
                }

            }
        },
        getWindowRect: function () {
            return [gamepadInput.activeWindowX, gamepadInput.activeWindowY, gamepadInput.activeWindowW, gamepadInput.activeWindowH]
        },
        setWindowRect: function () {
            xgo.GetActiveBoundingRect(
                function (x, y, w, h) {
                    gamepadInput.activeWindowX = x;
                    gamepadInput.activeWindowY = y;
                    gamepadInput.activeWindowW = w;
                    gamepadInput.activeWindowH = h;
                    //Windows (10) Aero has an invisble -7 x border
                    gamepadInput.activeWindowX += 7;
                    gamepadInput.activeWindowW -= 7;

                });
        },
        setScreenRect: function () {
            xgo.GetScreenSize(
                function (w, h) {
                    gamepadInput.activeWindowX = 0;
                    gamepadInput.activeWindowY = 0;
                    gamepadInput.activeWindowW = w;
                    gamepadInput.activeWindowH = h;
                });
        },
        setCapturedMousePos: function () {
            xgo.GetMousePos(
                function (x, y) {
                    gamepadInput.capturedMousePosX = x;
                    gamepadInput.capturedMousePosY = y;
                });
        },
        getMouseCaptured: function (deadzone) {
            //Used to check whether a First Person Shooter style game has read a frame and updated it's camera yet
            xgo.GetMousePos(
                function (x, y) {
                    var deltaX = Math.abs(gamepadInput.capturedMousePosX - x);
                    var deltaY = Math.abs(gamepadInput.capturedMousePosY - y);
                    if ((deltaX < deadzone) && (deltaY < deadzone)) {
                        gamepadInput.mouseCaptured = true;
                    }
                    else {
                        gamepadInput.mouseCaptured = false;
                    }
                });
            //console.log(capturedMousePos);
            return gamepadInput.mouseCaptured

        },
        moveMouse: function (message) {
            //Example message
            //{"name":"axes_1","stickMoved":"left_stick","axesDirectionsOfMovement":"bottom","value":0.1165008544921875}
            //Move mouse by axis input
            if (gamepadInput.mouseBaseCoordinatesSet && (message.stickMoved == 'left_stick')) {
                var mouseSpeed = 10;
                //Set new coordinates to current position
                //We will modify them
                var newX = gamepadInput.currentMousePosX;
                var newY = gamepadInput.currentMousePosY;
                //Left
                if (message.axesDirectionsOfMovement == "left") {
                    newX = newX - Math.ceil(Math.abs(message.value) * mouseSpeed);
                }
                if (message.axesDirectionsOfMovement == "right") {
                    newX = newX + Math.ceil(Math.abs(message.value) * mouseSpeed);
                }
                if (message.axesDirectionsOfMovement == "bottom") {
                    newY = newY - Math.ceil(Math.abs(message.value) * mouseSpeed);
                }
                if (message.axesDirectionsOfMovement == "top") {
                    newY = newY + Math.ceil(Math.abs(message.value) * mouseSpeed);
                }

                //Actually move the mouse
                xgo.MoveMouse(newX, newY);
                //Swap coordinates with new calculated values without querying with golang
                //This is less accurate, but prevents glitchy mouse behavior
                gamepadInput.currentMousePosX = newX;
                gamepadInput.currentMousePosY = newY;
            }
            if (message.stickMoved == 'right_stick' && gamepadInput.rightAnalogForScroll) {
                var defaultScrollMagnitude = 2;
                if (message.axesDirectionsOfMovement == "bottom") {
                    xgo.ScrollMouse(defaultScrollMagnitude, "down");
                }
                if (message.axesDirectionsOfMovement == "top") {
                    xgo.ScrollMouse(defaultScrollMagnitude, "up");
                }
            }
            else {
                xgo.GetMousePos(
                    function (x, y) {
                        gamepadInput.currentMousePosX = x;
                        gamepadInput.currentMousePosY = y;
                    });
                gamepadInput.mouseBaseCoordinatesSet = true;

                if (!gamepadInput.rightAnalogForScroll) {
                    var inputSettings = store.getItem('inputSettings');
                    gamepadInput.rightAnalogForScroll = inputSettings.scroll;
                }
            }

        },
        pressInput: function (message) {
            //Example message
            //{"buttonName":"button_0","button":{},"index":0,"gamepad":{}}
            if (message.buttonName in gamepadInput.activeMappingsSet) {
                var action = gamepadInput.activeMappingsSet[message.buttonName];
                //Mouse
                if (action === 'Mouse Click L') {
                    if (message.value == 1) {
                        xgo.MouseToggle("down", "left");
                    }
                    else {
                        xgo.MouseToggle("up", "left");
                    }
                }
                if (action === 'Mouse Click M') {
                    if (message.value == 1) {
                        xgo.MouseToggle("down", "middle");
                    }
                    else {
                        xgo.MouseToggle("up", "middle");
                    }
                }
                if (action === 'Mouse Click R') {
                    if (message.value == 1) {
                        xgo.MouseToggle("down", "right");
                    }
                    else {
                        xgo.MouseToggle("up", "right");
                    }
                }
                //Keyboard
                if (action.includes('Keyboard')) {
                    var key = action.split(' ')[1];
                    if (message.value == 1) {
                        xgo.KeyToggle(key, "down");
                    }
                    else {
                        xgo.KeyToggle(key, "up");
                    }
                }
            }
        }
    }

})();