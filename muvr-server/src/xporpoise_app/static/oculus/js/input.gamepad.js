var rAF = window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.requestAnimationFrame;
var gamepadInput = (function () {
    return {
        haveEvents: 'GamepadEvent' in window,
        haveWebkitEvents: 'WebKitGamepadEvent' in window,
        gamepadInitialized: false,
        gamepadButtonState: [],
        gamepadAxesState: [],
        buttonEventListener: function (buttonIndex) {
            var buttonName = 'button_' + buttonIndex;
            window.addEventListener(buttonName, function (e) {
                gamepadInput.buttonCallbackFunction(e);
            });
        },
        buttonEventDisaptcher: function (buttonIndex, buttonValue) {
            var name = 'button_' + buttonIndex;
            var buttonEvent = new CustomEvent(name, {
                detail: {
                    buttonName: name,
                    value: buttonValue
                }
            });
            window.dispatchEvent(buttonEvent);
        },
        axesEventListener: function (axesIndex) {
            var axesName = 'axes_' + axesIndex;
            window.addEventListener(axesName, function (e) {
                gamepadInput.axesCallbackFunction(e);
            });
        },
        axesEventDisaptcher: function (axesIndex, axesValue) {
            var axesName = 'axes_' + axesIndex;
            //labels axes
            var axesStickMoved = Math.floor(axesIndex / 2);
            if (axesStickMoved == 0) {
                axesStickMoved = 'left_stick';
            }
            if (axesStickMoved == 1) {
                axesStickMoved = 'right_stick';
            }
            //label direction of movement
            var directionOfMovement = '';
            //Axes 0
            if (axesIndex == 0) {
                if (axesValue >= 0) {
                    directionOfMovement = 'right';
                }
                if (axesValue == 0) {
                    directionOfMovement = 'center';
                }
                if (axesValue <= 0) {
                    directionOfMovement = 'left';
                }
            }
            //Axes 1
            if (axesIndex == 1) {
                if (axesValue >= 0) {
                    directionOfMovement = 'bottom';
                }
                if (axesValue == 0) {
                    directionOfMovement = 'center';
                }
                if (axesValue <= 0) {
                    directionOfMovement = 'top';
                }
            }
            //Axes 2
            if (axesIndex == 2) {
                if (axesValue >= 0) {
                    directionOfMovement = 'right';
                }
                if (axesValue == 0) {
                    directionOfMovement = 'center';
                }
                if (axesValue <= 0) {
                    directionOfMovement = 'left';
                }
            }
            //Axes 3
            if (axesIndex == 3) {
                if (axesValue >= 0) {
                    directionOfMovement = 'bottom';
                }
                if (axesValue == 0) {
                    directionOfMovement = 'center';
                }
                if (axesValue <= 0) {
                    directionOfMovement = 'top';
                }
            }

            var axesEvent = new CustomEvent(axesName, {
                detail: {
                    name: axesName,
                    stickMoved: axesStickMoved,
                    axesDirectionsOfMovement: directionOfMovement,
                    value: axesValue
                }
            });
            window.dispatchEvent(axesEvent);
        },
        axisPassesThreshold: function (a) {
            var axesThreshold = 0.1;
            if (Math.abs(a) > axesThreshold) {
                return true
            }
            else {
                return false
            }
        },
        monitorLoop: function () {
            let gamepads = window.navigator.getGamepads();
            gamepads = Array.prototype.slice.call(gamepads);

            // Loop all the gamepads on each frame
            gamepads.forEach((gamepad, index) => {
                if (gamepad) {
                    if (gamepadInput.gamepadInitialized == true) {
                        //Buttons
                        for (i = 0; i < gamepad.buttons.length; i++) {
                            if (gamepad.buttons[i].value != gamepadInput.gamepadButtonState[i]) {
                                gamepadInput.buttonEventDisaptcher(i, gamepad.buttons[i].value);
                                //Set state for next comparison
                                gamepadInput.gamepadButtonState[i] = gamepad.buttons[i].value;
                            }
                        }
                        //Axes
                        for (i = 0; i < gamepad.axes.length; i++) {
                            //Axes value not equal to previous value, trigger event if it passes threshold
                            if (gamepad.axes[i] != gamepadInput.gamepadAxesState[i]) {
                                if (gamepadInput.axisPassesThreshold(gamepad.axes[i])) {
                                    gamepadInput.axesEventDisaptcher(i, gamepad.axes[i]);
                                    //Set state for next comparison
                                    gamepadInput.gamepadAxesState[i] = gamepad.axes[i];
                                }

                            }
                            //Axes value is equal to previous value (stick is being held in place)
                            else {
                                //Axes value is equal to previous value, but passes threshold (non-zero)
                                if (gamepadInput.axisPassesThreshold(gamepad.axes[i])) {
                                    gamepadInput.axesEventDisaptcher(i, gamepad.axes[i]);
                                    //Set state for next comparison
                                    gamepadInput.gamepadAxesState[i] = gamepad.axes[i];
                                }
                                //Axes Value does not pass threshold and should result in zero for value
                                else {
                                    gamepadInput.axesEventDisaptcher(i, 0);
                                    gamepadInput.gamepadAxesState[i] = 0;
                                }
                            }
                        }
                    }
                    else {
                        //initialize Gamepad values
                        for (i = 0; i < gamepad.buttons.length; i++) {
                            gamepadInput.gamepadButtonState.push(gamepad.buttons[i].value);
                            gamepadInput.buttonEventListener(i);
                        }
                        for (i = 0; i < gamepad.axes.length; i++) {
                            gamepadInput.gamepadAxesState.push(gamepad.axes[i]);
                            gamepadInput.axesEventListener(i);
                        }
                        gamepadInput.id = gamepad.id;
                        gamepadInput.gamepadInitialized = true;
                    }

                }

            });

            rAF(gamepadInput.monitorLoop);

        },
        initialize: function () {
            if (gamepadInput.haveEvents) {
                window.addEventListener("gamepadconnected", gamepadInput.monitorLoop);
                window.addEventListener("gamepaddisconnected", gamepadInput.monitorLoop);
            } else if (gamepadInput.haveWebkitEvents) {
                window.addEventListener("webkitgamepadconnected", gamepadInput.monitorLoop);
                window.addEventListener("webkitgamepaddisconnected", gamepadInput.monitorLoop);
            }
        }
    }


})();

// gamepadInput.buttonCallbackFunction = function(e){console.log(e.detail);};
// gamepadInput.axesCallbackFunction = function(e){console.log(e.detail);};
// gamepadInput.initialize();