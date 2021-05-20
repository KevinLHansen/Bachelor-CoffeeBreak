const server_ip = window.location.host;
const server_port = "8082";

// Variables
var webSocket;

// UI elements
var button = document.getElementById("button");
var input = document.getElementById("input");

// WebSocket initiation
var url = `wss://${server_ip}/ws`; // in-cluster
//var url = `ws://${server_ip}:8082`; // locally

log(`Client connecting to WebSocket: ${url}`);
webSocket = new WebSocket(`${url}`);

webSocket.onopen = () => {
    log("Client connected to WebSocket");
};

webSocket.onmessage = (message) => {
    // Parse message data from JSON
    var data = JSON.parse(message.data);
    console.log(data);

    switch (data.type) {

        case "createRoom":
            if (data.success) {
                var roomUrl = window.location.href + `${data.roomName}/`;
                // Redirect to created room
                redirectToRoom(roomUrl);
            } else {
                alert("Room name occupied!");
            }
            break;
    }
}


// UI handling

button.addEventListener("click", (event) => {
    if (input.value) {
        send({
            type: "createRoom",
            roomName: input.value
        });
    }
});

// Recursively calls self until room is available
async function redirectToRoom(roomUrl) {
    fetch(roomUrl, { timeout: 3000 })
        .then((res) => {
            if (res.status !== 404) {
                // Redirect to room URL
                window.location.href = roomUrl;
            } else {
                setTimeout(() => { redirectToRoom(roomUrl); }, 2000);
            }
        })
        .catch((err) => {
            setTimeout(() => { redirectToRoom(roomUrl); }, 2000);
        });
}


// Sends data to WebSocket
function send(message) {
    webSocket.send(JSON.stringify(message));
}

function log(data) {
    console.log(`[${(performance.now() / 1000).toFixed(2)}]  \t ${data}`);
}