//Instantiate WebGL Canvas
var glCanvas = fx.canvas();
glCanvas.id = 'glCanvas';
var mediaCaptureVideo;

function setMediaCaptureVideo(stream) {
    console.log('hit setMediaCaptureVideo');
    console.log(stream);
    var videosContainer = document.getElementById('videosContainer');
    mediaCaptureVideo = document.createElement('video');
    try {
        mediaCaptureVideo.setAttributeNode(document.createAttribute('autoplay'));
        mediaCaptureVideo.setAttributeNode(document.createAttribute('playsinline'));
    } catch (e) {
        mediaCaptureVideo.setAttribute('autoplay', true);
        mediaCaptureVideo.setAttribute('playsinline', true);
    }
    mediaCaptureVideo.srcObject = stream;
    mediaCaptureVideo.id = 'mediaCaptureVideo';
    videosContainer.appendChild(mediaCaptureVideo);

}

function renderLoop() {
    var texture = glCanvas.texture(mediaCaptureVideo);
    glCanvas.draw(texture, 1280, 960)
        .bulgePinch(320, 240, 240, 1)
        .update();
    //Garbage Collection
    texture.destroy();
    //Recursive rendering when page ready
    requestAnimationFrame(renderLoop);
}

function attachGlCanvas2DOM(parentSelector) {
    //$(glCanvas).css('display', 'none');
    $(parentSelector).append(glCanvas);
}

function startRender() {
    //setMediaCaptureVideo('mediaCaptureVideo');
    attachGlCanvas2DOM('#videosContainer');
    renderLoop();
}

function getGlCanvasStream(callback){
    var glStream = glCanvas.captureStream(60); // 60 FPS
    callback(glStream)
}