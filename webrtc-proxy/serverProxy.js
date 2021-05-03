const fs = require('fs');
const WebSocketServer = require('ws').Server;
const HttpsServer = require('https').createServer;

const port = 8074;

const conf = {
    key: fs.readFileSync('cert/key.pem'),
    cert: fs.readFileSync('cert/cert.pem')
};

var https = HttpsServer(conf);

var wss = new WebSocketServer({ server: https });

https.listen(port);

console.log(`Proxy server live at https://localhost:${port}`);

var users = {}; // Key-value pairs of username:connection
var rooms = {}; // Key-value pairs of roomId:{owner:"", users:{}, avatars:[]}
var avatars = []; // List of avatar objects

// The rooms object is structured as such:
// rooms = {
//     "exampleRoomId": {
//         "owner": "exampleUsername3",
//         "users": {
//             "exampleUsername": exampleConnection,
//             "exampleUsername2": exampleConnection2
//         },
//         "avatars": [
//             { name: data.name, x: x, y: y, width: size, height: size, fill: `#${color}`, isDragging: false },
//             { name: data.name, x: x, y: y, width: size, height: size, fill: `#${color}`, isDragging: false }
//         ]  
//     }
// }

wss.on('connection', (connection) => {
    console.log("Connection received");

    connection.on('message', (message) => {
        var data;
        // Filter non-JSON messages
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Invalid JSON");
            data = {};
        }

        // Exclude types which flood the console
        if (data.type !== "offer" && data.type !== "answer" && data.type !== "canvasUpdate") {
            console.log("Message received: " + message);
        }

        switch (data.type) {
            case "login":
                if (users[data.name]) { // Check if user already exists / is logged in
                    sendTo(connection, {
                        type: "login",
                        success: false
                    });
                } else { // Register user
                    users[data.name] = connection;
                    connection.name = data.name;

                    sendTo(connection, {
                        type: "login",
                        success: true
                    });
                    console.log("User logged: " + data.name);

                    createAvatar(data);
                }
                break;

            case "createRoom":
                if (rooms[data.roomId]) { // Check if roomId already exists
                    sendTo(connection, {
                        type: "createRoom",
                        success: false
                    });
                } else { // Register room
                    rooms[data.roomId] = {
                        owner: data.name,
                        users: {},
                        avatars: []
                    };
                    // Add room creator to room
                    rooms[data.roomId].users[data.name] = users[data.name];
                    // Add roomId association to user registry
                    users[data.name].roomId = data.roomId;

                    console.log('ROOMS: ', rooms); // TEMP

                    sendTo(connection, {
                        type: "createRoom",
                        roomId: data.roomId,
                        room: rooms[data.roomId],
                        success: true
                    });
                    console.log("Room created: " + data.roomId);
                }
                break;

            case "joinRoom":
                if (rooms[data.roomId]) { // Check if room exists

                    // Add user to room
                    rooms[data.roomId].users[data.name] = users[data.name];
                    // Add roomId association to user registry
                    users[data.name].roomId = data.roomId;
                    console.log("User: " + data.name + " joined room: " + data.roomId);

                    console.log('ROOMS: ', rooms); // TEMP

                    // Respond to joiner
                    sendTo(connection, {
                        type: "joinRoom",
                        roomId: data.roomId,
                        room: rooms[data.roomId],
                        success: true
                    });

                    // Notify other users in the room
                    sendRoomUpdate(data.roomId);
                } else {
                    sendTo(connection, {
                        type: "joinRoom",
                        success: false
                    });
                }
                break;

            case "chat":
                console.log("Chat received: " + data.name + ": " + data.message);
                // Relay chat message to all users
                for (user in users) {
                    sendTo(users[user], data);
                }
                break;

            case "offer":
                console.log("Offer received from: " + data.name);
                // Relay offer to all other users
                for (user in users) {
                    // Exclude sender
                    if (users[user].name !== data.name) {
                        sendTo(users[user], data);
                    }
                }
                break;

            case "answer":
                console.log("Answer received from: " + data.name + " answering to: " + data.recipient);
                // Relay answer to intended recipient
                sendTo(users[data.recipient], data);
                break;

            case "canvasUpdate":
                console.log("Canvas update received from: " + data.name);
                // Update server avatars
                avatars = data.avatars;
                // Relay canvas update to all users
                for (user in users) {
                    sendTo(users[user], data);
                }
                break

            default:
                sendTo(connection, {
                    type: "error",
                    message: "Command not found: " + data.type
                });
        }
    });

    // Unregister user when connection closes
    connection.on('close', () => {
        if (connection.name) {
            console.log("User disconnected: " + connection.name);

            if (connection.roomId) {
                leaveRoom(connection.name);
            }
            removeAvatar(connection.name);
            delete users[connection.name];
        }
    });
});

// Avatar functions

function createAvatar(data) {
    var size = 25;

    // Get canvas measurements from data
    var canvasWidth = data.canvas.width;
    var canvasHeight = data.canvas.height;

    var horiMargin = Math.floor(canvasWidth / 3);
    var vertMargin = Math.floor(canvasHeight / 3);
    // Get random position for avatar
    var x = Math.floor(Math.random() * (canvasWidth - horiMargin * 2) + horiMargin);
    var y = Math.floor(Math.random() * (canvasHeight - vertMargin * 2) + vertMargin);
    // Get random hex color
    var color = Math.floor(Math.random() * 16777215).toString(16);

    avatars.push({ name: data.name, x: x, y: y, width: size, height: size, fill: `#${color}`, isDragging: false });

    sendCanvasUpdate();
}

function leaveRoom(username) {
    // Get roomId of room user is in
    var roomId = users[username].roomId;
    delete rooms[roomId].users[username];

    sendRoomUpdate(roomId);
}

function sendRoomUpdate(roomId) {
    for (user in rooms[roomId].users) {
        sendTo(rooms[roomId].users[user], {
            type: "roomUpdate",
            room: rooms[roomId]
        });
    }
}

function removeAvatar(username) {
    for (let i = 0; i < avatars.length; i++) {
        if (avatars[i].name === username) {
            avatars.splice(i, 1);
        }
    }
    sendCanvasUpdate();
}

// Sends a canvas update to all users
function sendCanvasUpdate() {
    for (user in users) {
        sendTo(users[user], {
            type: "canvasUpdate",
            avatars: avatars,
            name: "SERVER"
        });
    }
}

// Utility functions

function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}