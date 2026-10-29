import { expect, it } from "vitest";
import { KEEP_ALIVE_MS } from "./server.js";
import { k, useServer } from "./testkit.js";

useServer();

it("HTTP boşta-bağlantı süresi Node'un 5 sn varsayılanından uzun; başlık süresi ondan büyük", () => {
  expect(k.srv.server.keepAliveTimeout).toBe(KEEP_ALIVE_MS);
  expect(k.srv.server.headersTimeout).toBeGreaterThan(k.srv.server.keepAliveTimeout);
  expect(KEEP_ALIVE_MS).toBeGreaterThan(5000);
});
