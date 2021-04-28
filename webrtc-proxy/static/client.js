const serverIP = "localhost"; // for local testing
//const serverIP = "212.130.120.89"; // for public testing
const serverPort = "8074";

// Variables

var webSocket;
var username = "";
var localStream;
var localConnection;

// UI elements

var loginInput = document.getElementById("loginInput");
var loginBtn = document.getElementById("loginBtn");

var msgInput = document.getElementById("msgInput");
var sendBtn = document.getElementById("sendBtn");

var chatTxt = document.getElementById("chatTxt");

var joinCallBtn = document.getElementById("joinCallBtn");

var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");

msgInput.disabled = true;
sendBtn.disabled = true;
chatTxt.disabled = true;
joinCallBtn.disabled = true;

// Login button
loginBtn.addEventListener("click", (event) => {
    if (loginInput.value) {
        username = loginInput.value;

        // WebSocket initiation

        if (!webSocket) { // Connect WebSocket if not already
            var url = `${serverIP}:${serverPort}`;
            console.log(`Client connecting to WebSocket: ${url}`);
            webSocket = new WebSocket(`wss://${url}`);
        }

        webSocket.onopen = () => {
            console.log("Client connected to WebSocket");
            send({
                type: "login"
            });
            console.log("User logged in: " + username);
        };

        webSocket.onmessage = (message) => {
            // Parse message data from JSON
            var data = JSON.parse(message.data);

            // Exclude types which flood the console
            if (data.type !== "offer" && data.type !== "answer" && data.type !== "canvasUpdate") {
                console.log("Message received: " + message);
            }

            switch (data.type) {
                case "login": // Login attempt response
                    onLogin(data.success);
                    break;
                case "chat": // Incoming chat
                    onChat(data);
                    break;
                case "offer":
                    console.log("Offer received from: " + data.name);
                    onOffer(data.offer, data.name);
                    break;
                case "answer":
                    console.log("Answer received from: " + data.name);
                    onAnswer(data.answer);
                    break;
                case "canvasUpdate":
                    console.log("Canvas update received from " + data.name);
                    onCanvasUpdate(data);
                    break;
            }
        };

        // WebRTC initiation

        if (hasUserMedia()) {
            // Find function based on browser
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            navigator.getUserMedia({ video: true, audio: true }, (stream) => {
                localStream = stream;

                localConnection = new webkitRTCPeerConnection();
                localConnection.addStream(localStream);
                // When a stream is added to localConnection 
                localConnection.onaddstream = (event) => {
                    remoteVideo.srcObject = event.stream;
                };
            }, (error) => {
                // Error
                console.log(error);
            });
        } else {
            // Browser does not support WebRTC
            alert("Your browser does not support WebRTC")
        }
    }
});

// KeyUp listener for loginInput
loginInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        loginBtn.click();
    }
});

// Send button
sendBtn.addEventListener("click", (event) => {
    if (msgInput.value) {
        var msg = msgInput.value;
        console.log("Sending chat message: " + msg);
        // Send message to proxy server
        send({
            type: "chat",
            message: msg
        });
        msgInput.value = "";
    }
});

// KeyUp listener for msgInput
msgInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendBtn.click();
    }
});

// Join call button
joinCallBtn.addEventListener("click", (event) => {
    localVideo.srcObject = localStream;
    joinCallBtn.disabled = true;

    localConnection.createOffer((offer) => {
        send({
            type: "offer",
            offer: offer
        });
        localConnection.setLocalDescription(offer);
    }, (error) => {
        console.log("Error creating an offer");
    });
}, (error) => {
    // Error
    console.log(error);
});

function onLogin(success) {
    if (success) {
        loginInput.disabled = true;
        loginBtn.disabled = true;
        msgInput.disabled = false;
        sendBtn.disabled = false;
        chatTxt.disabled = false;
        joinCallBtn.disabled = false;
    } else {
        alert("Unsuccesful login");
    }
}

function onChat(data) {
    // Insert message in chatbox
    chatTxt.value = data.name + ": " + data.message + "\n" + chatTxt.value;
}

function onOffer(offer, name) {
    localConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create answer to offer
    localConnection.createAnswer((answer) => {
        localConnection.setLocalDescription(answer);
        send({
            type: "answer",
            answer: answer,
            recipient: name
        });
    }, (error) => {
        console.log("Error creating answer");
    });
}

function onAnswer(answer) {
    localConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function onCanvasUpdate(data) {
    avatars = data.avatars;
}

// Sends data to WebSocket
function send(message) {
    message.name = username;
    webSocket.send(JSON.stringify(message));
}

// Checks whether browser supports WebRTC
function hasUserMedia() {
    return !!(
        navigator.getUserMedia || // Safari, Edge, etc.
        navigator.webkitGetUserMedia || // Chrome
        navigator.mozGetUserMedia // Firefox
    );
}