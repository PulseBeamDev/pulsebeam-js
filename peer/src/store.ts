import {
  atom,
  computed,
  map,
  PreinitializedMapStore,
  PreinitializedWritableAtom,
  ReadableAtom,
} from "nanostores";
import { Peer, PeerInfo, PeerState } from "./peer.ts";

export type Value = string | number | undefined;
export type Key = string;

interface CRDTEntry {
  value: Value;
  version: number;
  replicaId: string;
}

export type KVStore = Record<Key, Value>;
type CRDTKV = Record<Key, CRDTEntry>;

interface CRDTRemoteUpdate {
  key: Key;
  entry: CRDTEntry;
}

export interface RemotePeer {
  info: PeerInfo;
  streams: MediaStream[];
  state: RTCPeerConnectionState;
}

export class PeerStore {
  public static readonly KV_NAMESPACE = "__crdt_kv";
  public readonly $kv: PreinitializedMapStore<KVStore> & object;
  public readonly $streams:
    & PreinitializedMapStore<Record<string, MediaStream | undefined>>
    & object;

  public readonly $remotePeers: ReadableAtom<Record<string, RemotePeer>>;
  public readonly $state: ReadableAtom<PeerState>;

  private readonly $_remotePeers:
    & PreinitializedMapStore<Record<string, RemotePeer>>
    & object;
  private readonly $_state: PreinitializedWritableAtom<PeerState>;
  private readonly crdtStore: CRDTKV;
  private replicaId: string;
  private sendChannels: Record<string, RTCDataChannel>;

  constructor(public readonly peer: Peer) {
    this.crdtStore = {};
    this.$kv = map<KVStore>({});
    this.$streams = map<Record<string, MediaStream | undefined>>({});
    this.$_remotePeers = map<Record<string, RemotePeer>>({});
    this.$remotePeers = computed(this.$_remotePeers, (v) => v);
    this.$_state = atom("new");
    this.$state = computed(this.$_state, (v) => v);
    this.sendChannels = {};
    this.replicaId = peer.peerId;

    peer.onstatechange = () => {
      this.$_state.set(peer.state);
    };

    peer.onsession = (sess) => {
      const id =
        `${sess.other.groupId}:${sess.other.peerId}:${sess.other.connId}`;
      // https://stackoverflow.com/questions/54292824/webrtc-channel-reliability
      this.sendChannels[id] = sess.createDataChannel(PeerStore.KV_NAMESPACE, {
        ordered: true,
      });

      sess.ondatachannel = (e) => {
        console.log("debug:ondatachannel", e.channel.label);
        if (e.channel.label !== PeerStore.KV_NAMESPACE) {
          return;
        }

        e.channel.onmessage = (ev) => {
          // TODO: validate schema?
          const update = JSON.parse(ev.data) as CRDTRemoteUpdate;
          console.log("debug:onmessage", { update });
          this.receiveUpdate(update.key, update.entry);
        };

        // TODO: limit full sync up to 3 peers?
        e.channel.onopen = (_ev) => {
          console.log("debug:sync", { crdt: this.crdtStore });
          for (const [key, entry] of Object.entries(this.crdtStore)) {
            console.log("debug:notifying", { key, entry });
            this.notifyPeer(this.sendChannels[id], {
              key,
              entry,
            });
          }
        };
      };

      sess.ontrack = (ev) => {
        // TODO: find existing and update
        const remotePeer = this.$_remotePeers.get()[id];
        for (const stream of ev.streams) {
          const result = remotePeer.streams.findIndex((v) =>
            v.id === stream.id
          );

          stream.onremovetrack = (ev) => {
            console.log("debug:onremovetrack", ev.track);
            for (const stream of remotePeer.streams) {
              stream.removeTrack(ev.track);
            }
            remotePeer.streams = remotePeer.streams.filter((s) => s.active);
            this.$_remotePeers.setKey(id, {
              ...remotePeer,
            });
          };

          if (!stream.active) {
            if (result !== -1) {
              remotePeer.streams.splice(result, 1);
            }
            continue;
          }

          if (result === -1) {
            remotePeer.streams.push(stream);
          } else {
            remotePeer.streams[result] = stream;
          }
        }
        this.$_remotePeers.setKey(id, {
          ...remotePeer,
        });
        console.log("debug:ontrack", { id, streams: remotePeer.streams });
      };

      sess.onconnectionstatechange = (_ev) => {
        if (sess.connectionState === "closed") {
          const current = this.$_remotePeers.get();
          delete current[id];
          this.$_remotePeers.set({ ...current });
          return;
        }

        if (sess.connectionState === "failed") {
          delete this.sendChannels[id];
          console.log(`connection failed, removed ${id}`);
        }

        const remotePeer = this.$_remotePeers.get()[id];
        this.$_remotePeers.setKey(id, {
          ...remotePeer,
          state: sess.connectionState,
        });
      };

      const localStreams = Object.entries(this.$streams.get());
      for (const [_id, stream] of localStreams) {
        if (!stream) continue;

        for (const track of stream.getTracks()) {
          sess.addTrack(track, stream);
        }
        console.log("debug:onsession", { _id, stream });
      }

      this.$_remotePeers.setKey(id, {
        info: sess.other,
        streams: [],
        state: sess.connectionState,
      });
    };

    this.$kv.listen((newKV, _oldKV, changedKey) => {
      const newVal = newKV[changedKey];
      this.set(changedKey, newVal);
    });

    this.$streams.listen((newStreams, _oldStreams, _changedKey) => {
      console.log("debug:sync_streams", { newStreams });
      for (const sess of this.peer.sessions) {
        const senders = sess.getSenders();
        const currentSenders: Record<string, RTCRtpSender[]> = {};
        const toRemove: Record<string, boolean> = {};

        for (const sender of senders) {
          // some senders are reserved for replying. Leave these senders as they
          // may be reused.
          if (!sender.track) continue;

          const toRemoveSenders = currentSenders[sender.track.id] || [];
          currentSenders[sender.track.id] = [...toRemoveSenders, sender];
          toRemove[sender.track.id] = true;
        }

        for (const stream of Object.values(newStreams)) {
          if (!stream) continue;

          for (const track of stream.getTracks()) {
            if (track.id in currentSenders) {
              toRemove[track.id] = false;
              continue;
            }

            sess.addTrack(track, stream);
          }
        }

        for (const [trackId, remove] of Object.entries(toRemove)) {
          if (!remove) continue;
          const senders = currentSenders[trackId];
          for (const sender of senders) {
            sess.removeTrack(sender);
            console.log("debug:removeTrack", { sender });
          }
        }
      }
    });
    this.peer.start();
  }

