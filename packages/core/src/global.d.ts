export { };

declare global {
  interface RTCRtpEncodingParameters {
    maxBitrate?: number;
  }

  interface RTCRtpReceiver {
    readonly track: MediaStreamTrack;
  }

  interface MediaStreamTrack {
    readonly kind: "video" | "audio";
  }
}
