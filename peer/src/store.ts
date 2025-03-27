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

export class Portal {
  public static readonly NAMESPACE = "__crdt_kv";
  private readonly crdtStore: CRDTKV;
  private readonly store: PreinitializedMapStore<KVStore> & object;
  private replicaId: string;

  private sendChannels: Record<string, RTCDataChannel>;

  constructor(private peer: Peer) {
    this.crdtStore = {};
    this.store = map<KVStore>({});
    this.sendChannels = {};
    this.replicaId = peer.peerId;

    peer.onsession = (s) => {
      const id = `${s.other.groupId}:${s.other.peerId}:${s.other.connId}`;
      this.sendChannels[id] = s.createDataChannel(Portal.NAMESPACE, {
        ordered: true,
        maxRetransmits: 3,
      });

      s.ondatachannel = (e) => {
        console.log("debug:ondatachannel", e.channel.label);
        if (e.channel.label !== Portal.NAMESPACE) {
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

      s.onconnectionstatechange = (_ev) => {
        if (s.connectionState === "failed") {
          delete this.sendChannels[id];
          console.log(`connection failed, removed ${id}`);
        }
      };
    };

    this.store.listen((newKV, _oldKV, changedKey) => {
      const newVal = newKV[changedKey];
      this.set(changedKey, newVal);
    });
  }

  start() {
    this.peer.start();
  }

  close() {
    this.peer.close();
  }

  get $store(): PreinitializedMapStore<KVStore> & object {
    return this.store;
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
      this.store.setKey(key, remoteEntry.value);
      console.log(
        "debug:received_update accepted (resolution=empty)",
        remoteEntry,
      );
    } else if (remoteEntry.timestamp > currentEntry.timestamp) {
      this.crdtStore[key] = remoteEntry;
      this.store.setKey(key, remoteEntry.value);
      console.log(
        "debug:received_update accepted (resolution=older)",
        remoteEntry,
      );
    } else if (
      remoteEntry.timestamp === currentEntry.timestamp &&
      remoteEntry.replicaId > this.replicaId
    ) {
      this.crdtStore[key] = remoteEntry;
      this.store.setKey(key, remoteEntry.value);
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
