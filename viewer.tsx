import React, { useEffect, useRef } from "react";
import * as mediasoupClient from "mediasoup-client";

export default function Viewer() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");

    let device: any;
    let consumerTransport: any;

    socket.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "rtpCapabilities") {
        device = new mediasoupClient.Device();
        await device.load({ routerRtpCapabilities: data.data });

        socket.send(JSON.stringify({ type: "createConsumerTransport" }));
      }

      if (data.type === "consumerTransportCreated") {
        consumerTransport = device.createRecvTransport(data.data);

        socket.send(JSON.stringify({
          type: "consume",
          rtpCapabilities: device.rtpCapabilities
        }));
      }

      if (data.type === "consumed") {
        const consumer = await consumerTransport.consume(data.data);

        const stream = new MediaStream();
        stream.addTrack(consumer.track);

        videoRef.current!.srcObject = stream;
      }
    };

    socket.send(JSON.stringify({ type: "getRtpCapabilities" }));
  }, []);

  return <video ref={videoRef} autoPlay controls width="500" />;
}