  close() {
    this.peer.close();
  }

  mute(disabled: boolean) {
    const streams = Object.values(this.$streams.get());

    for (const stream of streams) {
      if (!stream) continue;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !disabled;
      }
    }
  }

  private set(key: Key, value: Value) {
    const current = this.crdtStore[key];
    if (!!current && current.value === value) {
      // TODO: use a better loopback detection
      return;
    }

    const entry = current
      ? { version: current.version + 1, replicaId: this.replicaId, value }
      : { version: 0, replicaId: this.replicaId, value };
    this.notifyPeers(key, entry);
  }

  private notifyPeer(ch: RTCDataChannel, update: CRDTRemoteUpdate) {
    ch.send(JSON.stringify(update));
  }

  private notifyPeers(key: Key, entry: CRDTEntry) {
    const update: CRDTRemoteUpdate = {
      key,
      entry,
    };

    for (const ch of Object.values(this.sendChannels)) {
      this.notifyPeer(ch, update);
    }
  }

  private receiveUpdate(key: Key, remoteEntry: CRDTEntry): void {
    const currentEntry = this.crdtStore[key];
    console.log("debug:received_update", { key, remoteEntry, currentEntry });

    if (
      !currentEntry
    ) {
      this.crdtStore[key] = remoteEntry;
      this.$kv.setKey(key, remoteEntry.value);
      console.log(
        "debug:received_update accepted (resolution=empty)",
        remoteEntry,
      );
    } else if (remoteEntry.version > currentEntry.version) {
      this.crdtStore[key] = remoteEntry;
      this.$kv.setKey(key, remoteEntry.value);
      console.log(
        "debug:received_update accepted (resolution=older)",
        remoteEntry,
      );
    } else if (
      remoteEntry.version === currentEntry.version &&
      remoteEntry.replicaId > this.replicaId
    ) {
      this.crdtStore[key] = remoteEntry;
      this.$kv.setKey(key, remoteEntry.value);
      console.log(
        "debug:received_update accepted (resolution=replicaId)",
        remoteEntry,
      );
    } else {
      console.log("debug:received_update ignored remote update", {
        remoteEntry,
        currentEntry,
      });
      return;
    }
  }
}
