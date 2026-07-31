import { AppError } from "../errors/app-error";
import { snapshotEnvelopeSchema } from "./schemas";

export interface SnapshotEnvelope<TPayload> {
  formatVersion: 1;
  appId: string;
  payloadSchemaVersion: number;
  exportedAt: string;
  deviceId: string;
  data: TPayload;
}

const transformStream = async (
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
) => {
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
};

export const gzipSnapshot = async <TPayload>(
  envelope: SnapshotEnvelope<TPayload>,
) => {
  if (typeof CompressionStream === "undefined") {
    throw new AppError(
      "INVALID_RESPONSE",
      "当前浏览器不支持 gzip 快照，请升级浏览器后重试。",
    );
  }
  const valid = snapshotEnvelopeSchema.parse(envelope);
  const bytes = new TextEncoder().encode(JSON.stringify(valid));
  return transformStream(bytes, new CompressionStream("gzip"));
};

export const gunzipSnapshot = async (bytes: Uint8Array) => {
  if (typeof DecompressionStream === "undefined") {
    throw new AppError(
      "INVALID_RESPONSE",
      "当前浏览器不支持 gzip 快照，请升级浏览器后重试。",
    );
  }
  try {
    const decoded = await transformStream(
      bytes,
      new DecompressionStream("gzip"),
    );
    return snapshotEnvelopeSchema.parse(
      JSON.parse(new TextDecoder().decode(decoded)) as unknown,
    );
  } catch (error) {
    throw new AppError(
      "INVALID_RESPONSE",
      "云端快照无法解压或结构不正确。",
      error,
    );
  }
};

export const sha256Hex = async (bytes: Uint8Array) => {
  const source = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", source);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
};
