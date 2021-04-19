var webSocket, dataChannel;

const serverIP = "localhost";
const serverPort = "9090";

var username = "";

var loginInput = document.getElementById("loginInput");
var loginBtn = document.getElementById("loginBtn");

var calleeInput = document.getElementById("calleeInput");
var callBtn = document.getElementById("callBtn");

var msgInput = document.getElementById("msgInput");
var sendBtn = document.getElementById("sendBtn");

var chatTxt = document.getElementById("chatTxt");

// Login button
loginBtn.addEventListener("click", (event) => {
    if (loginInput.value) {
        username = loginInput.value;

        if (!webSocket) { // Connect WebSocket if not already
            var url = `${serverIP}:${serverPort}`;
            console.log(`Connecting to WebSocket: ${url}`);
            webSocket = new WebSocket(`ws://${url}`);
        }

        webSocket.onopen = () => {
            console.log("WebSocket connected");
            send({
                type: "login"
            });
            console.log("User logged in: " + username);
        };

        webSocket.onmessage = (message) => {
            console.log("Received message: " + message.data);

            // Parse message data JSON
            var data = JSON.parse(message.data);

            switch (data.type) {
                case "login": // Successful login
                    onLogin(data.success);
                    break;
                case "chat": // Incoming chat
                    onChat(data);
                    break;
            }
        };
    }
});

sendBtn.addEventListener("click", (event) => {
    if (msgInput.value) {
        var msg = msgInput.value;
        console.log("Sending chat message: " + msg);
        // Send message to WebSocket
        send({
            type: "chat",
            message: msg
        });
    }
});

function onLogin(success) {

}

function onChat(data) {
    // Insert message in chatbox
    chatTxt.value = data.name + ": " + data.message + "\n" + chatTxt.value;
}

// Sends data to WebSocket
function send(message) {
    message.name = username;
    webSocket.send(JSON.stringify(message));
}