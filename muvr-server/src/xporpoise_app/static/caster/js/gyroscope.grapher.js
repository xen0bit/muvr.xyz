var gyroGraph = (function () {
    return {
        setupGraphCanvas: function (width, height, canvasId) {
            //Create Audio Element
            var canvasElement = document.createElement('CANVAS');
            canvasElement.width = width;
            canvasElement.height = height;
            canvasElement.id = canvasId;
            return canvasElement
        },
        //Must be called by user interaction
        drawQuadrants: function (canvasElement) {
            var ctx = canvasElement.getContext('2d');
            //clear canvas
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
            ctx.strokeStyle = 'white';
            //Draw Y axis
            ctx.beginPath();
            ctx.moveTo(canvasElement.width / 2, 0);
            ctx.lineTo(canvasElement.width / 2, canvasElement.height);
            ctx.stroke();
            //Draw X axis
            ctx.beginPath();
            ctx.moveTo(0, canvasElement.height / 2);
            ctx.lineTo(canvasElement.width, canvasElement.height / 2);
            ctx.stroke();
        },
        drawPoint: function (x, y, canvasElement) {
            var ctx = canvasElement.getContext('2d');
            var radius = 25;
            //var centerX = canvasElement.width/2;
            //var centerY = canvasElement.height/2;
            ctx.fillStyle = 'red';
            //Draw Circular point
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2*Math.PI, false);
            ctx.fill();
        },
        eulerToXY: function(euler, canvasElement){
            vrMousePosX = ((euler['_y'] * -1.5) + 1) * (canvasElement.width / 2);
            vrMousePosY = ((euler['_x'] * -1.5) + 1) * (canvasElement.height / 2);

            if (vrMousePosX > canvasElement.width) {
                vrMousePosX = canvasElement.width;
            }
            if (vrMousePosX < 0) {
                vrMousePosX = 0;
            }
            if (vrMousePosY > canvasElement.height) {
                vrMousePosY = canvasElement.height;
            }
            if (vrMousePosY < 0) {
                vrMousePosY = 0;
            }
            return [vrMousePosX, vrMousePosY]
        },
        renderEuler: function (canvasElement, euler){
            gyroGraph.drawQuadrants(canvasElement);
            var pointCoordinates = gyroGraph.eulerToXY(euler, canvasElement);
            gyroGraph.drawPoint(pointCoordinates[0], pointCoordinates[1], canvasElement);
        }

    }

})();