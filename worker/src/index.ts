import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

interface Env {
  DB: D1Database;
  SNAPSHOTS: R2Bucket;
  ACCESS_ISSUER: string;
  ACCESS_AUD: string;
  ALLOWED_ORIGINS: string;
}

interface RequestContext {
  env: Env;
  request: Request;
  origin: string | null;
  requestId: string;
}

interface CurrentUser {
  id: string;
  email: string;
}

interface Membership {
  app_id: string;
  app_name: string;
  role: "admin" | "member" | "readonly";
  current_payload_schema_version: number;
  max_payload_bytes: number;
}

interface SyncRow {
  app_id: string;
  user_id: string;
  version: number;
  base_version: number;
  commit_id: string;
  payload_schema_version: number;
  object_key: string;
  object_etag: string;
  payload_sha256: string;
  payload_bytes: number;
  payload_encoding: "identity" | "gzip";
  payload_encryption: "none" | "aes-256-gcm";
  device_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const APP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

const allowedOrigin = (request: Request, env: Env) => {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = env.ALLOWED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowed.includes(origin)) {
    throw new HttpError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "当前站点不允许访问同步服务。",
    );
  }
  return origin;
};

const corsHeaders = (origin: string | null) => {
  const headers = new Headers({
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set(
      "Access-Control-Expose-Headers",
      "X-Cloud-Version, X-Commit-Id, X-Created-At, X-Payload-SHA256, X-Payload-Encoding, X-Payload-Encryption",
    );
  }
  return headers;
};

const json = (
  ctx: RequestContext,
  body: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
) => {
  const headers = corsHeaders(ctx.origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(body), { status, headers });
};

const errorResponse = (ctx: RequestContext, error: unknown) => {
  const resolved =
    error instanceof HttpError
      ? error
      : new HttpError(500, "INTERNAL_ERROR", "同步服务暂时不可用。");
  return json(
    ctx,
    {
      error: {
        code: resolved.code,
        message: resolved.message,
        requestId: ctx.requestId,
      },
    },
    resolved.status,
  );
};

const verifyAccessJwt = async (
  request: Request,
  env: Env,
): Promise<JWTPayload> => {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    throw new HttpError(401, "AUTH_REQUIRED", "缺少 Cloudflare Access 身份。");
  }
  const issuer = env.ACCESS_ISSUER.replace(/\/+$/u, "");
  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksCache.set(issuer, jwks);
  }
  try {
    const result = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD,
      clockTolerance: 5,
    });
    if (result.payload.type !== "app") {
      throw new Error("token type");
    }
    return result.payload;
  } catch {
    throw new HttpError(
      401,
      "INVALID_ACCESS_TOKEN",
      "Access 身份无效或已过期。",
    );
  }
};

const currentUser = async (ctx: RequestContext): Promise<CurrentUser> => {
  const claims = await verifyAccessJwt(ctx.request, ctx.env);
  const sub = typeof claims.sub === "string" ? claims.sub.trim() : "";
  const email =
    typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!sub || !email) {
    throw new HttpError(
      401,
      "INVALID_ACCESS_TOKEN",
      "Access 身份缺少用户信息。",
    );
  }
  const bySub = await ctx.env.DB.prepare(
    "SELECT id, email, status FROM users WHERE access_sub = ? LIMIT 1",
  )
    .bind(sub)
    .first<{ id: string; email: string; status: string }>();
  if (bySub) {
    if (bySub.status !== "active") {
      throw new HttpError(403, "USER_DISABLED", "当前用户已被停用。");
    }
    return { id: bySub.id, email: bySub.email };
  }
  const byEmail = await ctx.env.DB.prepare(
    "SELECT id, email, status FROM users WHERE email = ? COLLATE NOCASE LIMIT 1",
  )
    .bind(email)
    .first<{ id: string; email: string; status: string }>();
  if (!byEmail || byEmail.status !== "active") {
    throw new HttpError(403, "USER_NOT_PROVISIONED", "当前用户尚未预配置。");
  }
  await ctx.env.DB.prepare(
    "UPDATE users SET access_sub = ?, updated_at = ? WHERE id = ?",
  )
    .bind(sub, new Date().toISOString(), byEmail.id)
    .run();
  return { id: byEmail.id, email: byEmail.email };
};

