const http = require('http');
const express = require('express');
const WebSocketServer = require('ws').Server;

const http_port = 80;
const socket_port = 8082;

const path = require('path');
const requestIp = require('request-ip');

var httpServer = express();
httpServer.use(requestIp.mw());
httpServer.use(express.static('static'));

var users = {}; // Key-value pairs of username:connection
var room = {
    owner: "",
    users: [],
    avatars: []
};

// WEB SERVER

http.createServer(httpServer).listen(http_port, () => {
    logw(`HTTP server live at http://localhost:${http_port}`);
});

httpServer.get('/', (req, res) => {
    const ip = req.clientIp
    res.sendFile(path.join(__dirname + "/index.html"));
    logw("User from " + ip + " requested root");
});

// SOCKET SERVER

var wsServer = new WebSocketServer({ port: socket_port });

wsServer.on('connection', (connection) => {
    logs("Connection received");

    connection.on('message', (message) => {
        var data;
        logs(message);

        // Filter non-JSON messages
        try {
            data = JSON.parse(message);
        } catch (e) {
            logs("Invalid JSON");
            data = {};
        }

        switch (data.type) {

            case "login":
                logs("[login]: " + message);

                if (users[data.name]) { // Check if user already exists / is logged
                    sendTo(connection, {
                        type: "login",
                        success: false
                    });
                } else { // Register user
                    users[data.name] = connection;
                    connection.name = data.name;
                    room.users.push(data.name);

                    sendTo(connection, {
                        type: "login",
                        room: room,
                        success: true
                    });
                    logs("User logged: " + data.name);

                    createAvatar(data);
                    sendRoomUpdate();
                }
                break;

            case "chat":
                logs("[chat]: " + message);
                // Relay chat message to all users
                room.users.forEach((user) => {
                    sendTo(users[user], data);
                });
                break;

            case "canvasUpdate":
                log("Canvas update received from: " + data.name);
                // Update room avatars on server
                room.avatars = data.avatars;
                // Relay canvas update to all users
                room.users.forEach((user) => {
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
                // Relay candidate to all users except self
                room.users.forEach((user) => {
                    if (user != data.name) {
                        sendTo(users[user], data);
                    }
                });
                break;

            case "ping":
                logs("PING");
                sendTo(connection, {
                    type: "ping"
                });
                break;

            default:
                logs("[error]: " + data.type + " not recognized");
                sendTo(connection, {
                    type: "error",
                    message: "Command not found: " + data.type
                });
        }
    });

    connection.on('close', () => {
        if (connection.name) {
            logs("Connection closed: " + connection.name);

            leaveRoom(connection.name);
            removeAvatar(connection.name);

            delete users[connection.name]
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
    // Sometimes results in strings that are one digit too short (5 instead of 6)
    if (color.length == 5) {
        color = "0" + color;
    }

    room.avatars.push({ name: data.name, x: x, y: y, width: size, height: size, fill: `#${color}`, isDragging: false });

    sendCanvasUpdate();
}

function removeAvatar(username) {
    // Get list of avatars of room associated with user
    var avatars = room.avatars;
    for (let i = 0; i < avatars.length; i++) {
        if (avatars[i].name === username) {
            avatars.splice(i, 1);
        }
    }
    sendCanvasUpdate();
}

function leaveRoom(username) {
    // Remove username from room
    for (let i = 0; i < room.users.length; i++) {
        if (room.users[i] === username) {
            room.users.splice(i, 1);
        }
    }
    sendRoomUpdate(username);
}

function sendRoomUpdate(leaver) {

    room.users.forEach((user) => {
        // Get connection of user
        var connection = users[user];
        // Compose leave message
        var msg = {
            type: "roomUpdate",
            room: room
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
        sendTo(users[user], {
            type: "canvasUpdate",
            avatars: room.avatars,
            name: "SERVER"
        });
    }
}

// Relays an offer to all users of a given room
function relayOffer(offer, sender) {
    // Relay offer to all users in room
    users.forEach((user) => {
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

function logw(data) {
    log("[W] " + data);
}

function logs(data) {
    log("[S] " + data);
}

function log(data) {
    console.log(`[${(process.uptime()).toFixed(2)}] ${data}`);
}