var WebSocketServer = require('ws').Server;

const port = 9090;
// Create WebSocket server at port 9090
var server = new WebSocketServer({ port: port });

console.log("Signaling server live at port " + port)

var users = {};

server.on('connection', (connection) => {
    console.log("connection received");

    connection.on('message', (message) => {
        console.log("message receieved: " + message);

        var data;
        // Filter non-JSON messages
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Invalid JSON");
            data = {};
        }

        switch (data.type) {
            case "login":
                console.log("User logged: " + data.name);

                if (users[data.name]) { // Check is user already exists / is logged in
                    sendTo(connection, {
                        type: "login",
                        success: false
                    });
                } else { // Register user as connected
                    users[data.name] = connection;
                    connection.name = data.name;

                    sendTo(connection, {
                        type: "login",
                        success: true
                    });
                }
                break;

                // Offering a call
            case "offer":
                console.log("Sending offer to: " + data.name);

                // Get offeree from user registry
                var conn = users[data.name];

                if (conn != null) {
                    connection.otherName = data.name;
                    // Send offer to offeree
                    sendTo(conn, {
                        type: "offer",
                        offer: data.offer,
                        name: connection.name
                    });
                }
                break;

                // Answering a call
            case "answer":
                console.log("Sending answer to: ", data.name);

                // Get offerer from user registry
                var conn = users[data.name];

                if (conn != null) {
                    connection.otherName = data.name;
                    // Send answer to offerer
                    sendTo(conn, {
                        type: "answer",
                        answer: data.answer
                    });
                }
                break;

            case "hangup":
                console.log("Disconnecting from: " + data.name);

                // Get other user from user registry
                var conn = users[data.name];
                conn.otherName = null;

                // Notify other user of call ending
                if (conn != null) {
                    sendTo(conn, {
                        type: "leave"
                    });
                }
                break;

            case "candidate":
                console.log("Sending candidate to: " + data.name);

                // Get recipient from user registry
                var conn = users[data.name];

                if (conn != null) {
                    sendTo(conn, {
                        type: "candidate",
                        candidate: data.candidate
                    });
                }
                break;

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
            delete users[connection.name];

            if (connection.otherName) {
                console.log("Disconnecting from: " + connection.otherName);
                var conn = users[connection.otherName];
                conn.otherName = null;

                if (conn != null) {
                    sendTo(conn, {
                        type: "leave"
                    });
                }
            }
        }
    })

    //connection.send("Hello");
});

function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}