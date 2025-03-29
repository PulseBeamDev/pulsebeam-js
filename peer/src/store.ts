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
  timestamp: number;
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
  streams: readonly MediaStream[];
  state: RTCPeerConnectionState;
}

export class PeerStore {
  public static readonly KV_NAMESPACE = "__crdt_kv";
  public readonly $kv: PreinitializedMapStore<KVStore> & object;
  public readonly $streams:
    & PreinitializedMapStore<Record<string, MediaStream>>
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
    this.$streams = map<Record<string, MediaStream>>({});
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
        this.$_remotePeers.setKey(id, {
          ...remotePeer,
          streams: ev.streams,
        });
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
        for (const track of stream.getTracks()) {
          sess.addTrack(track, stream);
        }
      }

      this.$_remotePeers.setKey(id, {
        info: sess.other,
        streams: atom([]),
        state: atom(sess.connectionState),
      });
    };

    this.$kv.listen((newKV, _oldKV, changedKey) => {
      const newVal = newKV[changedKey];
      this.set(changedKey, newVal);
    });

    // this.$localStreams.listen((newStreams, oldStreams, changedKey) => {
    // TODO: renegotiate media streams
    // });
    this.peer.start();
  }

  close() {
    this.peer.close();
  }

  mute(disabled: boolean) {
    const streams = Object.values(this.$streams.get());

    for (const stream of streams) {
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

    const entry = {
      value: value,
      timestamp: Date.now(),
      replicaId: this.replicaId,
    };
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
    } else if (remoteEntry.timestamp > currentEntry.timestamp) {
      this.crdtStore[key] = remoteEntry;
      this.$kv.setKey(key, remoteEntry.value);
      console.log(
        "debug:received_update accepted (resolution=older)",
        remoteEntry,
      );
    } else if (
      remoteEntry.timestamp === currentEntry.timestamp &&
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
