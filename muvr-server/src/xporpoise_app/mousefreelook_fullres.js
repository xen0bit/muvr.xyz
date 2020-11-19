var robot = require("robotjs");


//Gamecube internal resolution is 640x528
windowXResolution = 1;
windowYResolution = 1;
windowXOffset = 1;
windowYOffset = 1;

dolphinMode = false;
dolphinMouseDown = false;

robot.setMouseDelay(0);

module.exports.setWindowResolution = function (rect) {
	windowXResolution = rect.right - rect.left;
	windowYResolution = rect.bottom - rect.top;
	windowXOffset = rect.left;
	windowYOffset = rect.top;
};

module.exports.setDolphinMode = function (bool) {
	dolphinMode = bool;
};

module.exports.lookAt = function (euler) {
	if (dolphinMode == true && dolphinMouseDown == false) {
		//Move mouse to center of dolphin window
		vrMousePosX = windowXResolution / 2;
		vrMousePosY = windowYResolution / 2;
		vrMousePosX += windowXOffset;
		vrMousePosY += windowYOffset;
		robot.moveMouse(vrMousePosX, vrMousePosY);

		//Left click to activate window
		robot.mouseClick('left');
		//Send right click to a 'down' state to enable looking around
		//who tf wrote this api that switches the order of arguments for the button...
		robot.mouseToggle('down', 'right');
		dolphinMouseDown = true;

	}

	vrMousePosX = ((euler['_y'] * -1.5) + 1) * (windowXResolution / 2);
	vrMousePosY = ((euler['_x'] * -1.5) + 1) * (windowYResolution / 2);
	vrMousePosX += windowXOffset;
	vrMousePosY += windowYOffset;

	if (vrMousePosX > (windowXResolution + windowXOffset)) {
		vrMousePosX = (windowXResolution + windowXOffset);
	}
	if (vrMousePosX < windowXOffset) {
		vrMousePosX = windowXOffset;
	}
	if (vrMousePosY > (windowYResolution + windowYOffset)) {
		vrMousePosY = (windowYResolution + windowYOffset);
	}
	if (vrMousePosY < windowYOffset) {
		vrMousePosY = windowYOffset;
	}

	robot.moveMouse(vrMousePosX, vrMousePosY);

};