const membershipFor = async (
  ctx: RequestContext,
  userId: string,
  appId: string,
  write = false,
) => {
  if (!APP_ID_PATTERN.test(appId)) {
    throw new HttpError(400, "INVALID_APP_ID", "App ID 格式不正确。");
  }
  const membership = await ctx.env.DB.prepare(
    `SELECT m.app_id, a.name AS app_name, m.role,
            a.current_payload_schema_version, a.max_payload_bytes
       FROM app_memberships m
       JOIN apps a ON a.id = m.app_id
      WHERE m.user_id = ? AND m.app_id = ? AND a.enabled = 1
      LIMIT 1`,
  )
    .bind(userId, appId)
    .first<Membership>();
  if (!membership) {
    throw new HttpError(403, "APP_ACCESS_DENIED", "当前用户没有该应用权限。");
  }
  if (write && membership.role === "readonly") {
    throw new HttpError(403, "READONLY_MEMBERSHIP", "只读成员不能提交快照。");
  }
  return membership;
};

const parsePositiveHeader = (
  request: Request,
  name: string,
  allowZero = false,
) => {
  const raw = request.headers.get(name);
  const value = raw && /^\d+$/u.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new HttpError(400, "INVALID_HEADER", `${name} 格式不正确。`);
  }
  return value;
};

const objectKeyFor = (
  appId: string,
  userId: string,
  version: number,
  commitId: string,
) =>
  `v1/apps/${appId}/users/${userId}/snapshots/${String(version).padStart(10, "0")}-${commitId}.bin`;

const sha256Hex = async (bytes: ArrayBuffer) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
};

const queryHead = (ctx: RequestContext, appId: string, userId: string) =>
  ctx.env.DB.prepare(
    `SELECT * FROM app_sync
      WHERE app_id = ? AND user_id = ? AND deleted_at IS NULL
      ORDER BY version DESC LIMIT 1`,
  )
    .bind(appId, userId)
    .first<SyncRow>();

const syncMetadata = (row: SyncRow, idempotent = false) => ({
  appId: row.app_id,
  version: row.version,
  baseVersion: row.base_version,
  commitId: row.commit_id,
  payloadSchemaVersion: row.payload_schema_version,
  deviceId: row.device_id,
  createdAt: row.created_at,
  idempotent,
});

const handleMe = async (ctx: RequestContext, user: CurrentUser) => {
  const apps = await ctx.env.DB.prepare(
    `SELECT a.id, a.name, m.role
       FROM app_memberships m
       JOIN apps a ON a.id = m.app_id
      WHERE m.user_id = ? AND a.enabled = 1
      ORDER BY a.id`,
  )
    .bind(user.id)
    .all<{ id: string; name: string; role: Membership["role"] }>();
  return json(ctx, { user, apps: apps.results });
};

