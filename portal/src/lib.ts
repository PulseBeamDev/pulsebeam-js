import { map, PreinitializedMapStore } from "nanostores";
import { Peer } from "@pulsebeam/peer";

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
        if (e.channel.label !== Portal.NAMESPACE) {
          return;
        }

        e.channel.onmessage = (ev) => {
          // TODO: validate schema?
          const update = JSON.parse(ev.data) as CRDTRemoteUpdate;
          this.receiveUpdate(update.key, update.entry);
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

    peer.start();
  }

  close() {
    this.peer.close();
  }

  get $store(): PreinitializedMapStore<KVStore> & object {
    return this.store;
  }

  private set(key: Key, value: Value) {
    const entry = {
      value: value,
      timestamp: Date.now(),
      replicaId: this.replicaId,
    };
    this.crdtStore[key] = entry;
    this.notifyPeers(key, entry);
  }

  private notifyPeers(key: Key, entry: CRDTEntry) {
    const update: CRDTRemoteUpdate = {
      key,
      entry,
    };

    for (const ch of Object.values(this.sendChannels)) {
      ch.send(JSON.stringify(update));
    }
  }

  private receiveUpdate(key: Key, remoteEntry: CRDTEntry): void {
    const currentEntry = this.crdtStore[key];

    if (
      !currentEntry || remoteEntry.timestamp > currentEntry.timestamp ||
      remoteEntry.timestamp === currentEntry.timestamp &&
      remoteEntry.replicaId > this.replicaId
    ) {
      this.crdtStore[key] = remoteEntry;
      this.store.setKey(key, remoteEntry.value);
      console.log("accepted remote update", remoteEntry);
    } else {
      console.log("ignored remote update", remoteEntry);
    }
  }
}
