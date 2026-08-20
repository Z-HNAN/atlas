import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelConfig {
  headers?: Array<{ source: string; headers: VercelHeader[] }>;
}

describe("Vercel 安全响应头", () => {
  it("为所有路径声明必要安全策略和外部能力白名单", async () => {
    const config = JSON.parse(
      await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
    ) as VercelConfig;
    const rule = config.headers?.find(({ source }) => source === "/(.*)");
    const headers = new Map(
      rule?.headers.map(({ key, value }) => [key, value]) ?? [],
    );

    expect(headers.get("Strict-Transport-Security")).toBeTruthy();
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()");

    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://api.deepseek.com");
    expect(csp).toContain("https://nominatim.openstreetmap.org");
    expect(csp).toContain("https://sync.api.10242020.xyz");
    expect(csp).toContain("https://*.tile.openstreetmap.org");
  });
});
