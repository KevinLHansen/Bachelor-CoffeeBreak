const http = require('http');
const express = require('express');
const WebSocketServer = require('ws').Server;

const http_port = 80;
const socket_port = 8082;

const fs = require('fs');
const path = require('path');
const requestIp = require('request-ip');

const k8s = require('@kubernetes/client-node');
const { PortForward, V1Pod } = require('@kubernetes/client-node');
const kubeConf = new k8s.KubeConfig();

const ingressName = "ing-coffeebreak";
const namespace = "group2";

kubeConf.loadFromCluster(); // in-cluster
//kubeConf.loadFromDefault(); // locally

const k8sCoreApi = kubeConf.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kubeConf.makeApiClient(k8s.AppsV1Api);
const k8sNetworkApi = kubeConf.makeApiClient(k8s.NetworkingV1Api)


// WEB SERVER

var httpServer = express();
httpServer.use(requestIp.mw());
httpServer.use(express.static('static'));

http.createServer(httpServer).listen(http_port, function() {
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

        // Filter non-JSON messages
        try {
            data = JSON.parse(message);
        } catch (e) {
            logs("Invalid JSON");
            data = {};
        }

        switch (data.type) {
            case "createRoom":
                logs("createRoom");

                onCreateRoom(data, connection);

                break;

            case "deleteRoom":
                logs("deleteRoom");
                onDeleteRoom(data);
                break;

            case "joinRoom":
                break;

            case "ping":
                logs("PING");
                sendTo(connection, {
                    type: "ping"
                });
                break;

            default:
                connection.send({
                    type: "error",
                    message: "Uknown command: " + data.type
                });
        }
    });

    connection.on('close', () => {
        logs("Connection closed");
    });
});

// KUBERNETES

async function onDeleteRoom(data) {
    k8sCoreApi.deleteNamespacedPod(data.roomName, namespace).then((res) => {
        console.log(res.body);
    }).catch((err) => {
        console.log(err);
    });
}

async function onCreateRoom(data, connection) {
    var success;
    try {
        var res = await createRoomPod(data.roomName);
    } catch (err) {
        console.log(err.response.body);
    }

    if (res) {
        // Room Pod creation successful
        logs("Created Pod: room-" + data.roomName);
        success = true;
        // Create Service and Ingress paths
        try {
            createRoomService(data.roomName);
            addIngressPath(data.roomName);
        } catch (err) {
            console.log(err.response.body);
        }
    } else {
        success = false;
    }
    // Notify client of result
    sendTo(connection, {
        type: "createRoom",
        roomName: data.roomName,
        success: success
    });
}

async function createRoomPod(roomName) {
    return k8sCoreApi.createNamespacedPod(namespace, {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
            name: "room-" + roomName,
            labels: {
                app: "room-" + roomName
            }
        },
        spec: {
            serviceAccountName: "group2-user",
            containers: [{
                name: "con-" + roomName,
                image: "benjaminhck/coffeebreak-room:latest",
                ports: [{
                    containerPort: 80,
                }, {
                    containerPort: 8082
                }]
            }]
        }
    });
}

async function createRoomService(roomName) {
    return k8sCoreApi.createNamespacedService(namespace, {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
            name: 'svc-' + roomName
        },
        spec: {
            type: 'LoadBalancer',
            selector: {
                app: 'room-' + roomName
            },
            ports: [{
                name: 'room',
                port: 8075,
                targetPort: 80
            }, {
                name: 'socket',
                port: 8082,
                targetPort: 8082
            }]
        }
    });
}

async function addIngressPath(roomName) {
    // Build the patches
    const patch = [];
    // Path for WebServer
    patch.push({
        "op": "add",
        "path": "/spec/rules/0/http/paths/-",
        "value": {
            "path": "/" + roomName + "(/|$)(.*)",
            "pathType": "Exact",
            "backend": {
                "service": {
                    "name": "svc-" + roomName,
                    "port": {
                        "number": 8075
                    }
                }
            }
        }
    });
    // Path for WebSocket server
    patch.push({
        "op": "add",
        "path": "/spec/rules/0/http/paths/-",
        "value": {
            "path": "/" + roomName + "/ws" + "(/|$)(.*)",
            "pathType": "Exact",
            "backend": {
                "service": {
                    "name": "svc-" + roomName,
                    "port": {
                        "number": 8082
                    }
                }
            }
        }
    });

    const options = {
        "headers": {
            "Content-Type": k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH
        }
    };

    return k8sNetworkApi.patchNamespacedIngress(ingressName, namespace, patch, undefined, undefined, undefined, undefined, options);
}

async function removeIngressPath(index) {
    const patch = [];
    patch.push({
        "op": "remove",
        "path": "/spec/rules/0/http/paths/" + index
    });

    const options = {
        "headers": {
            "Content-Type": k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH
        }
    };

    k8sNetworkApi.patchNamespacedIngress(ingressName, namespace, patch, undefined, undefined, undefined, undefined, options).then((res) => {
        console.log("statusCode: " + res.response.statusCode);
    }).catch((err) => {
        console.log(err);
    })
}

function getPods() {
    k8sCoreApi.listNamespacedPod(namespace).then((res) => {
        return res;
    }).catch((err) => {
        console.log(err);
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