const server_ip = window.location.host;
const room_path = window.location.pathname;
const server_port = "8082";

// Variables
var webSocket;

// UI elements
var button = document.getElementById("button");
var input = document.getElementById("input");

// WebSocket initiation

var url = `${server_ip}${room_path}ws`;
log(`Client connecting to WebSocket: ${url}`);
webSocket = new WebSocket(`wss://${url}`);

webSocket.onopen = () => {
    log("Client connected to WebSocket");
};

webSocket.onmessage = (message) => {
    // Parse message data from JSON
    var data = JSON.parse(message.data);

    switch (data.type) {

        case "roomUpdate":
            log("[roomUpdate]: " + message.data);

            room = data.room; // Update room state

            // Update UI
            updateUI("inroom");
            updateUsersUI();

            // Remove audio element of leaver
            if (data.leaver) {
                var audioElements = audioContainer.getElementsByTagName("audio");
                for (i = 0; i < audioElements.length; i++) {
                    var id = audioElements[i].getAttribute('id');
                    if (id == data.leaver) {
                        log(audioElements[i].innerHTML);
                        audioElements[i].outerHTML = "";
                    }
                }
            }
            break;

        case "chat": // Incoming chat
            log("[chat]: " + message.data);

            // Insert message in chatbox
            //chatTxt.value = data.name + ": " + data.message + "\n" + chatTxt.value; // Most recent on top
            chatTxt.value = chatTxt.value + data.name + ": " + data.message + "\n"; // Most recent on bottom
            break;

        case "canvasUpdate":
            log("[canvasUpdate]: " + message.data);
            if (room) {
                room.avatars = data.avatars;
                updateVolumes();
            }
            break;

        case "offer":
            log("[offer]: " + data.answerer + " <- " + data.offerer);
            sendAnswer(data.offerer, data.offer);
            break;

        case "answer":
            log("[answer]: " + data.offerer + " <- " + data.answerer);
            // Add the answer to matching peer connection(s)
            peerConnections.forEach((peerConnection) => {
                if (peerConnection.name == data.answerer) {
                    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });
            break;

        case "candidate":
            log("[candidate]: " + data.name);
            // Add the candidate to matching peer connections
            peerConnections.forEach((peerConnection) => {
                if (peerConnection.name == data.name) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            });
            break;
    }
};

// Sends data to WebSocket
function send(message) {
    webSocket.send(JSON.stringify(message));
}

function log(data) {
    console.log(`[${(performance.now() / 1000).toFixed(2)}]  \t ${data}`);
}