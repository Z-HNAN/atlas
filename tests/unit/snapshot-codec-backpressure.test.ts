import { describe, expect, it } from "vitest";
import { transformBytes } from "../../src/lib/sync/snapshot-codec";

describe("快照流背压", () => {
  it("先消费 readable，再写入零缓冲 TransformStream，避免浏览器互等", async () => {
    const input = new TextEncoder().encode("atlas-sync");
    const stream = new TransformStream<Uint8Array, Uint8Array>(
      {
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
      },
      { highWaterMark: 0 },
      { highWaterMark: 0 },
    );

    await expect(transformBytes(input, stream)).resolves.toEqual(input);
  });
});
