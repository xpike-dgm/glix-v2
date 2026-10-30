/** Oyun ansiklopedisi: içerik uçları, notlar (ekran işareti ve görsel dahil), erişim denetimi ve içerik bütünlüğü. */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WikiFeedbackList } from "@glix/engine";
import { afterAll, describe, expect, it } from "vitest";
import { k, loginCookie, useServer } from "./testkit.js";
import { cleanWikiText, imageMatches, parseBox } from "./wiki.js";
import { ADMIN, base, createAdminKit, MAIL } from "./yoneticiKit.js";

const kit = createAdminKit();
const { get, post, adminLogin } = kit;
const dir = mkdtempSync(join(tmpdir(), "glix-wiki-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** En küçük geçerli WebP başlığı (RIFF....WEBP) + dolgu. */
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBPVP8 "),
  Buffer.alloc(24, 1),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 2),
]);

mkdirSync(join(dir, "oyunlar"));
mkdirSync(join(dir, "ekran"));
writeFileSync(join(dir, "sira.json"), JSON.stringify(["butona-bas", "eksik-oyun"]));
writeFileSync(
  join(dir, "oyunlar", "butona-bas.json"),
  JSON.stringify({ id: "butona-bas", ad: "Butona Bas" }),
);
writeFileSync(join(dir, "ekran", "butona-bas-sahne.webp"), WEBP);

describe("Wiki notu ayrıştırıcıları", () => {
  it("metin: satır sonu kalır, denetim karakteri ve boş metin reddedilir", () => {
    expect(cleanWikiText("  bir\r\nsatır\n\n\n\niki  ")).toBe("bir\nsatır\n\niki");
    expect(cleanWikiText("a\u0000b")).toBeNull();
    expect(cleanWikiText("   ")).toBeNull();
    expect(cleanWikiText("x".repeat(2001))).toBeNull();
    expect(cleanWikiText(5)).toBeNull();
  });
  it("kutu: 0..1 içinde, sıfırdan büyük ve taşmayan", () => {
    expect(parseBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
    expect(parseBox({ x: 0.9, y: 0, w: 0.3, h: 0.1 })).toBeNull();
    expect(parseBox({ x: 0, y: 0, w: 0, h: 0.1 })).toBeNull();
    expect(parseBox({ x: "0", y: 0, w: 0.1, h: 0.1 })).toBeNull();
  });
  it("görsel imzası türle uyuşmalı", () => {
    expect(imageMatches("image/webp", WEBP)).toBe(true);
    expect(imageMatches("image/png", PNG)).toBe(true);
    expect(imageMatches("image/jpeg", PNG)).toBe(false);
    expect(imageMatches("image/webp", PNG)).toBe(false);
  });
});

describe("Wiki uçları", () => {
  useServer({
    adminAccountIds: ADMIN,
    mail: MAIL,
    mailFetch: kit.mailFetch,
    statsDb: ":memory:",
    wikiDir: dir,
  });

  it("girişsiz 401, yönetici olmayan 404, kodsuz yönetici 403", async () => {
    expect((await get("wiki/data", null)).status).toBe(401);
    const sess = loginCookie("yonetici_1");
    expect((await get("wiki/data", sess)).status).toBe(403);
    expect((await get("wiki/data", loginCookie("oyuncu_2"))).status).toBe(404);
    expect((await post("wiki/feedback/add", loginCookie("oyuncu_3"), {})).status).toBe(404);
  });

  it("içerik: sıradaki oyunlar ve ekranlar; eksik dosya atlanır, ekran görseli gelir", async () => {
    const c = await adminLogin();
    const r = await get<{ games: { id: string }[]; screens: string[] }>("wiki/data", c);
    expect(r.status).toBe(200);
    expect(r.body.games.map((g) => g.id)).toEqual(["butona-bas"]);
    expect(r.body.screens).toEqual(["butona-bas-sahne"]);
    const img = await fetch(`${base()}/api/admin/wiki/image?f=butona-bas-sahne`, { headers: { Cookie: c } });
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/webp");
    expect(Buffer.from(await img.arrayBuffer()).equals(WEBP)).toBe(true);
    for (const f of ["../sira", "yok", "BUYUK"])
      expect((await fetch(`${base()}/api/admin/wiki/image?f=${f}`, { headers: { Cookie: c } })).status).toBe(
        404,
      );
  });

  it("not ekle, listele, durum değiştir, sil", async () => {
    const c = await adminLogin();
    const add = await post("wiki/feedback/add", c, {
      gameId: "butona-bas",
      section: "Arayüz",
      text: "Bu buton\nçok küçük",
      screen: "butona-bas-sahne",
      box: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 },
    });
    expect(add.status).toBe(200);
    const id = add.body.id as number;
    const genel = await post("wiki/feedback/add", c, {
      gameId: "butona-bas",
      section: "Kurallar",
      text: "Süre kısa",
    });
    expect(genel.status).toBe(200);
    let l = await get<WikiFeedbackList>("wiki/feedback", c);
    expect(l.body.items).toHaveLength(2);
    expect(l.body.items[0]).toMatchObject({
      id,
      gameId: "butona-bas",
      section: "Arayüz",
      text: "Bu buton\nçok küçük",
      status: "acik",
      screen: "butona-bas-sahne",
      box: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 },
      hasImage: false,
      reply: "",
    });
    expect(l.body.items[1]).toMatchObject({ screen: null, box: null });
    expect((await post("wiki/feedback/status", c, { id, status: "cozuldu" })).status).toBe(200);
    expect((await post("wiki/feedback/status", c, { id, status: "bitti" })).status).toBe(400);
    expect((await post("wiki/feedback/status", c, { id: 999, status: "acik" })).status).toBe(404);
    l = await get<WikiFeedbackList>("wiki/feedback", c);
    expect(l.body.items.find((x) => x.id === id)?.status).toBe("cozuldu");
    expect((await post("wiki/feedback/delete", c, { id })).status).toBe(200);
    expect((await post("wiki/feedback/delete", c, { id })).status).toBe(404);
    l = await get<WikiFeedbackList>("wiki/feedback", c);
    expect(l.body.items.map((x) => x.id)).toEqual([genel.body.id]);
  });

  it("görselli not: görsel ayrı uçtan gelir; imzası tutmayan görsel reddedilir", async () => {
    const c = await adminLogin();
    const ok = await post("wiki/feedback/add", c, {
      gameId: "butona-bas",
      section: "Hata",
      text: "Ekran görüntüsü ekledim",
      image: { type: "image/png", data: PNG.toString("base64") },
    });
    expect(ok.status).toBe(200);
    const l = await get<WikiFeedbackList>("wiki/feedback", c);
    expect(l.body.items[0]?.hasImage).toBe(true);
    const img = await fetch(`${base()}/api/admin/wiki/feedback/image?id=${ok.body.id}`, {
      headers: { Cookie: c },
    });
    expect(img.headers.get("content-type")).toBe("image/png");
    expect(img.headers.get("content-security-policy")).toContain("sandbox");
    expect(Buffer.from(await img.arrayBuffer()).equals(PNG)).toBe(true);
    const bad = await post("wiki/feedback/add", c, {
      gameId: "butona-bas",
      section: "Hata",
      text: "x",
      image: { type: "image/jpeg", data: PNG.toString("base64") },
    });
    expect(bad.status).toBe(400);
  });

  it("geçersiz notlar reddedilir: bilinmeyen oyun/ekran/bölüm, ekransız kutu, fazla alan", async () => {
    const c = await adminLogin();
    const good = { gameId: "butona-bas", section: "Genel", text: "Not" };
    for (const body of [
      { ...good, gameId: "eksik-oyun-yok" },
      { ...good, gameId: "../sira" },
      { ...good, section: "Başka" },
      { ...good, text: "" },
      { ...good, screen: "yok" },
      { ...good, box: { x: 0, y: 0, w: 0.5, h: 0.5 } },
      { ...good, fazla: 1 },
      "metin",
    ])
      expect((await post("wiki/feedback/add", c, body)).status).toBe(400);
    expect(k.srv.accounts.wikiFeedbackList()).toHaveLength(0);
  });

  it("POST başka kaynaktan gelirse reddedilir", async () => {
    const c = await adminLogin();
    const r = await kit.call("POST", "wiki/feedback/add", c, {
      body: { gameId: "butona-bas", section: "Genel", text: "Not" },
      origin: "https://kotu.example",
    });
    expect(r.status).toBe(403);
  });
});

