const serverIP = "localhost"; // for local testing
//const serverIP = "192.168.123.21"; // for local multi-machine testing
//const serverIP = "212.130.120.89"; // for public testing

const serverPort = "8074";

// Variables

var webSocket; // Websocket connection
var localStream; // Own MediaStream
//var localConnection; // Own RTCPeerConnection
var peerConnections = [];

var id;

// UI elements

var callBtn = document.getElementById("callBtn");
var audioContainer = document.getElementById("audioContainer");

// WebRTC initiation

navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
    localStream = stream;
    //audioContainer.appendChild(createAudioElement("", localStream));
}).catch((error) => {
    console.log(error);
});

// WebSocket initiation

if (!webSocket) { // Connect WebSocket if not already
    var url = `${serverIP}:${serverPort}`;
    console.log(`Client connecting to WebSocket: ${url}`);
    webSocket = new WebSocket(`wss://${url}`);
}

webSocket.onopen = () => {
    console.log("Client connected to WebSocket");

    send({
        type: "register"
    });
};

webSocket.onmessage = (message) => {
    // Parse message data from JSON
    var data = JSON.parse(message.data);

    switch (data.type) {
        case "register":
            console.log("register | " + message.data);
            id = data.id;
            console.log("assigned id: " + id);
            break;
        case "getPeers":
            console.log(data.peers);
            sendOffers(data.peers);
            break;
        case "log":
            console.log("[LOG] " + data.log);
            break;
        case "offer":
            console.log("offer | " + data.offerer);
            sendAnswer(data.offerer, data.offer);
            break;
        case "answer":
            console.log("answer | " + data.answerer);
            handleAnswer(data.answerer, data.answer);
            break;
        case "candidate":
            handleCandidate(data.id, data.candidate);
            break;
    }
};


callBtn.addEventListener("click", (event) => {
    send({
        type: "getPeers",
        id: id
    });
});

function createPeerConnection(peerId) {
    try {
        var localConnection = new RTCPeerConnection();
        localConnection.onicecandidate = onIceCandidate;
        localStream.getAudioTracks().forEach((track) => {
            localConnection.addTrack(track, localStream);
        })
        localConnection.ontrack = onTrack;
        localConnection.id = peerId;
        return localConnection;
    } catch (error) {
        console.log(error);
    }
}

function sendOffers(peers) {
    console.log("Send offers");
    peers.forEach((peerId) => {
        if (peerId != id) {
            var localConnection = createPeerConnection(peerId);
            localConnection.createOffer().then((localDesc) => {
                localConnection.setLocalDescription(localDesc);
                send({
                    type: "offer",
                    offer: localDesc,
                    offerer: id,
                    answerer: peerId
                });
            });
            peerConnections.push(localConnection);
        }
    });
}

function sendAnswer(offerer, offer) {
    console.log("Send answer");
    var localConnection = createPeerConnection(offerer, offer);
    localConnection.setRemoteDescription(new RTCSessionDescription(offer));
    console.log("Remote description set (offer)");
    localConnection.createAnswer().then((localDesc) => {
        localConnection.setLocalDescription(localDesc);
        console.log("Local description set (answer)");
        send({
            type: "answer",
            answer: localDesc,
            offerer: offerer,
            answerer: id
        });
        peerConnections.push(localConnection);
    });
}

function handleAnswer(answerer, answer) {
    peerConnections.forEach((peerConnection) => {
        if (peerConnection.id == answerer) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log("Remote description set (answer)");
        }
    });
}

function handleCandidate(id, candidate) {
    peerConnections.forEach((peerConnection) => {
        if (peerConnection.id == id) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
}

function onIceCandidate(event) {
    console.log("ICE candidate");
    if (event.candidate) {
        send({
            type: "candidate",
            candidate: event.candidate,
            id: id
        });
    }
}

function onTrack(event) {
    console.log("onTrack")
    audioContainer.appendChild(createAudioElement("", event.streams[0]));
}

// Sends data to WebSocket
function send(message) {
    webSocket.send(JSON.stringify(message));
}

function createAudioElement(username, mediaStream) {
    var audioElement = document.createElement("audio");
    audioElement.id = username;
    audioElement.srcObject = mediaStream;
    audioElement.setAttribute("controls", true);
    audioElement.setAttribute("autoplay", true)

    return audioElement;
}