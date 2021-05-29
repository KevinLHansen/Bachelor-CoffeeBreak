var debugContainer = document.getElementById("debugContainer");

var latencies;

window.setInterval(() => {
    debugContainer.innerHTML = "";
    for (latency in latencies) {
        debugContainer.innerHTML += "<span>" + latency + ": " + latencies[latency] + "</span><br>"
    }

    latencies = {};

    peerConnections.forEach((connection) => {

        var sender = connection.getSenders()[0];
        latencies[connection.name] = "?";

        sender.getStats().then((reports) => {
            reports.forEach((report) => {

                if (report.type == "remote-inbound-rtp") {
                    latencies[connection.name] = report.roundTripTime;
                }
            });
        });
    });
}, 1000);