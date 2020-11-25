var robot = require("robotjs");
module.exports.clickDown = function (clickDown) {
	if(clickDown == true){
		robot.mouseToggle('down', 'left');
	}
	if(clickDown == false){
		robot.mouseToggle('up', 'left');
	}
};