const handleUpload = async (
  ctx: RequestContext,
  user: CurrentUser,
  appId: string,
) => {
  const membership = await membershipFor(ctx, user.id, appId, true);
  const baseVersion = parsePositiveHeader(ctx.request, "X-Base-Version", true);
  const payloadSchemaVersion = parsePositiveHeader(
    ctx.request,
    "X-Payload-Schema-Version",
  );
  if (payloadSchemaVersion !== membership.current_payload_schema_version) {
    throw new HttpError(
      422,
      "PAYLOAD_SCHEMA_VERSION_MISMATCH",
      "快照结构版本与当前应用配置不一致，请升级客户端后重试。",
    );
  }
  const commitId = ctx.request.headers.get("X-Commit-Id") ?? "";
  const expectedHash = (
    ctx.request.headers.get("X-Payload-SHA256") ?? ""
  ).toLowerCase();
  const encoding = ctx.request.headers.get("X-Payload-Encoding");
  const encryption = ctx.request.headers.get("X-Payload-Encryption");
  const deviceId = ctx.request.headers.get("X-Device-Id");
  if (!UUID_PATTERN.test(commitId) || !SHA256_PATTERN.test(expectedHash)) {
    throw new HttpError(
      400,
      "INVALID_HEADER",
      "提交 ID 或 SHA-256 格式不正确。",
    );
  }
  if (
    encoding !== "gzip" ||
    encryption !== "none" ||
    !deviceId ||
    deviceId.length > 128 ||
    !/^[a-z0-9._:-]+$/iu.test(deviceId)
  ) {
    throw new HttpError(
      400,
      "UNSUPPORTED_SNAPSHOT_FORMAT",
      "首版只接受 gzip 且未加密的快照。",
    );
  }
  const existing = await ctx.env.DB.prepare(
    `SELECT * FROM app_sync
      WHERE app_id = ? AND user_id = ? AND commit_id = ? LIMIT 1`,
  )
    .bind(appId, user.id, commitId)
    .first<SyncRow>();
  if (existing) {
    if (existing.deleted_at) {
      throw new HttpError(
        410,
        "COMMIT_RETIRED",
        "该 commitId 对应的历史版本已清理，请创建新提交。",
      );
    }
    if (existing.payload_sha256 !== expectedHash) {
      throw new HttpError(
        409,
        "COMMIT_ID_REUSED",
        "同一 commitId 不能用于不同快照。",
      );
    }
    return json(ctx, syncMetadata(existing, true));
  }
  const contentLength = Number(ctx.request.headers.get("Content-Length") ?? 0);
  if (contentLength > membership.max_payload_bytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "快照超过应用容量限制。");
  }
  const bytes = await ctx.request.arrayBuffer();
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > membership.max_payload_bytes
  ) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "快照为空或超过容量限制。");
  }
  if ((await sha256Hex(bytes)) !== expectedHash) {
    throw new HttpError(400, "HASH_MISMATCH", "快照 SHA-256 校验失败。");
  }
  const head = await queryHead(ctx, appId, user.id);
  const currentVersion = head?.version ?? 0;
  if (currentVersion !== baseVersion) {
    throw new HttpError(
      409,
      "VERSION_CONFLICT",
      "云端版本已变化，请先拉取最新快照。",
    );
  }
  const version = currentVersion + 1;
  const objectKey = objectKeyFor(appId, user.id, version, commitId);
  let object = await ctx.env.SNAPSHOTS.put(objectKey, bytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: {
      appId,
      userId: user.id,
      version: String(version),
      commitId,
      payloadSha256: expectedHash,
    },
  });
  const createdObject = Boolean(object);
  if (!object) {
    const recovered = await ctx.env.SNAPSHOTS.head(objectKey);
    if (recovered?.customMetadata?.payloadSha256 !== expectedHash) {
      throw new HttpError(
        409,
        "OBJECT_ALREADY_EXISTS",
        "快照对象已存在且完整性信息不一致。",
      );
    }
    object = recovered;
  }
  const createdAt = new Date().toISOString();
  const inserted = await ctx.env.DB.prepare(
    `INSERT INTO app_sync (
       app_id, user_id, version, base_version, commit_id,
       payload_schema_version, object_key, object_etag,
       payload_sha256, payload_bytes, payload_encoding,
       payload_encryption, device_id, created_at, deleted_at
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL
     WHERE ? = COALESCE((
       SELECT MAX(version) FROM app_sync
       WHERE app_id = ? AND user_id = ? AND deleted_at IS NULL
     ), 0)`,
  )
    .bind(
      appId,
      user.id,
      version,
      baseVersion,
      commitId,
      payloadSchemaVersion,
      objectKey,
      object.etag,
      expectedHash,
      bytes.byteLength,
      encoding,
      encryption,
      deviceId,
      createdAt,
      baseVersion,
      appId,
      user.id,
    )
    .run();
  if (inserted.meta.changes !== 1) {
    const winner = await ctx.env.DB.prepare(
      `SELECT * FROM app_sync
        WHERE app_id = ? AND user_id = ? AND commit_id = ? LIMIT 1`,
    )
      .bind(appId, user.id, commitId)
      .first<SyncRow>();
    if (
      winner &&
      !winner.deleted_at &&
      winner.payload_sha256 === expectedHash
    ) {
      return json(ctx, syncMetadata(winner, true));
    }
    if (createdObject) await ctx.env.SNAPSHOTS.delete(objectKey);
    throw new HttpError(409, "VERSION_CONFLICT", "云端版本已被其它设备更新。");
  }
  const row: SyncRow = {
    app_id: appId,
    user_id: user.id,
    version,
    base_version: baseVersion,
    commit_id: commitId,
    payload_schema_version: payloadSchemaVersion,
    object_key: objectKey,
    object_etag: object.etag,
    payload_sha256: expectedHash,
    payload_bytes: bytes.byteLength,
    payload_encoding: "gzip",
    payload_encryption: "none",
    device_id: deviceId,
    created_at: createdAt,
    deleted_at: null,
  };
  return json(ctx, syncMetadata(row));
};

