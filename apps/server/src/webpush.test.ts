import { createPublicKey, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  b64u,
  createVapidJwt,
  createWebPush,
  encryptPayload,
  type FetchLike,
  fromB64u,
  isAllowedPushEndpoint,
  type VapidConfig,
  validateVapid,
} from "./webpush.js";

/** RFC 8291 Ek A: "Example Encryption of a Push Message". */
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  ecdhSecret: "kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs",
  ikm: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
  cek: "oIhVW04MRdy2sN17rA8TsA",
  nonce: "4h_95klXJ5E_qnoN",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("RFC 8291 aes128gcm şifreleme", () => {
  it("ek A örneğiyle bayt bayt aynı çıktıyı üretir", () => {
    const out = encryptPayload(Buffer.from(RFC.plaintext), {
      uaPublic: fromB64u(RFC.uaPublic),
      authSecret: fromB64u(RFC.authSecret),
      salt: fromB64u(RFC.salt),
      asPrivate: fromB64u(RFC.asPrivate),
    });
    expect(b64u(out.parts.asPublic)).toBe(RFC.asPublic);
    expect(b64u(out.parts.ecdhSecret)).toBe(RFC.ecdhSecret);
    expect(b64u(out.parts.ikm)).toBe(RFC.ikm);
    expect(b64u(out.parts.cek)).toBe(RFC.cek);
    expect(b64u(out.parts.nonce)).toBe(RFC.nonce);
    expect(b64u(out.body)).toBe(RFC.body);
  });

  it("başlık düzeni: tuz(16) + rs(4096) + kimlik uzunluğu(65) + sunucu anahtarı", () => {
    const out = encryptPayload(Buffer.from("x"), {
      uaPublic: fromB64u(RFC.uaPublic),
      authSecret: fromB64u(RFC.authSecret),
    });
    expect(out.body.readUInt32BE(16)).toBe(4096);
    expect(out.body[20]).toBe(65);
    expect(out.body.subarray(21, 86).equals(out.parts.asPublic)).toBe(true);
    // 86 başlık + 1 bayt düz metin + 1 ayırıcı + 16 etiket
    expect(out.body.length).toBe(86 + 2 + 16);
  });

  it("çok büyük yükü ve bozuk anahtarı reddeder", () => {
    const keys = { uaPublic: fromB64u(RFC.uaPublic), authSecret: fromB64u(RFC.authSecret) };
    expect(() => encryptPayload(Buffer.alloc(5000), keys)).toThrow();
    expect(() => encryptPayload(Buffer.from("x"), { ...keys, authSecret: Buffer.alloc(3) })).toThrow();
  });
});

// Ek A'daki sunucu anahtar çifti VAPID için de geçerli bir P-256 çiftidir.
const vapid: VapidConfig = {
  publicKey: RFC.asPublic,
  privateKey: RFC.asPrivate,
  subject: "mailto:ben@example.com",
};

describe("VAPID", () => {
  it("JWT yapısı: ES256 başlığı, aud/exp/sub ve doğrulanabilir ham imza", () => {
    const jwt = createVapidJwt(vapid, "https://fcm.googleapis.com", 1_000_000);
    const [head, body, sig] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(fromB64u(head).toString())).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(fromB64u(body).toString())).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_000_000 + 12 * 3600,
      sub: "mailto:ben@example.com",
    });
    expect(fromB64u(sig).length).toBe(64);
    const pub = fromB64u(vapid.publicKey);
    const key = createPublicKey({
      format: "jwk",
      key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    });
    expect(
      verify("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }, fromB64u(sig)),
    ).toBe(true);
  });

  it("anahtar denetimi: eşleşmeyen çift, kısa anahtar ve kötü konu hata verir", () => {
    expect(() => validateVapid(vapid)).not.toThrow();
    expect(() => validateVapid({ ...vapid, privateKey: b64u(Buffer.alloc(32, 7)) })).toThrow();
    expect(() => validateVapid({ ...vapid, publicKey: "AAAA" })).toThrow();
    expect(() => validateVapid({ ...vapid, subject: "ben@example.com" })).toThrow();
    expect(() => validateVapid({ ...vapid, subject: "https://glix.dgmcraft.online" })).not.toThrow();
  });
});

describe("uç nokta izin listesi", () => {
  it("bilinen push servislerini kabul eder, gerisini reddeder", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QAbc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://127.0.0.1/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://localhost/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.com/fcm.googleapis.com")).toBe(false);
    expect(isAllowedPushEndpoint("https://notfcm.googleapis.com.evil.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://user:pw@fcm.googleapis.com/x")).toBe(false);
  });
});

describe("gönderim", () => {
  const target = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    p256dh: RFC.uaPublic,
    auth: RFC.authSecret,
  };
  const fake = (status: number) => {
    const calls: { url: string; headers: Record<string, string>; body: Buffer; redirect: string }[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, headers: init.headers, body: init.body, redirect: init.redirect });
      return Promise.resolve({ status });
    };
    return { calls, fetchImpl };
  };

  it("başlıkları kurar: TTL 60, urgency high, aes128gcm, vapid yetkisi", async () => {
    const { calls, fetchImpl } = fake(201);
    const push = createWebPush(vapid, fetchImpl, () => 5_000_000);
    expect(await push.send(target, '{"title":"x"}')).toBe("ok");
    const call = calls[0];
    expect(call?.url).toBe(target.endpoint);
    expect(call?.redirect).toBe("manual");
    expect(call?.headers.TTL).toBe("60");
    expect(call?.headers.Urgency).toBe("high");
    expect(call?.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(call?.headers.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    expect(call?.headers.Authorization).toContain(`k=${vapid.publicKey}`);
  });

  it("404 ve 410 'gone', diğer hatalar 'error' döner; izinsiz uç noktaya istek atılmaz", async () => {
    for (const [status, want] of [
      [404, "gone"],
      [410, "gone"],
      [500, "error"],
      [429, "error"],
    ] as const) {
      const { fetchImpl } = fake(status);
      expect(await createWebPush(vapid, fetchImpl).send(target, "{}")).toBe(want);
    }
    const { calls, fetchImpl } = fake(201);
    const push = createWebPush(vapid, fetchImpl);
    expect(await push.send({ ...target, endpoint: "https://evil.example/x" }, "{}")).toBe("error");
    expect(calls.length).toBe(0);
  });

  it("ağ hatası fırlatmaz", async () => {
    const push = createWebPush(vapid, () => Promise.reject(new Error("ağ yok")));
    expect(await push.send(target, "{}")).toBe("error");
  });
});
