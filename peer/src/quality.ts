export interface ChannelStats {
  rttMs?: number;
  jitterMs?: number;
  packetLossPercent?: number;
  availableOutgoingBitrateKbps?: number;
  frameRate?: number;
  resolution?: {
    width: number;
    height: number;
  };
  freezeCount?: number;
  audioLevelVariance?: number;
  messagesSent?: number;
  messagesReceived?: number;
  messagesLost?: number;
}

export interface WebRTCStats {
  audio: ChannelStats[];
  video: ChannelStats[];
  data: ChannelStats[];
}

export interface MetricWeight {
  weight: number;
  scoreFunction: (value: number) => number;
}

function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function aggregateChannelStats(channelStats: ChannelStats[]): ChannelStats {
  const aggregated: ChannelStats = {};

  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const avg = (values: number[]) =>
    values.length ? sum(values) / values.length : undefined;

  const collect = (key: keyof ChannelStats) =>
    channelStats.map((stat) => stat[key]).filter((v): v is number =>
      typeof v === "number"
    );

  aggregated.rttMs = avg(collect("rttMs"));
  aggregated.jitterMs = avg(collect("jitterMs"));
  aggregated.packetLossPercent = avg(collect("packetLossPercent"));
  aggregated.availableOutgoingBitrateKbps = avg(
    collect("availableOutgoingBitrateKbps"),
  );
  aggregated.frameRate = avg(collect("frameRate"));
  aggregated.freezeCount = sum(collect("freezeCount"));
  aggregated.audioLevelVariance = avg(collect("audioLevelVariance"));
  aggregated.messagesSent = sum(collect("messagesSent"));
  aggregated.messagesReceived = sum(collect("messagesReceived"));
  aggregated.messagesLost = sum(collect("messagesLost"));

  const resolutions = channelStats.map((stat) => stat.resolution).filter(
    Boolean,
  ) as { width: number; height: number }[];
  if (resolutions.length) {
    aggregated.resolution = {
      width: Math.round(avg(resolutions.map((r) => r.width))!),
      height: Math.round(avg(resolutions.map((r) => r.height))!),
    };
  }

  return aggregated;
}

export function calculateWebRTCQuality(stats: WebRTCStats): number {
  const metricsConfig: Record<string, MetricWeight> = {
    rttMs: { weight: 0.2, scoreFunction: (v) => 1 - normalize(v, 50, 400) },
    jitterMs: { weight: 0.15, scoreFunction: (v) => 1 - normalize(v, 5, 50) },
    packetLossPercent: {
      weight: 0.2,
      scoreFunction: (v) => 1 - normalize(v, 0, 5),
    },
    availableOutgoingBitrateKbps: {
      weight: 0.15,
      scoreFunction: (v) => normalize(v, 300, 2500),
    },
    frameRate: { weight: 0.1, scoreFunction: (v) => normalize(v, 15, 60) },
    audioLevelVariance: {
      weight: 0.05,
      scoreFunction: (v) => normalize(v, 0, 0.5),
    },
    messagesLost: {
      weight: 0.15,
      scoreFunction: (v) => 1 - normalize(v, 0, 5),
    },
  };

  const aggregateAndScore = (channelStats: ChannelStats[]): number => {
    // no data, we assume not connecting
    if (channelStats.length === 0) return 0;

    const aggregated = aggregateChannelStats(channelStats);

    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, config] of Object.entries(metricsConfig)) {
      const value = (aggregated as any)[key];
      if (typeof value === "number") {
        totalScore += config.scoreFunction(value) * config.weight;
        totalWeight += config.weight;
      }
    }

    const score = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 100;
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const audioScore = aggregateAndScore(stats.audio);
  const videoScore = aggregateAndScore(stats.video);
  const dataScore = aggregateAndScore(stats.data);

  const overallScore = Math.round((audioScore + videoScore + dataScore) / 3);
  return overallScore;
}

export function collectWebRTCStats(
  statsReport: RTCStatsReport,
): WebRTCStats {
  const audioStats: ChannelStats[] = [];
  const videoStats: ChannelStats[] = [];
  const dataStats: ChannelStats[] = [];

  statsReport.forEach((report) => {
    if (report.type === "inbound-rtp" || report.type === "outbound-rtp") {
      const baseStats: ChannelStats = {
        rttMs: (report.roundTripTime ?? report.currentRoundTripTime)
          ? ((report.roundTripTime ?? report.currentRoundTripTime) * 1000)
          : undefined,
        jitterMs: report.jitter ? report.jitter * 1000 : undefined,
        packetLossPercent:
          report.packetsLost !== undefined && report.packetsSent !== undefined
            ? (report.packetsLost / (report.packetsSent + report.packetsLost)) *
            100
            : undefined,
        availableOutgoingBitrateKbps: report.availableOutgoingBitrate
          ? report.availableOutgoingBitrate / 1000
          : undefined,
        frameRate: report.framesPerSecond,
        resolution: report.frameWidth && report.frameHeight
          ? { width: report.frameWidth, height: report.frameHeight }
          : undefined,
        messagesSent: report.packetsSent,
        messagesReceived: report.packetsReceived,
        messagesLost: report.packetsLost,
      };

      if (report.kind === "audio") {
        audioStats.push(baseStats);
      } else if (report.kind === "video") {
        videoStats.push(baseStats);
      }
    }

    if (report.type === "data-channel") {
      const dataChannelStats: ChannelStats = {
        messagesSent: report.messagesSent,
        messagesReceived: report.messagesReceived,
        messagesLost: undefined, // WebRTC stats API does not yet expose lost messages for data channels
      };
      dataStats.push(dataChannelStats);
    }

    if (report.type === "candidate-pair" && report.selected) {
      const rttMs = report.currentRoundTripTime
        ? report.currentRoundTripTime * 1000
        : undefined;
      [...audioStats, ...videoStats, ...dataStats].forEach((stat) => {
        stat.rttMs = stat.rttMs ?? rttMs;
      });
    }
  });

  return {
    audio: audioStats,
    video: videoStats,
    data: dataStats,
  };
}
