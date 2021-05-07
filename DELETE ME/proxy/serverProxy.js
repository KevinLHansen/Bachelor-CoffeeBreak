const fs = require('fs');
const WebSocketServer = require('ws').Server;
const HttpsServer = require('https').createServer;

const port = 8074;

var connections = {};

const conf = {
    key: fs.readFileSync('cert/key.pem'),
    cert: fs.readFileSync('cert/cert.pem')
};

var https = HttpsServer(conf);
var wss = new WebSocketServer({ server: https });

https.listen(port);

console.log(`Proxy server live at https://localhost:${port}`);

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

        switch (data.type) {
            case "register":
                console.log("register | " + message);

                var id = Math.floor(Math.random() * 10000);
                sendTo(connection, {
                    type: "register",
                    id: id
                });
                connections[id] = connection;
                connections[id].id = id;

                for (id in connections) {
                    console.log("- " + id);
                }

                break;
            case "getPeers":
                console.log("getPeers | " + data.id);
                var peers = [];
                for (id in connections) {
                    peers.push(id);
                }
                sendTo(connection, {
                    type: "getPeers",
                    peers: peers
                });
                break;
            case "offer":
                console.log("offer | " + data.offerer + " -> " + data.answerer);
                sendTo(connections[data.answerer], data);
                break;
            case "answer":
                console.log("answer | " + data.answerer + " -> " + data.offerer);
                sendTo(connections[data.offerer], data)
                break;
            case "candidate":
                console.log("candidate | " + data.id);
                for (id in connections) {
                    if (id != data.id) {
                        sendTo(connections[id], data);
                    }
                }
                break;
        }
    });

    // Unregister user when connection closes
    connection.on('close', () => {
        if (connection.id) {
            console.log("User disconnected: " + connection.id);
            delete connections[connection.id];
        }
    });
});


// Utility functions

function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}

function log(id, log) {
    sendTo(connections[id], {
        type: "log",
        log: log
    });
}