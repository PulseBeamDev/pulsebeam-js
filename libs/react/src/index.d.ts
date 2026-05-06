import { type ParticipantConfig, type RemoteVideoTrack } from "@pulsebeam/web";
export * from "@pulsebeam/web";
export declare const Video: ({ track, className, style, ...props }: {
    track: RemoteVideoTrack;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
}) => import("react/jsx-runtime").JSX.Element;
export declare const Audio: ({ track, ...props }: any) => import("react/jsx-runtime").JSX.Element;
export declare function useParticipant(config: ParticipantConfig): import("@pulsebeam/core").ParticipantSnapshot;
export declare function useDeviceManager(): import("@pulsebeam/core").DeviceSnapshot;
export declare function useDisplayManager(): import("@pulsebeam/core").DisplaySnapshot;
