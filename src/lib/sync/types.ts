export interface RemoteSnapshot<TPayload = unknown> {
  appId: string;
  version: number;
  commitId: string;
  payloadSchemaVersion: number;
  payload: TPayload;
  deviceId: string | null;
  createdAt: string;
}

export interface SyncProvider<TPayload> {
  pullLatest(): Promise<RemoteSnapshot<unknown> | null>;
  push(input: {
    payload: TPayload;
    payloadSchemaVersion: number;
    baseVersion: number | null;
    commitId: string;
    deviceId: string;
  }): Promise<RemoteSnapshot<unknown>>;
}

export type SyncAction = "none" | "uploaded" | "downloaded" | "conflict";

export interface SyncConflict<TPayload> {
  localPayload: TPayload;
  localDataVersion: number;
  remote: RemoteSnapshot<TPayload>;
}

export type SyncResult<TPayload> =
  | {
      status: "synced";
      action: Exclude<SyncAction, "conflict">;
      cloudVersion: number | null;
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
