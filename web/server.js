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

// kubeConf.loadFromCluster(); // in-cluster
kubeConf.loadFromDefault(); // locally

const k8sCoreApi = kubeConf.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kubeConf.makeApiClient(k8s.AppsV1Api);
const k8sNetworkApi = kubeConf.makeApiClient(k8s.NetworkingV1beta1Api)

var httpServer = express();
httpServer.use(requestIp.mw());
httpServer.use(express.static('static'));

// WEB SERVER

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
        logs(message);

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
                onCreateRoom(data);
                break;

            case "deleteRoom":
                logs("deleteRoom");
                onDeleteRoom(data);
                break;

            case "joinRoom":
                break;

            case "testIngress":
                logs("generateIngressPath")
                generateIngressPath(data)
        }
    });

    connection.on('close', () => {
        logs("Connection closed");
    });
});

// KUBERNETES

async function onDeleteRoom(data) {
    k8sCoreApi.deleteNamespacedPod(data.roomName, "group2").then((res) => {
        console.log(res.body);
    }).catch((err) => {
        console.log(err);
    });
}

async function onCreateRoom(data) {

    k8sCoreApi.createNamespacedPod("group2", {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
            name: data.roomName,
            labels: {
                app: data.roomName
            }
        },
        spec: {
            serviceAccountName: "group2-user",
            containers: [{
                name: "coffeebreak-room-pod",
                image: "benjaminhck/coffeebreak-proxy:latest",
                ports: [
                    { containerPort: 80 }
                ]
            }]
        }
    }).then((res) => {
        console.log(res.body);
    }).catch((err) => {
        console.log(err);
    });
}

    async function generateIngressPath(data) {
        console.log(data.ingressName)
        k8sNetworkApi.createNamespacedIngress('group2', {
            apiVersions: 'networking.k8s.io/v1beta1',
            kind: 'Ingress',
            metadata: { name: `room-`+ data.ingressName },
            spec: {
              rules: [{
                host: `group2.sempro0.uvm.sdu.dk`,
                http: {
                  paths: [{
                    backend: {
                      serviceName: 'test-ingress1',
                      servicePort: 80
                    },
                    path: '/' + data.ingressName
                  }]
                }
              }],
            }
          }).catch(e => console.log(e))
    }

    // k8sAppsApi.readNamespacedDeployment("coffeebreak-proxy-deployment", "group2").then((res) => {
    //     console.log(res.body);
    // }).catch((err) => {
    //     console.log(err);
    // });


function getPods() {
    k8sCoreApi.listNamespacedPod("group2").then((res) => {
        return res;
    }).catch((err) => {
        console.log(err);
    });
}

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