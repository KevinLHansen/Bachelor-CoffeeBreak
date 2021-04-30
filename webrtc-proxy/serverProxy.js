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

var users = {};
var avatars = [];

wss.on('connection', (connection) => {
    console.log("Connection received");

    // Send initial canvas update (temporary)
    sendTo(connection, {
        type: "canvasUpdate",
        avatars: avatars
    });

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
                    // Don't send to sender
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