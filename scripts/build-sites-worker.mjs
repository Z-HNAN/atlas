import { mkdir, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const worker = `const worker = {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (request.method === "GET" && response.status === 404 && acceptsHtml) {
      const fallbackUrl = new URL("/index.html", request.url);
      response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    }
    return response;
  },
};

export default worker;
`;

await mkdir(new URL("../dist/server/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../dist/server/index.js", import.meta.url),
  worker,
  "utf8",
);
