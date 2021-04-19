// Establish WebSocket to signaling server
var connection = new WebSocket("ws://localhost:9090");

var username = "";

var loginInput = document.getElementById("loginInput");
var loginBtn = document.getElementById("loginBtn");

var calleeInput = document.getElementById("calleeInput");
var callBtn = document.getElementById("callBtn");

var msgInput = document.getElementById("msgInput");
var sendBtn = document.getElementById("sendBtn");

var chatTxt = document.getElementById("chatTxt");

var connectedUser, myConnection, dataChannel;

// Login button
loginBtn.addEventListener("click", (event) => {
    username = loginInput.value;

    // Username must not be empty
    if (username.length > 0) {
        console.log("User logged in: " + username);

        send({
            type: "login",
            name: username
        });
    }
});

// Call button
callBtn.addEventListener("click", (event) => {
    var callee = calleeInput.value;
    connectedUser = callee;

    // Callee name must not be empty
    if (callee.length > 0) {
        myConnection.createOffer((offer) => {
            console.log("Sending offer to: " + callee);

            send({
                type: "offer",
                offer: offer
            });
            myConnection.setLocalDescription(offer);
        }, (error) => {
            alert("Error: " + error);
        });
    }
});

// Send button
sendBtn.addEventListener("click", (event) => {
    if (msgInput.value && dataChannel.readyState == 'open') {
        var msg = username + ": " + msgInput.value;
        console.log("Sending message: " + msg);
        // Send message to datachannel
        dataChannel.send(msg);
        // Insert message in chatbox
        chatTxt.value = msg + "\n" + chatTxt.value;
    }
});

connection.onmessage = (message) => {
    console.log("Received message: " + message.data);

    // Parse message data to JS object
    var data = JSON.parse(message.data);

    switch (data.type) {
        case "login":
            onLogin(data.success);
            break;
        case "offer":
            onOffer(data.offer, data.name);
            break;
        case "answer":
            onAnswer(data.answer);
            break;
        case "candidate":
            onCandidate(data.candidate);
            break;
        default:
            break;
    }
};

function onLogin(success) {
    if (success === false) {
        alert("Invalid username");
    } else {
        // Creating RTCPeerConnection
        var conf = {
            "iceServers": [{ "url": "stun:stun.1.google.com:19302" }]
        };

        myConnection = new RTCPeerConnection(conf, {
            optional: [{ RtpDataChannels: true }] // enable DataChannels
        });

        //myConnection = new RTCPeerConnection(conf);

        console.log("RTCPeerConnection object created: ");
        console.log(myConnection);

        // ICE handling
        myConnection.onicecandidate = (event) => {
            if (event.candidate) {
                send({
                    type: "candidate",
                    candidate: event.candidate
                });
            }
        };
        openDataChannel();
    }
};

function onOffer(offer, name) {
    connectedUser = name;
    myConnection.setRemoteDescription(new RTCSessionDescription(offer));

    myConnection.createAnswer((answer) => {
        myConnection.setLocalDescription(answer);

        send({
            type: "answer",
            answer: answer
        });
    }, (error) => {
        alert("Error: " + error);
    });
}

function onAnswer(answer) {
    myConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function onCandidate(candidate) {
    myConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

connection.onopen = () => {
    console.log("Connected");
};

connection.onerror = (error) => {
    console.log("Got error: " + error)
};

function openDataChannel() {
    var dataChannelConf = {
        reliable: true
    };

    dataChannel = myConnection.createDataChannel("ChatDataChannel", dataChannelConf);

    dataChannel.onerror = (error) => {
        console.log("DataChannel: Error: " + error);
    };

    dataChannel.onmessage = (event) => {
        console.log("DataChannel: Got message: " + event.data);
        // Insert message in chatbox
        chatTxt.value = event.data + "\n" + chatTxt.value;
    };
}

function send(message) {

    if (connectedUser) {
        message.name = connectedUser;
    }
    connection.send(JSON.stringify(message));
}