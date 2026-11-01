/**
 * Güvenlik incelemesi YÜKSEK-1: `deploy/uretim/ssh/eslestir.sh` (root, cron) site kabının yazabildiği klasörden okur.
 * Betik sahte kökte, sahte `id`/`chpasswd`/`chown`/`logger` ile çalıştırılır; gerçek sisteme dokunulmaz.
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cryptTuzu, sha512Crypt } from "./gizli.js";

const BETIK = resolve(import.meta.dirname, "../../../deploy/uretim/ssh/eslestir.sh");
const UID = String(process.getuid?.() ?? 0);
const ANAHTAR = `um_ses_${"A".repeat(43)}`;
const ED = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk2Vn2u0pJkJm4n0yQ2kQe7mS3c4Rr0bJ7Zq3c9yR1a";

let d: string;
let yetki: string;

beforeEach(() => {
  d = mkdtempSync(join(tmpdir(), "eslestir-"));
  yetki = join(d, "yetki");
  const bin = join(d, "bin");
  for (const k of [yetki, bin, join(d, "etc"), join(d, "kok/ses/etc/uretim")])
    mkdirSync(k, { recursive: true });
  writeFileSync(join(d, "alanlar.txt"), "ses\n");
  const yaz = (ad: string, govde: string) => {
    writeFileSync(join(bin, ad), `#!/usr/bin/env bash\n${govde}\n`);
    chmodSync(join(bin, ad), 0o755);
  };
  // Sahte `id`: uretim-ses ayrılmış aralıkta ve yalnız uretim-alanlari grubunda (ortamla değiştirilebilir).
  yaz(
    "id",
    `case "$1" in -u) [ "$2" = uretim-ses ] && echo "\${SAHTE_UID:-3920}" || exit 1;; -nG) echo "\${SAHTE_GRUP:-uretim-alanlari}";; esac`,
  );
  yaz("chpasswd", `cat >> "${d}/chpasswd.log"`);
  yaz("chown", "exit 0");
  yaz("logger", `echo "$*" >> "${d}/logger.log"`);
});
afterEach(() => rmSync(d, { recursive: true, force: true }));

function calistir(ek: Record<string, string> = {}): void {
  execFileSync("bash", [BETIK], {
    env: {
      PATH: `${join(d, "bin")}:${process.env.PATH ?? ""}`,
      URETIM_SSH_YETKI: yetki,
      URETIM_SSH_KOK: join(d, "kok"),
      URETIM_SSH_ETC: join(d, "etc"),
      URETIM_SSH_DURUM: join(d, "durum"),
      URETIM_SSH_ALANLAR: join(d, "alanlar.txt"),
      URETIM_SITE_UID: UID,
      ...ek,
    },
    stdio: "pipe",
  });
}
const chpasswd = (): string =>
  existsSync(join(d, "chpasswd.log")) ? readFileSync(join(d, "chpasswd.log"), "utf8") : "";
const dosya = (ad: string, icerik: string, mod = 0o600): string => {
  const p = join(yetki, ad);
  writeFileSync(p, icerik, { mode: mod });
  chmodSync(p, mod);
  return p;
};
const ozet = (): string => sha512Crypt("parola-deneme", cryptTuzu());

describe("eslestir.sh parola", () => {
  it("geçerli özet yalnız uretim-<alan> için chpasswd'ye gider (kullanıcı adı betikten)", () => {
    const o = ozet();
    dosya("ses.parola", `${o}\n`);
    calistir();
    expect(chpasswd()).toBe(`uretim-ses:${o}\n`);
    // Aynı özet ikinci kez uygulanmaz.
    calistir();
    expect(chpasswd()).toBe(`uretim-ses:${o}\n`);
  });

  it("SALDIRI: satır sonsuz ikinci satırla root parolası değiştirilemez", () => {
    dosya("ses.parola", `uretim-ses:${ozet()}\nroot:${ozet()}`);
    calistir();
    expect(chpasswd()).not.toMatch(/root:/);
    expect(chpasswd()).toBe("");
    dosya("ses.parola", `${ozet()}\nroot:${ozet()}`);
    calistir();
    expect(chpasswd()).toBe("");
  });

  it("SALDIRI: dosyadaki kullanıcı adı, NUL, fazla satır sonu, uzun dosya reddedilir", () => {
    for (const icerik of [
      `root:${ozet()}\n`,
      `${ozet()}\0root\n`,
      `${ozet()}\n\n`,
      `${ozet()}${"a".repeat(500)}\n`,
      "$6$tuz$kisa\n",
    ]) {
      dosya("ses.parola", icerik);
      calistir();
      expect(chpasswd()).toBe("");
    }
  });

  it("SALDIRI: sembolik bağ, sert bağ, geniş izin ve yabancı sahip okunmaz", () => {
    const disari = join(d, "disari.parola");
    writeFileSync(disari, `${ozet()}\n`, { mode: 0o600 });
    symlinkSync(disari, join(yetki, "ses.parola"));
    calistir();
    expect(chpasswd()).toBe("");
    rmSync(join(yetki, "ses.parola"));
    linkSync(disari, join(yetki, "ses.parola"));
    calistir();
    expect(chpasswd()).toBe("");
    rmSync(join(yetki, "ses.parola"));
    dosya("ses.parola", `${ozet()}\n`, 0o644);
    calistir();
    expect(chpasswd()).toBe("");
    dosya("ses.parola", `${ozet()}\n`);
    calistir({ URETIM_SITE_UID: "12345" });
    expect(chpasswd()).toBe("");
  });

  it("SALDIRI: alan kullanıcısı değilse (aralık dışı uid ya da başka grup) hiçbir şey uygulanmaz", () => {
    dosya("ses.parola", `${ozet()}\n`);
    calistir({ SAHTE_UID: "0" });
    calistir({ SAHTE_GRUP: "uretim-alanlari sudo" });
    expect(chpasswd()).toBe("");
  });
});

describe("eslestir.sh anahtarlar", () => {
  it("authorized_keys ve kanal anahtarı doğrulanıp atomik yerleşir; bağ ve bozuk satır reddedilir", () => {
    const hedef = join(d, "etc/uretim-ses.authorized_keys");
    const ahedef = join(d, "kok/ses/etc/uretim/anahtar");
    dosya("ses.authorized_keys", `restrict ${ED} uretim-ses-1\n`, 0o644);
    dosya("ses.anahtar", `${ANAHTAR}\n`);
    calistir();
    expect(readFileSync(hedef, "utf8")).toBe(`restrict ${ED} uretim-ses-1\n`);
    expect(statSync(hedef).mode & 0o777).toBe(0o644);
    expect(readFileSync(ahedef, "utf8")).toBe(`${ANAHTAR}\n`);
    expect(statSync(ahedef).mode & 0o777).toBe(0o400);
    // SALDIRI: seçenekli satır uygulanmaz, eski içerik kalır.
    dosya("ses.authorized_keys", `command="sh" ${ED} uretim-ses-1\n`, 0o644);
    calistir();
    expect(readFileSync(hedef, "utf8")).toBe(`restrict ${ED} uretim-ses-1\n`);
    // SALDIRI: kaynakta sembolik bağ (ör. /etc/shadow) okunmaz, kopyalanmaz.
    rmSync(join(yetki, "ses.authorized_keys"));
    const sir = join(d, "sir");
    writeFileSync(sir, `restrict ${ED} uretim-ses-9\n`);
    symlinkSync(sir, join(yetki, "ses.authorized_keys"));
    calistir();
    expect(readFileSync(hedef, "utf8")).toBe(`restrict ${ED} uretim-ses-1\n`);
    // Kanal anahtarı başka alanın biçimindeyse kaldırılır.
    dosya("ses.anahtar", `um_magaza_${"A".repeat(43)}\n`);
    calistir();
    expect(existsSync(ahedef)).toBe(false);
  });
});

describe("ORTA-4 giriş kaydı kalıpları (kullanıcı adı enjeksiyonu)", () => {
  const ONEK = "2026-11-01T10:00:00+0300 vds sshd[4242]: ";
  // Saldırgan kullanıcı adına sahte bir "from <IP>" ya da sahte bir satır yazar.
  const satirlar = [
    `${ONEK}Accepted password for uretim-magaza from 203.0.113.5 port 50000 ssh2`,
    `${ONEK}Failed password for uretim-ses from 198.51.100.2 port 50001 ssh2`,
    `${ONEK}Failed password for invalid user uretim-yok from 198.51.100.3 port 50002 ssh2`,
    `${ONEK}Invalid user uretim-yok from 198.51.100.3 port 50002`,
    // Saldırılar:
    `${ONEK}Failed password for invalid user x: Accepted password for uretim-magaza from 1.1.1.1 port 1 ssh2 from 198.51.100.66 port 50003 ssh2`,
    `${ONEK}Invalid user uretim-a from 9.9.9.9 port 22 from 198.51.100.66 port 50004`,
    `${ONEK}Failed password for invalid user uretim-a from 9.9.9.9 port 22 ssh2 from 198.51.100.66 port 50005 ssh2`,
    `2026-11-01T10:00:00+0300 vds kotu[1]: x sshd[1]: Accepted password for uretim-magaza from 8.8.8.8 port 1 ssh2`,
  ];

  it("girisler.sh yalnız tam biçimli satırları yazar; saldırgan IP ya da başarılı kayıt seçemez", () => {
    const kaynak = join(d, "auth.log");
    writeFileSync(kaynak, `${satirlar.join("\n")}\n`);
    execFileSync("bash", [resolve(BETIK, "../girisler.sh")], {
      env: {
        PATH: process.env.PATH ?? "",
        URETIM_SSH_KAYNAK: kaynak,
        URETIM_SSH_GUNLUK: join(d, "gunluk/girisler.log"),
        URETIM_SSH_DURUM: join(d, "durum"),
      },
    });
    const cikti = readFileSync(join(d, "gunluk/girisler.log"), "utf8").trim().split("\n");
    expect(cikti).toEqual([
      "2026-11-01T10:00:00+0300|basarili|uretim-magaza|password|203.0.113.5",
      "2026-11-01T10:00:00+0300|basarisiz|uretim-ses|password|198.51.100.2",
      "2026-11-01T10:00:00+0300|basarisiz|uretim-yok|password|198.51.100.3",
    ]);
  });

  it("fail2ban süzgeci: önek sabit, kullanıcı adı boşluksuz, satır sonuna bağlı", () => {
    const f = readFileSync(resolve(BETIK, "../fail2ban/uretim-sshd.filter.conf"), "utf8");
    expect(f).toMatch(/^prefregex = /m);
    expect(f).not.toMatch(/\^\.\*sshd/);
    // failregex satırlarını JS'e çevir (<HOST>, <F-USER>), prefregex yerine sshd öneki.
    const kalip = [...f.matchAll(/^(?:failregex =|\s+)\s*(\^.+\$)$/gm)].map(
      (m) =>
        new RegExp((m[1] ?? "").replace(/<HOST>/g, "(?<host>[0-9a-fA-F:.]+)").replace(/<\/?F-USER>/g, "")),
    );
    expect(kalip.length).toBe(2);
    const yakala = (s: string): string | null => {
      const icerik = /^\S+ \S+ sshd(?:-session)?\[\d+\]: (.+)$/.exec(s)?.[1];
      if (!icerik) return null;
      for (const k of kalip) {
        const m = k.exec(icerik);
        if (m?.groups?.host) return m.groups.host;
      }
      return null;
    };
    expect(satirlar.map(yakala)).toEqual([
      null,
      "198.51.100.2",
      "198.51.100.3",
      "198.51.100.3",
      null,
      null,
      null,
      null,
    ]);
  });
});
