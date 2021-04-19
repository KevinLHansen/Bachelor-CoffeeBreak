var WebSocketServer = require('ws').Server;

const port = 9090;
// Create WebSocket server at port 9090
var server = new WebSocketServer({ port: port });

console.log("Proxy server live at port " + port);

var users = {};

server.on('connection', (connection) => {
    console.log("Connection received");

    connection.on('message', (message) => {
        console.log("Message recieved: " + message);

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
                }
                break;

            case "chat":
                console.log("Chat received: " + data.name + ": " + data.message);
                // Redirect chat message to all users
                for (user in users) {
                    sendTo(users[user], data);
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
            console.log("User disconnected: " + connection.name);
            delete users[connection.name];
        }
    });
});

function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}