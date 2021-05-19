const server_ip = "localhost";
const server_port = "8082";

// Variables
var webSocket;

// UI elements
var button = document.getElementById("button");
var input = document.getElementById("input");

// WebSocket initiation

var url = `${server_ip}:${server_port}`;
log(`Client connection to WebSocket: ${url}`);
webSocket = new WebSocket(`ws://${url}`);

webSocket.onopen = () => {
    log("Client connected to WebSocket");
};

// UI handling

button.addEventListener("click", (event) => {
    if (input.value) {
        send({
            type: "createRoom",
            roomName: input.value
        });
    }
});


// Sends data to WebSocket
function send(message) {
    webSocket.send(JSON.stringify(message));
}

function log(data) {
    console.log(`[${(performance.now() / 1000).toFixed(2)}]  \t ${data}`);
}