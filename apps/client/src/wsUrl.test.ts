import { describe, expect, it } from "vitest";
import { resolveWsUrl } from "./wsUrl.js";

describe("resolveWsUrl", () => {
  const https = { protocol: "https:", host: "glix.example" };
  it("https için wss kullanır", () => {
    expect(resolveWsUrl(https)).toBe("wss://glix.example/ws");
  });
  it("http için ws kullanır", () => {
    expect(resolveWsUrl({ protocol: "http:", host: "localhost:3900" })).toBe("ws://localhost:3900/ws");
  });
  it("geçersiz kılma ve geliştirme varsayılanı", () => {
    expect(resolveWsUrl(https, "ws://x/ws")).toBe("ws://x/ws");
    expect(resolveWsUrl(https, undefined, true)).toBe("ws://localhost:3900/ws");
  });
});
