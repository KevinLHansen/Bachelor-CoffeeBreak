const server_ip = "localhost";
const server_port = "8082";

// Variables
var webSocket;

// UI elements
var button = document.getElementById("button");
var input = document.getElementById("input");
var buttonDelete = document.getElementById("buttonDelete");
var inputDelete = document.getElementById("inputDelete");
var buttonIngress = document.getElementById("testIngress")
var inputIngress = document.getElementById("inputIngress")


// WebSocket initiation

var url = `${server_ip}:${server_port}`;
log(`Client connection to WebSocket: ${url}`);
webSocket = new WebSocket(`ws://${url}`);

webSocket.onopen = () => {
    log("Client connected to WebSocket");
};

button.addEventListener("click", (event) => {
    if (input.value) {
        send({
            type: "createRoom",
            roomName: input.value
        });
    }
});

buttonDelete.addEventListener("click", (event) => {
    if (inputDelete.value) {
        send({
            type: "deleteRoom",
            roomName: input.value
        });
    }
});

buttonIngress.addEventListener("click", (event) => {
    if (inputIngress.value) {
        send({
            type: "testIngress",
            ingressName: inputIngress.value
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