export interface RemoteSnapshot<TPayload = unknown> {
  appId: string;
  schemaVersion: number;
  dataVersion: number;
  payload: TPayload;
  deviceId: string | null;
  updatedAt: string;
}

export interface SyncProvider<TPayload> {
  pull(): Promise<RemoteSnapshot<unknown> | null>;
  push(input: {
    payload: TPayload;
    schemaVersion: number;
    dataVersion: number;
    expectedRemoteVersion: number | null;
    deviceId: string;
  }): Promise<RemoteSnapshot<unknown>>;
  remove(): Promise<void>;
}

export type SyncAction =
  | "none"
  | "uploaded"
  | "downloaded"
  | "conflict"
  | "remote-deleted";

export interface SyncConflict<TPayload> {
  localPayload: TPayload;
  localDataVersion: number;
  remote: RemoteSnapshot<TPayload>;
}

export type SyncResult<TPayload> =
  | {
      status: "synced";
      action: Exclude<SyncAction, "conflict">;
      remoteVersion: number | null;
    }
  | {
      status: "conflict";
      action: "conflict";
      conflict: SyncConflict<TPayload>;
    };

export interface ConflictExports {
  localJson: string;
  remoteJson: string;
}
