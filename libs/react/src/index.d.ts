import { type ParticipantConfig } from "@pulsebeam/web";
export * from "@pulsebeam/web";
export declare const Video: ({ track, ...props }: any) => import("react/jsx-runtime").JSX.Element;
export declare const Audio: ({ track, ...props }: any) => import("react/jsx-runtime").JSX.Element;
export declare function useParticipant(config: ParticipantConfig): import("@pulsebeam/core").ParticipantSnapshot;
export declare function useDeviceManager(): import("@pulsebeam/core").DeviceSnapshot;
export declare function useDisplayManager(): import("@pulsebeam/core").DisplaySnapshot;
