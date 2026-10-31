/**
 * Sırlar (sözleşme bölüm 9): SSH parolası ve MCP anahtarlarının şifreli kaydı. Şifreleme AES-256-GCM, anahtar
 * `URETIM_GIZLI_ANAHTAR` ortam değişkeninden (yoksa özellik kapalı). Sistem parolası için SHA-512 crypt (`$6$`) özeti
 * üretilir; açık parola diske hiç yazılmaz, eşitleyici `chpasswd -e` ile yalnız özeti uygular.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";

export class Kasa {
  private readonly anahtar: Buffer | null;

  constructor(ham: string | null) {
    this.anahtar = ham && ham.length >= 16 ? createHash("sha256").update(`uretim-kasa:${ham}`).digest() : null;
  }

  get acik(): boolean {
    return this.anahtar !== null;
  }

  sifrele(metin: string): string {
    if (!this.anahtar) throw new Error("kasa kapalı");
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.anahtar, iv);
    const ct = Buffer.concat([c.update(metin, "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
  }

  coz(kayit: string): string | null {
    if (!this.anahtar) return null;
    try {
      const b = Buffer.from(kayit, "base64url");
      const d = createDecipheriv("aes-256-gcm", this.anahtar, b.subarray(0, 12));
      d.setAuthTag(b.subarray(12, 28));
      return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
    } catch {
      return null;
    }
  }
}

/** Karışıklık yaratan harfler (0/O, 1/l/I) olmadan rastgele parola. */
const ABECE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export function parolaUret(uzunluk = 28): string {
  let p = "";
  for (let i = 0; i < uzunluk; i++) p += ABECE[randomInt(0, ABECE.length)];
  return p;
}

// ---- SHA-512 crypt (glibc `$6$`, Ulrich Drepper'in tanımı) ---------------------------------------------------

const B64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const sha = (...p: Buffer[]): Buffer => {
  const h = createHash("sha512");
  for (const x of p) h.update(x);
  return h.digest();
};
const tekrarla = (kaynak: Buffer, boy: number): Buffer => {
  const out = Buffer.alloc(boy);
  for (let i = 0; i < boy; i++) out[i] = kaynak[i % kaynak.length] ?? 0;
  return out;
};

export function sha512Crypt(parola: string, tuz: string, tur = 5000): string {
  const p = Buffer.from(parola, "utf8");
  const s = Buffer.from(tuz.slice(0, 16), "utf8");
  const b = sha(p, s, p);
  const aParca: Buffer[] = [p, s, tekrarla(b, p.length)];
  for (let n = p.length; n > 0; n >>= 1) aParca.push(n & 1 ? b : p);
  const a = sha(...aParca);
  const dp = sha(...Array.from({ length: p.length }, () => p));
  const P = tekrarla(dp, p.length);
  const ds = sha(...Array.from({ length: 16 + (a[0] ?? 0) }, () => s));
  const S = tekrarla(ds, s.length);
  let c = a;
  for (let i = 0; i < tur; i++) {
    const parca: Buffer[] = [i & 1 ? P : c];
    if (i % 3) parca.push(S);
    if (i % 7) parca.push(P);
    parca.push(i & 1 ? c : P);
    c = sha(...parca);
  }
  const sira = [
    [0, 21, 42], [22, 43, 1], [44, 2, 23], [3, 24, 45], [25, 46, 4], [47, 5, 26], [6, 27, 48], [28, 49, 7], [50, 8, 29],
    [9, 30, 51], [31, 52, 10], [53, 11, 32], [12, 33, 54], [34, 55, 13], [56, 14, 35], [15, 36, 57], [37, 58, 16],
    [59, 17, 38], [18, 39, 60], [40, 61, 19], [62, 20, 41],
  ];
  let out = "";
  const yaz = (v: number, n: number): void => {
    for (let i = 0; i < n; i++) {
      out += B64[v & 63];
      v >>= 6;
    }
  };
  for (const [x, y, z] of sira) yaz(((c[x ?? 0] ?? 0) << 16) | ((c[y ?? 0] ?? 0) << 8) | (c[z ?? 0] ?? 0), 4);
  yaz(c[63] ?? 0, 2);
  return `$6$${tuz.slice(0, 16)}$${out}`;
}

export function cryptTuzu(): string {
  let t = "";
  for (let i = 0; i < 16; i++) t += B64[randomInt(0, 64)];
  return t;
}
