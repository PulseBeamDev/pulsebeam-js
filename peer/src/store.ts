import { map, PreinitializedMapStore } from "nanostores";
import { Peer } from "./peer.ts";

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

export class PeerStore {
  public static readonly KV_NAMESPACE = "__crdt_kv";
  public readonly $kv: PreinitializedMapStore<KVStore> & object;
  public readonly $localStreams:
    & PreinitializedMapStore<Record<string, MediaStream>>
    & object;
  public readonly $remoteStreams:
    & PreinitializedMapStore<Record<string, MediaStream>>
    & object;

  private readonly crdtStore: CRDTKV;
  private replicaId: string;
  private sendChannels: Record<string, RTCDataChannel>;

  constructor(private peer: Peer) {
    this.crdtStore = {};
    this.$kv = map<KVStore>({});
    this.$localStreams = map<Record<string, MediaStream>>({});
    this.$remoteStreams = map<Record<string, MediaStream>>({});
    this.sendChannels = {};
    this.replicaId = peer.peerId;

    peer.onsession = (sess) => {
      const id =
        `${sess.other.groupId}:${sess.other.peerId}:${sess.other.connId}`;
      this.sendChannels[id] = sess.createDataChannel(PeerStore.KV_NAMESPACE, {
        ordered: true,
        maxRetransmits: 3,
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
        for (const stream of ev.streams) {
          // TODO: better ID scheme, maybe nested?
          const streamId = `${id}:${stream.id}`;
          this.$remoteStreams.setKey(streamId, stream);
        }
      };

      sess.onconnectionstatechange = (_ev) => {
        if (sess.connectionState === "failed") {
          delete this.sendChannels[id];
          console.log(`connection failed, removed ${id}`);
        }
      };

      const localStreams = Object.entries(this.$localStreams.get());
      for (const [_id, stream] of localStreams) {
        for (const track of stream.getTracks()) {
          sess.addTrack(track, stream);
        }
      }
    };

    this.$kv.listen((newKV, _oldKV, changedKey) => {
      const newVal = newKV[changedKey];
      this.set(changedKey, newVal);
    });

    // this.$localStreams.listen((newStreams, oldStreams, changedKey) => {
    // TODO: renegotiate media streams
    // });
  }

  async addUserMedia(constraints: MediaStreamConstraints) {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.addMediaStream(stream);
  }

  async addDisplayMedia(constraints: DisplayMediaStreamOptions) {
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    this.addMediaStream(stream);
  }

  addMediaStream(stream: MediaStream) {
    this.$localStreams.setKey(stream.id, stream);
  }

  start() {
    this.peer.start();
  }

  close() {
    this.peer.close();
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
