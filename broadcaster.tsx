import React, { useEffect, useRef } from "react";
import * as mediasoupClient from "mediasoup-client";

export default function Broadcaster() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");

    let device: any;
    let producerTransport: any;

    navigator.mediaDevices.getUserMedia({ video: true }).then(async (stream) => {
      videoRef.current!.srcObject = stream;

      socket.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "rtpCapabilities") {
          device = new mediasoupClient.Device();
          await device.load({ routerRtpCapabilities: data.data });

          socket.send(JSON.stringify({ type: "createProducerTransport" }));
        }

        if (data.type === "producerTransportCreated") {
          producerTransport = device.createSendTransport(data.data);

          producerTransport.on("connect", ({ dtlsParameters }, cb) => {
            socket.send(JSON.stringify({
              type: "connectProducerTransport",
              dtlsParameters
            }));
            cb();
          });

          producerTransport.on("produce", ({ kind, rtpParameters }, cb) => {
            socket.send(JSON.stringify({
              type: "produce",
              kind,
              rtpParameters
            }));
            cb();
          });

          const track = stream.getVideoTracks()[0];
          await producerTransport.produce({ track });
        }
      };

      socket.send(JSON.stringify({ type: "getRtpCapabilities" }));
    });
  }, []);

  return <video ref={videoRef} autoPlay muted width="400" />;
}
