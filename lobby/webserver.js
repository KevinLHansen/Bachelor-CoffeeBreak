const https = require('https');
const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');
const requestIp = require('request-ip');

const https_port = 443;
const http_port = 80;

var httpServer = express();
//var server = express();

httpServer.use(requestIp.mw())

// Certificate config
const conf = {
    key: fs.readFileSync('cert/key.pem'),
    cert: fs.readFileSync('cert/cert.pem')
};

// Static resources
httpServer.use(express.static('static'));


// Setup redirect server
// httpServer.get("/", function(req, res, next) {
//     res.redirect("https://" + req.headers.host);
// });

// HTTPS
httpServer.get('/', (req, res) => {
    const ip = req.clientIp
    res.sendFile(path.join(__dirname + "/index.html"));
    console.log("User from " + ip + " requested root");
});

http.createServer(httpServer).listen(http_port, function() {
    console.log(`HTTP redirect server live at http://localhost:${http_port}`);
});

// https.createServer(conf, server).listen(https_port, () => {
//     console.log(`Webserver live at https://localhost:${https_port}`);
// });