const downloadRow = async (ctx: RequestContext, row: SyncRow) => {
  const object = await ctx.env.SNAPSHOTS.get(row.object_key);
  if (!object) {
    throw new HttpError(503, "SNAPSHOT_MISSING", "快照对象暂时不可用。");
  }
  const headers = corsHeaders(ctx.origin);
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Content-Encoding", "identity");
  headers.set("X-Cloud-Version", String(row.version));
  headers.set("X-Commit-Id", row.commit_id);
  headers.set("X-Created-At", row.created_at);
  headers.set("X-Payload-SHA256", row.payload_sha256);
  headers.set("X-Payload-Encoding", row.payload_encoding);
  headers.set("X-Payload-Encryption", row.payload_encryption);
  return new Response(object.body, { headers });
};

const handleAppRoutes = async (
  ctx: RequestContext,
  user: CurrentUser,
  appId: string,
  suffix: string,
) => {
  await membershipFor(ctx, user.id, appId, ctx.request.method === "PUT");
  if (suffix === "/sync" && ctx.request.method === "PUT") {
    return handleUpload(ctx, user, appId);
  }
  if (suffix === "/sync/head" && ctx.request.method === "GET") {
    const head = await queryHead(ctx, appId, user.id);
    return head ? json(ctx, syncMetadata(head)) : json(ctx, { head: null });
  }
  if (suffix === "/sync/latest" && ctx.request.method === "GET") {
    const head = await queryHead(ctx, appId, user.id);
    if (!head)
      throw new HttpError(404, "SNAPSHOT_NOT_FOUND", "云端还没有快照。");
    return downloadRow(ctx, head);
  }
  if (suffix === "/sync/versions" && ctx.request.method === "GET") {
    const url = new URL(ctx.request.url);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
    );
    const before = Number(url.searchParams.get("beforeVersion") ?? 2147483647);
    if (
      !Number.isSafeInteger(limit) ||
      !Number.isSafeInteger(before) ||
      before <= 0
    ) {
      throw new HttpError(
        400,
        "INVALID_PAGINATION",
        "版本分页参数格式不正确。",
      );
    }
    const rows = await ctx.env.DB.prepare(
      `SELECT * FROM app_sync
        WHERE app_id = ? AND user_id = ? AND deleted_at IS NULL AND version < ?
        ORDER BY version DESC LIMIT ?`,
    )
      .bind(appId, user.id, before, limit)
      .all<SyncRow>();
    return json(ctx, {
      versions: rows.results.map((row) => syncMetadata(row)),
    });
  }
  const versionMatch = /^\/sync\/versions\/(\d+)$/u.exec(suffix);
  if (versionMatch && ctx.request.method === "GET") {
    const version = Number(versionMatch[1]);
    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new HttpError(400, "INVALID_VERSION", "版本号格式不正确。");
    }
    const row = await ctx.env.DB.prepare(
      `SELECT * FROM app_sync
        WHERE app_id = ? AND user_id = ? AND version = ? AND deleted_at IS NULL
        LIMIT 1`,
    )
      .bind(appId, user.id, version)
      .first<SyncRow>();
    if (!row)
      throw new HttpError(404, "SNAPSHOT_NOT_FOUND", "指定版本不存在。");
    return downloadRow(ctx, row);
  }
  throw new HttpError(404, "ROUTE_NOT_FOUND", "接口不存在。");
};

