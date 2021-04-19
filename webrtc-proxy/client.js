function hasUserMedia() {
    // Checks whether browser supports WebRTC
    return !!(
        navigator.getUserMedia || // Safari
        navigator.webkitGetUserMedia || // Chrome
        navigator.mozGetUserMedia // Firefox
    );
}

if (hasUserMedia()) {
    // Find function based on browser
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    navigator.getUserMedia({ video: true, audio: true }, (stream) => {
        // get video element
        var video = document.querySelector('video');

        video.srcObject = stream;
    }, (error) => {
        // Error
        console.log(error);
    });
} else {
    // Browser does not support WebRTC
    alert("Your browser does not support WebRTC");
}