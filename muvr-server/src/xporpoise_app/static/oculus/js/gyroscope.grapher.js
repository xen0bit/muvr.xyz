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
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            ctx.fillStyle = 'black';
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
            var radius = 5;
            var centerX = canvasElement.width/2;
            var centerY = canvasElement.height/2;
            ctx.fillStyle = 'red';
            //Draw Circular point
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
            ctx.fill();
        }

    }

})();