const fetchHandler = async (request: Request, env: Env) => {
  const ctx: RequestContext = {
    env,
    request,
    origin: null,
    requestId: crypto.randomUUID(),
  };
  try {
    ctx.origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      const headers = corsHeaders(ctx.origin);
      headers.set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
      headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Base-Version, X-Commit-Id, X-Payload-Schema-Version, X-Payload-SHA256, X-Payload-Encoding, X-Payload-Encryption, X-Device-Id",
      );
      headers.set("Access-Control-Max-Age", "86400");
      return new Response(null, { status: 204, headers });
    }
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/v1")) {
      throw new HttpError(404, "ROUTE_NOT_FOUND", "接口不存在。");
    }
    const user = await currentUser(ctx);
    if (url.pathname === "/api/v1/me" && request.method === "GET") {
      return handleMe(ctx, user);
    }
    const match = /^\/api\/v1\/apps\/([^/]+)(\/.*)$/u.exec(url.pathname);
    if (!match?.[1] || !match[2]) {
      throw new HttpError(404, "ROUTE_NOT_FOUND", "接口不存在。");
    }
    return await handleAppRoutes(
      ctx,
      user,
      decodeURIComponent(match[1]),
      match[2],
    );
  } catch (error) {
    return errorResponse(ctx, error);
  }
};

const scheduledHandler = async (env: Env) => {
  const now = new Date().toISOString();
  const candidates = await env.DB.prepare(
    `SELECT object_key, app_id, user_id, version FROM (
       SELECT s.object_key, s.app_id, s.user_id, s.version,
              ROW_NUMBER() OVER (
                PARTITION BY s.app_id, s.user_id ORDER BY s.version DESC
              ) AS version_rank,
              a.retention_versions
         FROM app_sync s
         JOIN apps a ON a.id = s.app_id
        WHERE s.deleted_at IS NULL
     )
     WHERE version_rank > retention_versions
     LIMIT 200`,
  ).all<{
    object_key: string;
    app_id: string;
    user_id: string;
    version: number;
  }>();
  for (const row of candidates.results) {
    await env.SNAPSHOTS.delete(row.object_key);
    await env.DB.prepare(
      `UPDATE app_sync SET deleted_at = ?
        WHERE app_id = ? AND user_id = ? AND version = ?
          AND deleted_at IS NULL
          AND version < (
            SELECT MAX(version) FROM app_sync
            WHERE app_id = ? AND user_id = ? AND deleted_at IS NULL
          )`,
    )
      .bind(now, row.app_id, row.user_id, row.version, row.app_id, row.user_id)
      .run();
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const listed = await env.SNAPSHOTS.list({
    prefix: "v1/apps/",
    limit: 500,
  });
  for (const object of listed.objects) {
    if (object.uploaded.getTime() >= cutoff) continue;
    const exists = await env.DB.prepare(
      "SELECT 1 AS found FROM app_sync WHERE object_key = ? AND deleted_at IS NULL LIMIT 1",
    )
      .bind(object.key)
      .first<{ found: number }>();
    if (!exists) await env.SNAPSHOTS.delete(object.key);
  }
};

export default {
  fetch: fetchHandler,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(scheduledHandler(env));
  },
} satisfies ExportedHandler<Env>;
