const https = require('https');
const express = require('express');
const fs = require('fs');
const path = require('path');

const port = 8080;

var server = express();

// Certificate config
const conf = {
    key: fs.readFileSync('cert/key.pem'),
    cert: fs.readFileSync('cert/cert.pem')
};

// Static resources
server.use(express.static('static'));

server.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + "/index.html"));
});

https.createServer(conf, server).listen(port, () => {
    console.log(`Webserver live at https://localhost:${port}`);
});