const serverIP = "localhost"; // for local testing
//const serverIP = "212.130.120.89"; // for public testing
const serverPort = "8074";

// Variables

var webSocket; // Websocket connection
var username = ""; // Own username
var room; // Current room
var roomId; // Current room ID
var localStream; // Own MediaStream
var peerConnections = []; // List of peer connections

// UI elements

var loginInput = document.getElementById("loginInput");
var loginBtn = document.getElementById("loginBtn");
var logoutBtn = document.getElementById("logoutBtn");

var joinRoomInput = document.getElementById("joinRoomInput");
var joinRoomBtn = document.getElementById("joinRoomBtn");
var leaveRoomBtn = document.getElementById("leaveRoomBtn");

var createRoomInput = document.getElementById("createRoomInput");
var createRoomBtn = document.getElementById("createRoomBtn");

var msgInput = document.getElementById("msgInput");
var sendBtn = document.getElementById("sendBtn");

var chatTxt = document.getElementById("chatTxt");

var roomLabel = document.getElementById("roomLabel");
var usersLabel = document.getElementById("usersLabel");

var audioContainer = document.getElementById("audioContainer");

updateUI("loggedout");

// WebSocket initiation

if (!webSocket) { // Connect WebSocket if not already
    var url = `${serverIP}:${serverPort}`;
    console.log(`Client connecting to WebSocket: ${url}`);
    webSocket = new WebSocket(`wss://${url}`);
}

webSocket.onopen = () => {
    console.log("Client connected to WebSocket");
};

webSocket.onmessage = (message) => {
    // Parse message data from JSON
    var data = JSON.parse(message.data);

    switch (data.type) {
        case "login": // Login attempt response
            console.log("[login]: " + message.data);

            if (data.success) {
                console.log("User logged in: " + username);
                updateUI("loggedin");
            } else {
                alert("Username taken");
            }
            break;

        case "joinRoom":
            console.log("[joinRoom]: " + message.data);

            if (data.success) {
                console.log("Room joined: " + data.roomId);
                // Update room variables
                room = data.room;
                roomId = data.roomId;
                // Update UI elements
                joinRoomInput.value = "";
                updateRoomUI();
                updateUI("inroom");
                // Send WebRTC offers
                sendOffers();
            } else {
                alert("Invalid room name");
            }
            break;

        case "createRoom":
            console.log("[createRoom]: " + message.data);

            if (data.success) {
                console.log("Room created: " + data.roomId);
                // Update room variables
                room = data.room;
                roomId = data.roomId;
                // Update UI elements
                createRoomInput.value = "";
                updateRoomUI();
                updateUI("inroom");
            } else {
                alert("Room name occupied");
            }
            break;

        case "roomUpdate":
            console.log("[roomUpdate]: " + message.data);

            room = data.room; // Update room state

            // Remove audio element of leaver
            if (data.leaver) {
                var audioElements = audioContainer.getElementsByTagName("audio");
                for (i = 0; i < audioElements.length; i++) {
                    var id = audioElements[i].getAttribute('id');
                    if (id == data.leaver) {
                        console.log(audioElements[i].innerHTML);
                        audioElements[i].outerHTML = "";
                    }
                }
            }

            // Update UI elements
            updateRoomUI();
            break;

        case "chat": // Incoming chat
            console.log("[chat]: " + message.data);

            // Insert message in chatbox
            chatTxt.value = data.name + ": " + data.message + "\n" + chatTxt.value;
            break;

        case "canvasUpdate":
            console.log("[canvasUpdate]: " + message.data);
            if (room) {
                room.avatars = data.avatars;
                updateVolumes();
            }
            break;

        case "offer":
            console.log("[offer]: " + data.answerer + " <- " + data.offerer);
            sendAnswer(data.offerer, data.offer);
            break;

        case "answer":
            console.log("[answer]: " + data.offerer + " <- " + data.answerer);
            // Add the answer to matching peer connection(s)
            peerConnections.forEach((peerConnection) => {
                if (peerConnection.name == data.answerer) {
                    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });
            break;

        case "candidate":
            console.log("[candidate]: " + data.name);
            // Add the candidate to matching peer connections
            peerConnections.forEach((peerConnection) => {
                if (peerConnection.name == data.name) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            });
            break;
    }
};

// Login button
loginBtn.addEventListener("click", (event) => {
    if (loginInput.value) {
        username = loginInput.value;

        send({
            type: "login",
            canvas: { width: canvas.width, height: canvas.height }
        });

        // WebRTC UserMedia initiation

        navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
            localStream = stream;
        }).catch((error) => {
            console.log("getUserMedia error: " + error);
        });
    }
});

