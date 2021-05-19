const http = require('http');
const express = require('express');
const WebSocketServer = require('ws').Server;

const http_port = 80;
const socket_port = 8082;

const fs = require('fs');
const path = require('path');
const requestIp = require('request-ip');

var httpServer = express();
httpServer.use(requestIp.mw());
httpServer.use(express.static('static'));

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

            default: connection.send("Unknown command");
            break;
        }
    });

    connection.on('close', () => {
        logs("Connection closed");
    });
});

// Utility functions

function logw(data) {
    log("[W] " + data);
}

function logs(data) {
    log("[S] " + data);
}

function log(data) {
    console.log(`[${(process.uptime()).toFixed(2)}] ${data}`);
}