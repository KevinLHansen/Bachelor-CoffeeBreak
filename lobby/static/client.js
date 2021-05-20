const server_ip = window.location.host;
const server_port = "8082";

// Variables
var webSocket;

// UI elements
var roomInput = document.getElementById("roomInput");
var joinRoomBtn = document.getElementById("joinRoomBtn");
var createRoomBtn = document.getElementById("createRoomBtn");

// WebSocket initiation
var url = `wss://${server_ip}/ws`; // in-cluster
//var url = `ws://${server_ip}:8082`; // locally

log(`Client connecting to WebSocket: ${url}`);
webSocket = new WebSocket(`${url}`);

webSocket.onopen = () => {
    log("Client connected to WebSocket");
    // Start pinging the socket to prevent automatic termination
    pingSocket();
};

webSocket.onmessage = (message) => {
    // Parse message data from JSON
    var data = JSON.parse(message.data);

    switch (data.type) {

        case "createRoom":
            if (data.success) {
                // Update UI
                roomInput.disabled = true;
                joinRoomBtn.disabled = true;
                createRoomBtn.disabled = true;

                var roomUrl = window.location.href + `${data.roomName}/`;
                // Redirect to created room
                redirectToRoom(roomUrl);
            } else {
                alert("Room name occupied!");
            }

        case "ping":
            log("PING");
            break;
    }
}


// UI handling

joinRoomBtn.addEventListener("click", (event) => {
    if (roomInput.value) {
        var roomUrl = window.location.href + `${roomInput.value}/`
            // Check if room exists and is available
        fetch(roomUrl, { timeout: 3000 }).then((res) => {
            if (res.status >= 200 && res.status <= 299) {
                // Room is available, redirect client
                window.location.href = roomUrl;
            } else {
                alert("Invalid room name!");
            }
        }).catch((err) => {
            // Room is unavailable
            alert("Invalid room name!");
        });
    }
});

createRoomBtn.addEventListener("click", (event) => {
    if (roomInput.value) {
        send({
            type: "createRoom",
            roomName: roomInput.value
        });
    }
});

// Recursively calls self until room is available
async function redirectToRoom(roomUrl) {
    fetch(roomUrl, { timeout: 3000 }).then((res) => {
        if (res.status >= 200 && res.status <= 299) { // If response == success
            // Redirect to room URL
            window.location.href = roomUrl;
        } else {
            setTimeout(() => { redirectToRoom(roomUrl); }, 2000);
        }
    }).catch((err) => {
        setTimeout(() => { redirectToRoom(roomUrl); }, 2000);
    });
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
    webSocket.send(JSON.stringify(message));
}

function log(data) {
    console.log(`[${(performance.now() / 1000).toFixed(2)}]  \t ${data}`);
}