describe("Wiki sayfası", () => {
  useServer({
    adminAccountIds: ADMIN,
    mail: MAIL,
    mailFetch: kit.mailFetch,
    statsDb: ":memory:",
    wikiDir: dir,
  });
  it("/wiki altındaki yollar 404", async () => {
    expect((await fetch(`${base()}/wiki/x`)).status).toBe(404);
  });
});

describe("Wiki sayfası (panel kapalı)", () => {
  useServer({ statsDb: ":memory:", wikiDir: dir });
  it("/wiki ve wiki.html 404", async () => {
    expect((await fetch(`${base()}/wiki`)).status).toBe(404);
    expect((await fetch(`${base()}/wiki.html`)).status).toBe(404);
  });
});

describe("Ansiklopedi içeriği (docs/wiki)", () => {
  const root = fileURLToPath(new URL("../../../docs/wiki", import.meta.url));
  const sira = JSON.parse(readFileSync(join(root, "sira.json"), "utf8")) as string[];
  const ekranlar = new Set(readdirSync(join(root, "ekran")).map((f) => f.replace(/\.webp$/, "")));

  it("her oyunun dosyası var, kimliği tutuyor, ekranları çekilmiş", () => {
    expect(sira.length).toBeGreaterThan(0);
    for (const id of sira) {
      const g = JSON.parse(readFileSync(join(root, "oyunlar", `${id}.json`), "utf8")) as {
        id: string;
        ekranlar?: { dosya: string }[];
      };
      expect(g.id).toBe(id);
      for (const e of g.ekranlar ?? []) expect(ekranlar.has(e.dosya), `${id}: ${e.dosya}`).toBe(true);
      expect(
        existsSync(join(root, "..", "..", "apps", "client", "public", "assets", "cards", `${id}.webp`)),
      ).toBe(true);
    }
  });
});
