import { type ParticipantConfig, type RemoteVideoTrack } from "@pulsebeam/web";
export * from "@pulsebeam/web";
export interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    track: RemoteVideoTrack;
    className?: string;
    style?: React.CSSProperties;
}
export declare function Video(props: VideoProps): import("react/jsx-runtime").JSX.Element;
export declare const Audio: ({ track, ...props }: any) => import("react/jsx-runtime").JSX.Element;
export declare function useParticipant(config: ParticipantConfig): import("@pulsebeam/core").ParticipantSnapshot;
export declare function useDeviceManager(): import("@pulsebeam/core").DeviceSnapshot;
export declare function useDisplayManager(): import("@pulsebeam/core").DisplaySnapshot;
