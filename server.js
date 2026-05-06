const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mediasoup = require("mediasoup");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let worker;
let router;
let producerTransport;
let producer;

let consumers = [];

(async () => {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000
      }
    ]
  });

  console.log("Mediasoup worker started");
})();

wss.on("connection", (ws) => {
  ws.on("message", async (msg) => {
    const data = JSON.parse(msg);

    switch (data.type) {
      case "getRtpCapabilities":
        ws.send(JSON.stringify({
          type: "rtpCapabilities",
          data: router.rtpCapabilities
        }));
        break;

      case "createProducerTransport":
        producerTransport = await router.createWebRtcTransport({
          listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
          enableUdp: true,
          enableTcp: true
        });

        ws.send(JSON.stringify({
          type: "producerTransportCreated",
          data: producerTransport
        }));
        break;

      case "connectProducerTransport":
        await producerTransport.connect({
          dtlsParameters: data.dtlsParameters
        });
        break;

      case "produce":
        producer = await producerTransport.produce({
          kind: data.kind,
          rtpParameters: data.rtpParameters
        });

        ws.send(JSON.stringify({ type: "produced" }));
        break;

      case "createConsumerTransport":
        const consumerTransport = await router.createWebRtcTransport({
          listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
          enableUdp: true,
          enableTcp: true
        });

        consumers.push({ transport: consumerTransport });

        ws.send(JSON.stringify({
          type: "consumerTransportCreated",
          data: consumerTransport
        }));
        break;

      case "consume":
        const consumerTransportObj = consumers[consumers.length - 1].transport;

        const consumer = await consumerTransportObj.consume({
          producerId: producer.id,
          rtpCapabilities: data.rtpCapabilities,
          paused: false
        });

        ws.send(JSON.stringify({
          type: "consumed",
          data: {
            id: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters
          }
        }));
        break;
    }
  });
});

server.listen(3001, () => console.log("SFU running on port 3001"));
