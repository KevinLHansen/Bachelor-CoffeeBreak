const serverIP = "localhost"; // for local testing
//const serverIP = "212.130.120.89"; // for public testing
const serverPort = "8074";

// Variables

var webSocket; // Websocket connection
var username = ""; // Own username
var room; // Current room
var localStream; // Own MediaStream
var localConnection; // Own RTCPeerConnection

// UI elements

var loginInput = document.getElementById("loginInput");
var loginBtn = document.getElementById("loginBtn");

var joinRoomInput = document.getElementById("joinRoomInput");
var joinRoomBtn = document.getElementById("joinRoomBtn");

var createRoomInput = document.getElementById("createRoomInput");
var createRoomBtn = document.getElementById("createRoomBtn");

var msgInput = document.getElementById("msgInput");
var sendBtn = document.getElementById("sendBtn");

var chatTxt = document.getElementById("chatTxt");

var joinCallBtn = document.getElementById("joinCallBtn");
var leaveCallBtn = document.getElementById("leaveCallBtn");

var roomLabel = document.getElementById("roomLabel");
var usersLabel = document.getElementById("usersLabel");

var audioContainer = document.getElementById("audioContainer");

setDisabled([
    msgInput, sendBtn, chatTxt,
    joinCallBtn, leaveCallBtn, joinRoomInput,
    joinRoomBtn, createRoomInput, createRoomBtn
], true);

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

    // Exclude types which flood the console
    if (
        data.type !== "offer" &&
        data.type !== "answer" &&
        data.type !== "canvasUpdate" &&
        data.type !== "createRoom"
    ) {
        console.log("Message received: " + message.data);
    }

    switch (data.type) {
        case "login": // Login attempt response
            onLogin(data.success);
            break;
        case "createRoom":
            onCreateRoom(data);
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
                localConnection.addStream(localStream);

                // When a stream is added to localConnection 

                // localConnection.onaddstream = (event) => {
                //     var audioElement = createAudioElement("", event.stream);
                //     audioContainer.appendChild(audioElement);
                // };

                localConnection.addEventListener("track", (event) => {
                    var audioElement = createAudioElement("", event.streams[0]);
                    audioContainer.appendChild(audioElement);
                });

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

// Join room button
joinRoomBtn.addEventListener("click", (event) => {

});

// Create room button
createRoomBtn.addEventListener("click", (event) => {
    if (createRoomInput) {
        var roomId = createRoomInput.value;
        console.log("Creating room: " + roomId);
        // Send create room message to proxy server
        send({
            type: "createRoom",
            roomId: roomId
        });
        createRoomInput.value = "";
    }
});

// KeyUp listener for createRoomInput
createRoomInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        createRoomBtn.click();
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

    var audioElement = createAudioElement(username, localStream);
    audioContainer.appendChild(audioElement);

    joinCallBtn.disabled = true;
    leaveCallBtn.disabled = false;

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

// Leave call button
leaveCallBtn.addEventListener("click", (event) => {

    joinCallBtn.disabled = false;
    leaveCallBtn.disabled = true;

    localConnection.setLocalDescription(null);
    // Clear all audio elements
    audioContainer.innerHTML = "";
});

function onLogin(success) {
    if (success) {
        console.log("User logged in: " + username);

        setDisabled([loginInput, loginBtn], true);

        setDisabled([
            msgInput, sendBtn, chatTxt,
            joinCallBtn, joinRoomInput, joinRoomBtn,
            createRoomInput, createRoomBtn
        ], false);

        roomLabel.textContent = "none";
    } else {
        alert("Username taken");
    }
}

function onCreateRoom(data) {
    if (data.success) {
        console.log("Room created: " + data.roomId);

        room = data.room; // Save current room
        // Update UI elements
        roomLabel.textContent = data.roomId;
        var usersString = "";
        for (user in room.users) {
            usersString += user + ", ";
        }
        usersLabel.textContent = usersString;

        setDisabled([
            createRoomInput, createRoomBtn,
            joinRoomInput, joinRoomBtn
        ], true);

    } else {
        alert("Room name occupied");
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