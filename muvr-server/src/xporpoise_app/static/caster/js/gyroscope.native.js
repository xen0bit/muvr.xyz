var gyroDesktop = (function () {
    return {
        getWindowRect: function () {
            return [gyroDesktop.activeWindowX, gyroDesktop.activeWindowY, gyroDesktop.activeWindowW, gyroDesktop.activeWindowH]
        },
        setWindowRect: function () {
            xgo.GetActiveBoundingRect(
                function (x, y, w, h) {
                    gyroDesktop.activeWindowX = x;
                    gyroDesktop.activeWindowY = y;
                    gyroDesktop.activeWindowW = w;
                    gyroDesktop.activeWindowH = h;
                    //Windows (10) Aero has an invisble -7 x corder
                    gyroDesktop.activeWindowX += 7;
                    gyroDesktop.activeWindowW -= 7;

                });
        },
        setScreenRect: function () {
            xgo.GetScreenSize(
                function (w, h) {
                    gyroDesktop.activeWindowX = 0;
                    gyroDesktop.activeWindowY = 0;
                    gyroDesktop.activeWindowW = w;
                    gyroDesktop.activeWindowH = h;
                });
        },
        setCapturedMousePos: function () {
            xgo.GetMousePos(
                function (x, y) {
                    gyroDesktop.capturedMousePosX = x;
                    gyroDesktop.capturedMousePosY = y;
                });
        },
        getMouseCaptured: function (deadzone) {
            //Used to check whether a First Person Shooter style game has read a frame and updated it's camera yet
            xgo.GetMousePos(
                function (x, y) {
                    var deltaX = Math.abs(gyroDesktop.capturedMousePosX - x);
                    var deltaY = Math.abs(gyroDesktop.capturedMousePosY - y);
                    if ((deltaX < deadzone) && (deltaY < deadzone)) {
                        gyroDesktop.mouseCaptured = true;
                    }
                    else {
                        gyroDesktop.mouseCaptured = false;
                    }
                });
            //console.log(capturedMousePos);
            return gyroDesktop.mouseCaptured

        },
        eulerToXY: function (euler) {
            var coordinates = gyroDesktop.getWindowRect();
            var x = coordinates[0];
            var y = coordinates[1];
            var w = coordinates[2];
            var h = coordinates[3];

            vrMousePosX = (((euler['_y'] * -1.5) + 1) * (w / 2)) + x;
            vrMousePosY = (((euler['_x'] * -1.5) + 1) * (h / 2)) + y;

            if (vrMousePosX > x + w) {
                vrMousePosX = x + w;
            }
            if (vrMousePosX < x) {
                vrMousePosX = x;
            }
            if (vrMousePosY > y + h) {
                vrMousePosY = y + h;
            }
            if (vrMousePosY < y) {
                vrMousePosY = y;
            }
            return [vrMousePosX, vrMousePosY]
        },
        eulerToRotationXY: function (euler) {
            var coordinates = gyroDesktop.getWindowRect();
            var x = coordinates[0];
            var y = coordinates[1];
            var w = coordinates[2];
            var h = coordinates[3];

            vrMousePosX = (((euler['_y'] * -1.5) + 1) * (w / 2)) + x;
            vrMousePosY = (((euler['_x'] * -1.5) + 1) * (h / 2)) + y;

            if (vrMousePosX > x + w) {
                vrMousePosX = x + w;
            }
            if (vrMousePosX < x) {
                vrMousePosX = x;
            }
            if (vrMousePosY > y + h) {
                vrMousePosY = y + h;
            }
            if (vrMousePosY < y) {
                vrMousePosY = y;
            }
            return [vrMousePosX, vrMousePosY]
        },
        moveMouse: function (euler) {
            var pointCoordinates = gyroDesktop.eulerToXY(euler);
            xgo.MoveMouse(pointCoordinates[0], pointCoordinates[1]);
        }

    }

})();