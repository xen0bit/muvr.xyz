var robot = require("robotjs");


//Gamecube internal resolution is 640x528
currMousePosition = undefined;
startingMousePosX = undefined;
startingMousePosY = undefined;
gamecubeInternalXResolution = 640;
gamecubeInternalYResolution = 480;
mousePosX = (gamecubeInternalXResolution / 2);
mousePosY = (gamecubeInternalYResolution / 2);
isRightMouseDown = false;

module.exports.lookAt = function (euler) {
	if (isRightMouseDown == false) {
		robot.setMouseDelay(0);
		//robot.moveMouse(391, 297);
		robot.mouseClick();
		//robot.mouseToggle("down", "right");
		isRightMouseDown = true;
		currMousePosition = robot.getMousePos();
		startingMousePosX = currMousePosition.x;
		startingMousePosY = currMousePosition.y;

	}
	else {
            //console.log('frame has reset');
            
			vrMousePosX = ((euler['_y'] * -1) + 1) * (gamecubeInternalXResolution / 2);
            vrMousePosY = (((euler['_x'] * -1) + 1)) * (gamecubeInternalYResolution / 2);
            //deltaX = vrMousePosX - startingMousePosX;
            //deltaY = vrMousePosY - startingMousePosY;
            //Set in-memory values ot current loop for delta calculation next round
            //startingMousePosX = vrMousePosX;
            //startingMousePosY = vrMousePosY;


            
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
            //console.log(391+deltaX, 297+deltaY);
			robot.moveMouse(vrMousePosX, vrMousePosY);
		}

};