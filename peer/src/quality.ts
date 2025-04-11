interface RTCStats {
  id: string;
  timestamp: number;
  type: RTCStatsType;
}

type RTCStatsType =
  | "candidate-pair"
  | "certificate"
  | "codec"
  | "data-channel"
  | "ice-candidate"
  | "ice-server"
  | "inbound-rtp"
  | "local-candidate"
  | "outbound-rtp"
  | "peer-connection"
  | "remote-candidate"
  | "remote-inbound-rtp"
  | "remote-outbound-rtp"
  | "rtp-sender"
  | "rtp-receiver"
  | "sctp-transport"
  | "track"
  | "transport";

interface RTCReceiverStats extends RTCStats {
  type: "inbound-rtp" | "rtp-receiver" | "remote-outbound-rtp";
  kind?: "audio" | "video";
  bytesReceived?: number;
  packetsReceived?: number;
  packetsLost?: number;
  jitter?: number;
  framesDecoded?: number;
  framesDropped?: number;
  framesPerSecond?: number;
  totalSamplesReceived?: number;
}

interface RTCIceCandidatePairStats extends RTCStats {
  type: "candidate-pair";
  state?:
    | "new"
    | "checking"
    | "connected"
    | "completed"
    | "failed"
    | "disconnected";
  roundTripTime?: number;
  localCandidateId?: string;
  remoteCandidateId?: string;
}

interface RTCPeerConnectionStats extends RTCStats {
  type: "peer-connection";
  iceConnectionState?:
    | "new"
    | "checking"
    | "connected"
    | "completed"
    | "failed"
    | "disconnected"
    | "closed";
  iceGatheringState?: "new" | "gathering" | "complete";
}

export function calculateQualityScore(stats: RTCStatsReport): number {
  let audioReceiverStats: RTCReceiverStats | undefined;
  let videoReceiverStats: RTCReceiverStats | undefined;
  let activeCandidatePairStats: RTCIceCandidatePairStats | undefined;
  let peerConnectionStats: RTCPeerConnectionStats | undefined;

  for (const stat of stats.values()) {
    if (stat.type === "inbound-rtp" || stat.type === "rtp-receiver") {
      const receiverStat = stat as RTCReceiverStats;
      if (receiverStat.kind === "audio") {
        audioReceiverStats = receiverStat;
      } else {
        videoReceiverStats = receiverStat;
      }
    } else if (stat.type === "candidate-pair") {
      const candidatePairStat = stat as RTCIceCandidatePairStats;
      if (candidatePairStat.state === "connected") {
        activeCandidatePairStats = candidatePairStat;
      }
    } else if (stat.type === "peer-connection") {
      peerConnectionStats = stat as RTCPeerConnectionStats;
    }
  }

  if (
    peerConnectionStats && peerConnectionStats.iceConnectionState &&
    !["connected", "completed"].includes(peerConnectionStats.iceConnectionState)
  ) {
    return 15; // Low score for connection issues
  }

  let audioQuality = 100;
  if (audioReceiverStats) {
    const packetsLost = audioReceiverStats.packetsLost ?? 0;
    const packetsReceived = audioReceiverStats.packetsReceived ?? 0;
    const audioPacketLossRatio = packetsReceived > 0
      ? packetsLost / packetsReceived
      : 0;
    const audioPacketLossScore = Math.max(
      0,
      100 - (audioPacketLossRatio * 100),
    );
    const audioJitter = audioReceiverStats.jitter ?? 0;
    const audioJitterScore = audioJitter < 0.02
      ? 100
      : (audioJitter < 0.1 ? 70 : 30);
    audioQuality = (audioPacketLossScore + audioJitterScore) / 2;
  }

  let videoQuality = 100;
  if (videoReceiverStats) {
    const packetsLost = videoReceiverStats.packetsLost ?? 0;
    const packetsReceived = videoReceiverStats.packetsReceived ?? 0;
    const videoPacketLossRatio = packetsReceived > 0
      ? packetsLost / packetsReceived
      : 0;
    const videoPacketLossScore = Math.max(
      0,
      100 - (videoPacketLossRatio * 100),
    );
    const videoJitter = videoReceiverStats.jitter ?? 0;
    const videoJitterScore = videoJitter < 0.02
      ? 100
      : (videoJitter < 0.1 ? 70 : 30);
    const framesDropped = videoReceiverStats.framesDropped ?? 0;
    const framesDecoded = videoReceiverStats.framesDecoded ?? 0;
    const frameDropRatio = framesDecoded > 0
      ? framesDropped / framesDecoded
      : 0;
    const videoFrameDropScore = Math.max(0, 100 - (frameDropRatio * 100));
    const videoFps = videoReceiverStats.framesPerSecond;
    const videoFpsScore = videoFps !== undefined
      ? Math.min(100, (videoFps / 15) * (100 / 1))
      : 100;
    videoQuality =
      (videoPacketLossScore + videoJitterScore + videoFrameDropScore +
        videoFpsScore) / 4;
  }

  let latencyScore = 80;
  if (activeCandidatePairStats) {
    const rtt = activeCandidatePairStats.roundTripTime;
    if (rtt !== undefined) {
      latencyScore = rtt < 0.1 ? 100 : (rtt < 0.3 ? 80 : (rtt < 0.5 ? 60 : 40));
    }
  }

  const overallQuality = Math.round(
    (videoQuality * 0.5) + (audioQuality * 0.3) + (latencyScore * 0.2),
  );
  return Math.max(0, Math.min(100, overallQuality));
}
