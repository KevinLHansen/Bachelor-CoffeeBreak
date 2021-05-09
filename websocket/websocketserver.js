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

log(`Proxy server live at https://localhost:${port}`);

var users = {}; // Key-value pairs of username:connection
var rooms = {}; // Key-value pairs of roomId:{owner:"", users:{}, avatars:[]}
// Test room - TEMP
rooms["t"] = {
    owner: "",
    users: [],
    avatars: []
};

// The rooms object is structured as such:
// rooms = {
//     "exampleRoomId": {
//         "owner": "exampleUsername3",
//         "users": [
//              "exampleUsername",
//              "exampleUsername2"
//          ],
//         "avatars": [
//             { name: data.name, x: x, y: y, width: size, height: size, fill: `#${color}`, isDragging: false },
//             { name: data.name, x: x, y: y, width: size, height: size, fill: `#${color}`, isDragging: false }
//         ]  
//     }
// }

wss.on('connection', (connection) => {
    log("Connection received");

    connection.on('message', (message) => {
        var data;
        // Filter non-JSON messages
        try {
            data = JSON.parse(message);
        } catch (e) {
            log("Invalid JSON");
            data = {};
        }

        switch (data.type) {
            case "login":
                log("[login]: " + message);

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
                    log("User logged: " + data.name);
                }
                break;

            case "joinRoom":
                log("[joinRoom]: " + data.name + " -> " + data.roomId);

                if (rooms[data.roomId]) { // Check if room exists
                    // Add user to room
                    rooms[data.roomId].users.push(data.name);
                    // Add roomId association to user registry
                    users[data.name].roomId = data.roomId;
                    log("User: " + data.name + " joined room: " + data.roomId);

                    // Respond to joiner
                    sendTo(connection, {
                        type: "joinRoom",
                        roomId: data.roomId,
                        room: rooms[data.roomId],
                        success: true
                    });

                    // Notify other users in the room
                    createAvatar(data);
                    sendRoomUpdate(data.roomId);
                } else {
                    sendTo(connection, {
                        type: "joinRoom",
                        success: false
                    });
                }
                break;

            case "createRoom":
                log("[createRoom]: " + message);

                if (rooms[data.roomId]) { // Check if roomId already exists
                    sendTo(connection, {
                        type: "createRoom",
                        success: false
                    });
                } else { // Register room
                    rooms[data.roomId] = {
                        owner: data.name,
                        users: [],
                        avatars: []
                    };
                    // Add room creator to room
                    rooms[data.roomId].users.push(data.name);
                    // Add roomId association to user registry
                    users[data.name].roomId = data.roomId;

                    createAvatar(data);

                    sendTo(connection, {
                        type: "createRoom",
                        roomId: data.roomId,
                        room: rooms[data.roomId],
                        success: true
                    });
                    log("Room created: " + data.roomId);
                }
                break;

            case "leaveRoom":
                log("[leaveRoom]: " + message);

                if (rooms[users[data.name].roomId]) { // Check user is in room
                    leaveRoom(data.name);
                    removeAvatar(data.name);
                }
                break;

            case "chat":
                log("[chat]: " + message);
                // Get users in room
                var userList = rooms[users[data.name].roomId].users;
                // Relay chat message to all users
                userList.forEach((user) => {
                    sendTo(users[user], data);
                });
                break;

            case "canvasUpdate":
                log("Canvas update received from: " + data.name);
                // Update room avatars on server
                rooms[users[data.name].roomId].avatars = data.avatars;
                // Get users in room
                var userList = rooms[users[data.name].roomId].users;
                // Relay canvas update to all users
                userList.forEach((user) => {
                    sendTo(users[user], data);
                });
                break;

            case "offer":
                log("[offer]: " + data.offerer + " -> " + data.answerer);
                // Relay offer to answerer
                sendTo(users[data.answerer], data);
                break;

            case "answer":
                log("[answer]: " + data.offerer + " <- " + data.answerer);
                // Relay answer to offerer
                sendTo(users[data.offerer], data);
                break;

            case "candidate":
                log("[candidate]: " + data.name);
                // Get users in room
                var userList = rooms[users[data.name].roomId].users;
                // Relay candidate to all users except self
                userList.forEach((user) => {
                    if (user != data.name) {
                        sendTo(users[user], data);
                    }
                });
                break;

            default:
                log("[error]: " + message);
                sendTo(connection, {
                    type: "error",
                    message: "Command not found: " + data.type
                });
        }
    });

    // Unregister user when connection closes
    connection.on('close', () => {
        if (connection.name) {
            log("User disconnected: " + connection.name);

            if (connection.roomId) {
                leaveRoom(connection.name);
                removeAvatar(connection.name);
            }
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

    rooms[data.roomId].avatars.push({ name: data.name, x: x, y: y, width: size, height: size, fill: `#${color}`, isDragging: false });

    sendCanvasUpdate();
}

function removeAvatar(username) {
    // Get list of avatars of room associated with user
    var avatars = rooms[users[username].roomId].avatars;
    for (let i = 0; i < avatars.length; i++) {
        if (avatars[i].name === username) {
            avatars.splice(i, 1);
        }
    }
    sendCanvasUpdate();
}

function leaveRoom(username) {
    // Get roomId of room user is in
    var roomId = users[username].roomId;
    // Get users in room
    var userList = rooms[users[username].roomId].users;

    for (let i = 0; i < userList.length; i++) {
        if (userList[i] === username) {
            userList.splice(i, 1);
        }
    }

    sendRoomUpdate(roomId, username);
}

function sendRoomUpdate(roomId, leaver) {
    // Get users in room
    var userList = rooms[roomId].users;

    userList.forEach((user) => {
        // Get connection of user
        var connection = users[user];
        // Compose leave message
        var msg = {
            type: "roomUpdate",
            room: rooms[roomId]
        };
        if (leaver) {
            msg["leaver"] = leaver;
        }
        sendTo(connection, msg);
    });
}

// Sends a canvas update to all users
function sendCanvasUpdate() {
    for (user in users) {
        if (users[user].roomId) { // If users is in a room
            sendTo(users[user], {
                type: "canvasUpdate",
                avatars: rooms[users[user].roomId].avatars,
                name: "SERVER"
            });
        }
    }
}

// Relays an offer to all users of a given room
function relayOffer(offer, roomId, sender) {
    // Relay offer to all users in room
    rooms[roomId].users.forEach((user) => {
        // Exclude sender
        if (user !== sender) {
            sendTo(users[user], {
                type: "offer",
                name: sender,
                offer: offer
            });
        }
    });
}

// Utility functions

function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}

function log(data) {
    console.log(`[${(process.uptime()).toFixed(2)}]\t ${data}`);
}