// Logout button
logoutBtn.addEventListener("click", (event) => {
    // TO-DO
});

// Join room button
joinRoomBtn.addEventListener("click", (event) => {
    if (joinRoomInput) {
        var roomId = joinRoomInput.value;
        console.log("Joining room: " + roomId);
        // Send join room message to proxy server
        send({
            type: "joinRoom",
            canvas: { width: canvas.width, height: canvas.height },
            roomId: roomId
        });
    }
});

// Leave room button
leaveRoomBtn.addEventListener("click", (event) => {
    leaveRoom();
});

// Create room button
createRoomBtn.addEventListener("click", (event) => {
    if (createRoomInput) {
        var roomId = createRoomInput.value;
        console.log("Creating room: " + roomId);
        // Send create room message to proxy server
        send({
            type: "createRoom",
            canvas: { width: canvas.width, height: canvas.height },
            roomId: roomId
        });
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

// Add keyup eventListeners to elements which need them ([input, button])
[
    [loginInput, loginBtn],
    [joinRoomInput, joinRoomBtn],
    [createRoomInput, createRoomBtn],
    [msgInput, sendBtn]

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
    console.log("Sending offers");
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
    console.log("Sending answer to: " + offerer);
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
        var localConnection = new RTCPeerConnection();
        // Set association name
        localConnection.name = user;

        // Set event handlers
        localConnection.onicecandidate = (event) => {
            console.log("ICE candidate got");

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
            console.log("Track got");

            var stream = event.streams[0];
            var audio = createAudioElement(user, stream);

            // -- SMARTER SOLUTION (det duer ik) --
            // var audioContext = new AudioContext();
            // var src = audioContext.createMediaStreamSource(stream);

            // var gainFilter = audioContext.createGain();
            // gainFilter.gain.value = 0.5;
            // // Connect filter to source
            // src.connect(gainFilter);
            // // Connect audio context destination to filter
            // gainFilter.connect(audioContext.destination);

            audioContainer.appendChild(audio);
            updateVolumes();
        };

        // Add local stream to the connection
        localStream.getAudioTracks().forEach((track) => {
            localConnection.addTrack(track, localStream);
        });

        return localConnection;
    } catch (error) {
        console.log("Error creating peer connection: " + error);
    }

}

// Creates a DOM audio element for appendage to HTML page
function createAudioElement(username, mediaStream) {
    var audioElement = document.createElement("audio");
    audioElement.id = username;
    audioElement.srcObject = mediaStream;
    audioElement.setAttribute("controls", true);
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
        case "loggedout":
            setDisabled([
                msgInput, sendBtn, chatTxt, logoutBtn,
                joinRoomInput, joinRoomBtn, leaveRoomBtn,
                createRoomInput, createRoomBtn
            ], true);

            setDisabled([loginInput, loginBtn], false);
            break;
        case "loggedin":
            setDisabled([loginInput, loginBtn], true);

            setDisabled([
                joinRoomInput, joinRoomBtn,
                createRoomInput, createRoomBtn
            ], false);

            audioContainer.innerHTML = "";
            updateRoomUI();
            break;
        case "inroom":
            setDisabled([
                msgInput, sendBtn, chatTxt,
                leaveRoomBtn
            ], false);

            setDisabled([
                createRoomInput, createRoomBtn,
                joinRoomInput, joinRoomBtn
            ], true);

            updateRoomUI();
            break;
    }
}

// Updates room-relevant UI
function updateRoomUI() {
    if (roomId) {
        roomLabel.textContent = roomId;
        var usersString = "";
        // Get users in room
        var userList = room.users;

        userList.forEach((user) => {
            usersString += user + ", ";
        });

        usersLabel.textContent = usersString;
    } else {
        roomLabel.textContent = "";
        usersLabel.textContent = "";
    }
}

// Updates volumes of all audio elements according to avatar distance
function updateVolumes() {
    // Volume adjusting setting variables
    var close = { threshold: 75, volume: 1 };
    var medium = { threshold: 200, volume: 0.1 };
    var far = { threshold: 350, volume: 0 };

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
            console.log("DIST: " + username + " <-> " + id + " = " + distance);

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
            console.log("VOLUME: " + volume);
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

// Leaves the current room
function leaveRoom() {
    send({
        type: "leaveRoom"
    });

    roomId = undefined;
    room = undefined;
    // Close all peer connections
    peerConnections.forEach((peerConnection) => {
        peerConnection.close();
    });
    // Clear peer connections list
    peerConnections = [];

    updateUI("loggedin");
}

// Sends data to WebSocket
function send(message) {
    message.name = username;
    webSocket.send(JSON.stringify(message));
}