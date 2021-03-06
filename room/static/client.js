const server_ip = window.location.host;
const room_path = window.location.pathname;
const server_port = "8082";

// Variables
var webSocket;
var username = ""; // Own username
var room; // Current room
var roomId; // Current room ID
var localStream; // Own MediaStream
var peerConnections = []; // List of peer connections

// Config for dynamic volume levels
var close = { threshold: 75, volume: 1 };
var medium = { threshold: 200, volume: 0.1 };
var far = { threshold: 400, volume: 0 };

// UI elements

var loginView = document.getElementById("loginView");
var loginCard = document.getElementById("loginCard");
var roomView = document.getElementById("roomView");

var loginInput = document.getElementById("loginInput");
var loginBtn = document.getElementById("loginBtn");

var msgInput = document.getElementById("msgInput");
var sendBtn = document.getElementById("sendBtn");
var leaveRoomBtn = document.getElementById("leaveRoomBtn");

var chatTxt = document.getElementById("chatTxt");

var roomTxt = document.getElementById("roomTxt");
var usersTxt = document.getElementById("usersTxt");

var audioContainer = document.getElementById("audioContainer");

// WebRTC UserMedia initiation

navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
    localStream = stream;
}).catch((error) => {
    log("getUserMedia error: " + error);
});

// WebSocket initiation
var url = `wss://${server_ip}${room_path}ws`; // in-cluster
//var url = `ws://${server_ip}:8082`; // locally

log(`Client connecting to WebSocket: ${url}`);
webSocket = new WebSocket(`${url}`);

webSocket.onopen = () => {
    log("Client connected to WebSocket");
    // Start pinging the socket to prevent automatic termination
    pingSocket();
};

webSocket.onclose = () => {
    log("WebSocket connection closed");
}

webSocket.onmessage = (message) => {
    // Parse message data from JSON
    var data = JSON.parse(message.data);

    switch (data.type) {

        case "login": // Login attempts response
            log("[login]: " + message.data);
            if (data.success) {
                log("User logged in: " + username);
                // Update room variables
                room = data.room;
                // Update UI
                updateUI("inroom");
                updateUsersUI();
                // Send WebRTC offers
                sendOffers();
            } else {
                alert("Username taken");
            }
            break;

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

        case "canvasUpdate":
            log("[canvasUpdate]: " + message.data);
            if (room) {
                room.avatars = data.avatars;
                updateVolumes();
            }
            break;

        case "chat":
            log("[chat]: " + message.data);
            // Insert message in chatbox
            //chatTxt.value = data.name + ": " + data.message + "\n" + chatTxt.value; // Most recent on top
            chatTxt.value = chatTxt.value + data.name + ": " + data.message + "\n"; // Most recent on bottom
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

        case "ping":
            log("PING");
            break;
    }
};

// UI HANDLING

// Login (JOIN) button
loginBtn.addEventListener("click", (event) => {
    if (loginInput.value) {
        username = loginInput.value;

        send({
            type: "login",
            canvas: { width: canvas.width, height: canvas.height }
        });
    }
})

// Leave room button
leaveRoomBtn.addEventListener("click", (event) => {
    window.location.pathname = "";
});

// Chat message input
msgInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        if (msgInput.value) {
            var msg = msgInput.value;
            log("Sending chat message: " + msg);
            send({
                type: "chat",
                message: msg
            });
            msgInput.value = "";
        }
    }
});

// Add keyup eventListeners to elements which need them ([input, button])
[
    [loginInput, loginBtn],

].forEach((element) => {
    element[0].addEventListener("keyup", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            element[1].click();
        }
    });
});

// Sends offers to all other users in room
function sendOffers() {
    log("Sending offers");
    room.users.forEach((user) => {
        // Don't send to self
        if (user !== username) {
            var localConnection = createPeerConnection(user);
            localConnection.createOffer().then((localDesc) => {
                localConnection.setLocalDescription(localDesc);
                send({
                    type: "offer",
                    offer: localDesc,
                    offerer: username,
                    answerer: user
                });
            });
            // Add the peer connection to local list
            peerConnections.push(localConnection);
        }
    });
}

// Handles incoming offer and sends answer
function sendAnswer(offerer, offer) {
    log("Sending answer to: " + offerer);
    var localConnection = createPeerConnection(offerer);
    localConnection.setRemoteDescription(new RTCSessionDescription(offer));
    // Create answer to offer
    localConnection.createAnswer().then((localDesc) => {
        localConnection.setLocalDescription(localDesc);
        // Send answer to offerer
        send({
            type: "answer",
            answer: localDesc,
            offerer: offerer,
            answerer: username
        });
    });
    // Add the peer connection to local list
    peerConnections.push(localConnection);
}

