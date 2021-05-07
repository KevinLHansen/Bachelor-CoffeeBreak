const serverIP = "localhost"; // for local testing
//const serverIP = "212.130.120.89"; // for public testing
const serverPort = "8074";

// Variables

var webSocket; // Websocket connection
var username = ""; // Own username
var room; // Current room
var roomId; // Current room ID
var localStream; // Own MediaStream
var localConnection; // Own RTCPeerConnection

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
            onLogin(data.success);
            break;
        case "createRoom":
            console.log("[createRoom]: " + message.data);
            onCreateRoom(data);
            break;
        case "joinRoom":
            console.log("[joinRoom]: " + message.data);
            onJoinRoom(data);
            break;
        case "roomUpdate":
            console.log("[roomUpdate]: " + message.data);
            onRoomUpdate(data);
            break;
        case "chat": // Incoming chat
            console.log("[chat]: " + message.data);
            onChat(data);
            break;
        case "offer":
            console.log("[offer]: " + data.name);
            onOffer(data.offer, data.name);
            break;
        case "answer":
            console.log("[answer]: " + data.name);
            onAnswer(data.answer);
            break;
        case "canvasUpdate":
            console.log("[canvasUpdate]: " + message.data);
            onCanvasUpdate(data);
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

        // WebRTC initiation

        if (hasUserMedia()) {
            // Find function based on browser
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            navigator.getUserMedia({ video: false, audio: true }, (stream) => {
                localStream = stream;
                localConnection = new webkitRTCPeerConnection();
                localStream.getAudioTracks().forEach((track) => {
                    localConnection.addTrack(track, localStream);
                });

                // When a stream is added to the connection
                localConnection.ontrack = (event) => {
                    audioContainer.appendChild(createAudioElement("test", event.streams[0]));
                }
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

// Logout button
logoutBtn.addEventListener("click", (event) => {
    // TO-DO
});

// Join room button
joinRoomBtn.addEventListener("click", (event) => {
    if (joinRoomInput) {
        var roomId = joinRoomInput.value;
        console.log("Joining room: " + roomId);

        localConnection.createOffer((offer) => {
            // Send join room message to proxy server
            send({
                type: "joinRoom",
                canvas: { width: canvas.width, height: canvas.height },
                offer: offer,
                roomId: roomId
            });
            localConnection.setLocalDescription(offer);
        }, (error) => {
            console.log("Error creating an offer");
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

function onLogin(success) {
    if (success) {
        console.log("User logged in: " + username);

        updateUI("loggedin");

    } else {
        alert("Username taken");
    }
}

function onJoinRoom(data) {
    if (data.success) {
        console.log("Room joined: " + data.roomId);

        room = data.room; // Save current room
        // Update UI elements
        joinRoomInput.value = "";
        roomId = data.roomId;
        updateRoomUI();
        updateUI("inroom");
    } else {
        alert("Invalid room name");
    }
}

function onCreateRoom(data) {
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
}

function onRoomUpdate(data) {
    room = data.room; // Update room state
    // Update UI elements
    updateRoomUI();
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
    if (room) {
        room.avatars = data.avatars;
    }
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

// Leaves the current room
function leaveRoom() {
    send({
        type: "leaveRoom"
    });

    roomId = undefined;
    room = undefined;
    updateUI("loggedin");
}