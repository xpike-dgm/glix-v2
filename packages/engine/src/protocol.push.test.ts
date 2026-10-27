import { describe, expect, it } from "vitest";
import { isPushEndpoint, parseClientMessage } from "./protocol.js";

const P256DH = "B".repeat(87);
const AUTH = "a".repeat(22);
const sub = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "pushSubscribe",
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    p256dh: P256DH,
    auth: AUTH,
    ...over,
  });

describe("bildirim mesajları", () => {
  it("geçerli abonelik ayrıştırılır", () => {
    expect(parseClientMessage(sub())).toEqual({
      type: "pushSubscribe",
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      p256dh: P256DH,
      auth: AUTH,
    });
  });

  it("uç nokta: yalnız https, en çok 500 karakter, kimlik bilgisi yok", () => {
    expect(parseClientMessage(sub({ endpoint: "http://fcm.googleapis.com/x" }))).toBeNull();
    expect(parseClientMessage(sub({ endpoint: "ftp://x.com/a" }))).toBeNull();
    expect(parseClientMessage(sub({ endpoint: "https://u:p@fcm.googleapis.com/x" }))).toBeNull();
    expect(parseClientMessage(sub({ endpoint: `https://fcm.googleapis.com/${"a".repeat(480)}` }))).toBeNull();
    expect(
      parseClientMessage(sub({ endpoint: `https://fcm.googleapis.com/${"a".repeat(400)}` })),
    ).not.toBeNull();
    expect(parseClientMessage(sub({ endpoint: 5 }))).toBeNull();
    expect(isPushEndpoint("https://web.push.apple.com/QAbc")).toBe(true);
    expect(isPushEndpoint("not a url")).toBe(false);
  });

  it("anahtarlar: base64url ve doğru uzunluk", () => {
    expect(parseClientMessage(sub({ p256dh: "B".repeat(86) }))).toBeNull();
    expect(parseClientMessage(sub({ p256dh: "B".repeat(88) }))).toBeNull();
    expect(parseClientMessage(sub({ p256dh: `${"B".repeat(86)}+` }))).toBeNull();
    expect(parseClientMessage(sub({ auth: "a".repeat(21) }))).toBeNull();
    expect(parseClientMessage(sub({ auth: `${"a".repeat(21)}=` }))).toBeNull();
    expect(parseClientMessage(sub({ auth: 12 }))).toBeNull();
  });

  it("fazladan ya da eksik alan geçersiz", () => {
    expect(parseClientMessage(sub({ extra: 1 }))).toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ type: "pushSubscribe", endpoint: "https://a.com/x" })),
    ).toBeNull();
  });

  it("pushUnsubscribe ve visibility", () => {
    expect(parseClientMessage('{"type":"pushUnsubscribe"}')).toEqual({ type: "pushUnsubscribe" });
    expect(parseClientMessage('{"type":"pushUnsubscribe","x":1}')).toBeNull();
    expect(parseClientMessage('{"type":"visibility","hidden":true}')).toEqual({
      type: "visibility",
      hidden: true,
    });
    expect(parseClientMessage('{"type":"visibility","hidden":"evet"}')).toBeNull();
    expect(parseClientMessage('{"type":"visibility"}')).toBeNull();
  });
});
