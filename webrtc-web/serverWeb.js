const https = require('https');
const express = require('express');
const fs = require('fs');
const path = require('path');
const requestIp = require('request-ip');

const port = 8080;

var server = express();
server.use(requestIp.mw())

// Certificate config
const conf = {
    key: fs.readFileSync('cert/key.pem'),
    cert: fs.readFileSync('cert/cert.pem')
};


// Static resources
server.use(express.static('static'));


server.get('/', (req, res) => {
    const ip = req.clientIp
    res.sendFile(path.join(__dirname + "/index.html"));
    console.log("User from " + ip + " requested root");
});

https.createServer(conf, server).listen(port, () => {
    console.log(`Webserver live at https://localhost:${port}`);
});