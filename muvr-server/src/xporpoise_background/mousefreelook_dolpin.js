var robot = require("robotjs");


//Gamecube internal resolution is 640x528
currMousePosition = undefined;
startingMousePosX = undefined;
startingMousePosY = undefined;
gamecubeInternalXResolution = 640;
gamecubeInternalYResolution = 528;
mousePosX = (gamecubeInternalXResolution / 2);
mousePosY = (gamecubeInternalYResolution / 2);
isRightMouseDown = false;

module.exports.lookAt = function (euler) {
	if (isRightMouseDown == false) {
		robot.setMouseDelay(0);
		robot.moveMouse(400, 300);
		robot.mouseClick();
		//robot.mouseToggle("down", "right");
		isRightMouseDown = true;
		currMousePosition = robot.getMousePos();
		startingMousePosX = currMousePosition.x;
		startingMousePosY = currMousePosition.y;

	}
	else {
			//console.log('frame has reset');
			newMousePosX = ((euler['_y'] * -1) + 1) * (gamecubeInternalXResolution / 2);
			newMousePosY = (((euler['_x'] * -1) + 1)) * (gamecubeInternalYResolution / 2);
			/*
			if (newMousePosX > gamecubeInternalXResolution) {
				newMousePosX = gamecubeInternalXResolution;
			}
			if (newMousePosX < 0) {
				newMousePosX = 0;
			}
			if (newMousePosY > gamecubeInternalYResolution) {
				newMousePosY = gamecubeInternalYResolution;
			}
			if (newMousePosY < 0){
				newMousePosY = 0;
			}
			*/
			//console.log(newMousePosX, newMousePosY);
			robot.moveMouse(newMousePosX, newMousePosY);
	}

};