// Creates a RTCPeerConnection to given remote user
function createPeerConnection(user) {
    try {
        var localConnection = new RTCPeerConnection({ 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] });
        // Set association name
        localConnection.name = user;

        // Set event handlers
        localConnection.onicecandidate = (event) => {
            log("ICE candidate got");

            // Send the candidate
            if (event.candidate) {
                send({
                    type: "candidate",
                    candidate: event.candidate,
                    name: username
                });
            }
        };
        localConnection.ontrack = (event) => {
            log("Track got");

            var stream = event.streams[0];
            var audio = createAudioElement(user, stream);

            audioContainer.appendChild(audio);
            updateVolumes();
        };

        // Add local stream to the connection
        localStream.getAudioTracks().forEach((track) => {
            localConnection.addTrack(track, localStream);
        });

        return localConnection;
    } catch (error) {
        log("Error creating peer connection: " + error);
    }
}

// Creates a DOM audio element for appendage to HTML page
function createAudioElement(username, mediaStream) {
    var audioElement = document.createElement("audio");
    audioElement.id = username;
    audioElement.srcObject = mediaStream;
    //audioElement.setAttribute("controls", true);
    audioElement.setAttribute("autoplay", true)

    return audioElement;
}

// Disables/enables multiple HTML elements at a time
function setDisabled(elements, disabled) {
    elements.forEach((element) => {
        element.disabled = disabled;
    });
}

// Updates client UI based on given state
function updateUI(state) {
    switch (state) {
        case "inroom":
            loginCard.style.display = "none";
            loginView.style.display = "none";
            roomView.style.display = "flex";
            roomTxt.innerHTML = window.location.pathname;
            break;
    }
}

// Updates UI element which lists users in current room
function updateUsersUI() {
    var newText = "";
    for (i = 0; i < room.users.length; i++) {
        newText += room.users[i];
        if (!(i == room.users.length - 1)) { // No comma on last
            newText += ", ";
        }
    }
    usersTxt.innerHTML = newText;
}

// Updates volumes of all audio elements according to avatar distance
function updateVolumes() {
    if (room) {
        // Get own avatar
        ownAvatar = getAvatar(username);

        // Get all audio elements in audio container
        var audioElements = audioContainer.getElementsByTagName("audio");
        for (i = 0; i < audioElements.length; i++) {
            var audioElement = audioElements[i];

            // Get id (user association) of element
            var id = audioElement.getAttribute('id');

            // Get avatar of associated user
            var avatar = getAvatar(id);

            // Get distance between avatars
            var distance = getDistance(ownAvatar, avatar);
            log("DIST: " + username + " <-> " + id + " = " + distance);

            // Adjust volume of audio element
            var volume;
            if (distance >= far.threshold) { // "far" away
                volume = far.volume;
            } else if (distance >= medium.threshold) { // "medium" away
                volume = medium.volume;
            } else if (distance <= close.threshold) { // "close"
                volume = close.volume;
            } else { // in between
                volume = convertRange(distance, {
                    min: close.threshold,
                    max: medium.threshold
                }, {
                    min: close.volume,
                    max: medium.volume
                });
            }
            audioElement.volume = volume;
            //log("VOLUME: " + volume);
        }
    }
}

// Returns the length of the direct vector between two avatars
function getDistance(avatar1, avatar2) {
    var vector = {
        x: avatar1.x - avatar2.x,
        y: avatar1.y - avatar2.y
    };
    // Pythagoras
    var distance = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
    return distance;
}

// Returns value convert from one range to another
function convertRange(value, oldRange, newRange) {
    return ((value - oldRange.min) * (newRange.max - newRange.min)) / (oldRange.max - oldRange.min) + newRange.min;
}

// Returns avatar object for given name in current room
function getAvatar(name) {
    var avatarGet;
    room.avatars.forEach((avatar) => {
        if (avatar.name == name) {
            avatarGet = avatar;
        }
    });
    return avatarGet;
}

async function pingSocket() {
    setTimeout(() => {
        send({
            type: "ping"
        });
        pingSocket();
    }, 30000);
}

// Sends data to WebSocket
function send(message) {
    message.name = username;
    webSocket.send(JSON.stringify(message));
}

function log(data) {
    console.log(`[${(performance.now() / 1000).toFixed(2)}]  \t ${data}`);
}