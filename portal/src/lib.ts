import { map, PreinitializedMapStore } from "nanostores";

export type Value = string | number | undefined;
export type Key = string | symbol;

interface CRDTEntry {
  value: Value;
  timestamp: number;
  replicaId: string;
}

export type KVStore = Record<string, string>;
type CRDTKV = Record<Key, CRDTEntry>;

export function createPortal(): PreinitializedMapStore<KVStore> & object {
  let $kv = map<KVStore>({});

  $kv.listen((newVal, oldVal, changedKey) => {
    console.log(
      `[${changedKey}] ${oldVal[changedKey]} -> ${newVal[changedKey]}`,
    );
  });

  return $kv;
}

class CRDTKVStore {
  private readonly crdtStore: CRDTKV;
  private readonly store: PreinitializedMapStore<KVStore> & object;
  // TODO: replace with peer id
  private replicaId: string = "";

  constructor() {
    this.crdtStore = {};
    this.store = map<KVStore>({});
  }

  get $store(): PreinitializedMapStore<KVStore> & object {
    return this.store;
  }

  set(key: Key, value: Value) {
    const entry = {
      value: value,
      timestamp: Date.now(),
      replicaId: this.replicaId,
    };
    this.crdtStore[key] = entry;
    this.notifyPeers(key, entry);
  }

  private notifyPeers(key: Key, entry: CRDTEntry) {
  }

  private receiveUpdate(key: string, remoteEntry: CRDTEntry): void {
    const currentEntry = this.crdtStore[key];

    if (!currentEntry) {
      this.crdtStore[key] = remoteEntry;
      console.log(
        `Replica ${this.replicaId} received first update for key '${key}':`,
        remoteEntry,
      );
    } else if (remoteEntry.timestamp > currentEntry.timestamp) {
      this.crdtStore[key] = remoteEntry;
      console.log(
        `Replica ${this.replicaId} updated key '${key}' with newer timestamp:`,
        remoteEntry,
      );
    } else if (
      remoteEntry.timestamp === currentEntry.timestamp &&
      remoteEntry.replicaId > this.replicaId
    ) {
      this.crdtStore[key] = remoteEntry;
      console.log(
        `Replica ${this.replicaId} updated key '${key}' with same timestamp but larger replicaId:`,
        remoteEntry,
      );
    } else {
      console.log(
        `Replica ${this.replicaId} ignored update for key '${key}' as it's older or from a smaller replicaId:`,
        remoteEntry,
      );
    }
  }
}

// class CRDTKVStore {
//   private replicaId: string;
//   private _data: { [key: string]: CRDTEntry } = {};
//   private _proxy: { [key: string]: string };
//
//   constructor(replicaId: string) {
//     this.replicaId = replicaId;
//     const p = new Proxy(this, {
//       get: (target: CRDTKVStore, key: string, receiver: any) => {
//         if (key in target._data && key !== "_data" && key !== "_proxy") {
//           return target._data[key].value;
//         }
//         return Reflect.get(target, key, receiver);
//       },
//       set: (target: CRDTKVStore, key: string, value: string, receiver: any) => {
//         if (key !== "_data" && key !== "_proxy") {
//           target._setData(key, value);
//           return true;
//         }
//         return Reflect.set(target, key, value, receiver);
//       },
//       deleteProperty: (target: CRDTKVStore, key: string) => {
//         if (key in target._data && key !== "_data" && key !== "_proxy") {
//           target._deleteData(key);
//           return true;
//         }
//         return Reflect.deleteProperty(target, key);
//       },
//     });
//     // as { [key: string]: string | null };
//   }
//
//   get proxy(): { [key: string]: T } {
//     return this._proxy;
//   }
//
//   private _setData(key: string, value: T): void {
//     this._data[key] = {
//       value: value,
//       timestamp: Date.now(),
//       replicaId: this.replicaId,
//     };
//   }
//
//   private _deleteData(key: string): void {
//     this._data[key] = {
//       value: undefined, // Or a special tombstone value
//       timestamp: Date.now(),
//       replicaId: this.replicaId,
//       deleted: true,
//     };
//   }
//
//   getState(): { [key: string]: CRDTEntry<T> } {
//     return JSON.parse(JSON.stringify(this._data)); // Return a serializable state
//   }
//
//   merge(otherState: { [key: string]: CRDTEntry<T> }): void {
//     for (const key in otherState) {
//       if (otherState.hasOwnProperty(key)) {
//         const otherEntry = otherState[key];
//         const currentEntry = this._data[key];
//
//         if (!currentEntry) {
//           this._data[key] = otherEntry;
//         } else if (otherEntry.timestamp > currentEntry.timestamp) {
//           this._data[key] = otherEntry;
//         } else if (
//           otherEntry.timestamp === currentEntry.timestamp &&
//           otherEntry.replicaId > currentEntry.replicaId
//         ) {
//           // Tie-breaker based on replica ID (optional but helps ensure eventual consistency)
//           this._data[key] = otherEntry;
//         }
//       }
//     }
//   }
// }
