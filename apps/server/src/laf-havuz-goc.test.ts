import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createAccounts } from "./accountStore.js";
import { loadSqlite } from "./statsStore.js";

const dir = mkdtempSync(join(tmpdir(), "glix-laf-goc-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("Laf Sokma ton havuzlarının tek havuza taşınması (göç)", () => {
  it("üç eski havuzun satırları laf-sokma/sorular'a taşınır; çakışmada en eski kayıt kalır", () => {
    const path = join(dir, "hesap.db");
    // Göçten önceki duruma getir: Laf göçünü ve ondan sonraki Glix (tablo + sütun), mağaza (iki tablo), ekonomi (iki indeks) ve günlük görev (tablo + defter yeniden kurulumu) kapsayıcı indeks oyuncu listesi indeks ve ansiklopedi notu göçlerini geri al, eski kimlikli
    // satırları ekle.
    createAccounts(path).close();
    const { DatabaseSync: Db } = loadSqlite();
    const raw = new Db(path);
    raw.exec(
      "DELETE FROM account_schema_version WHERE version >= (SELECT MAX(version) - 8 FROM account_schema_version)",
    );
    raw.exec(
      "DROP TABLE wiki_feedback; DROP INDEX sessions_seen; DROP INDEX accounts_suspended; DROP INDEX accounts_created; DROP INDEX accounts_glix; DROP INDEX account_games_cover; DROP INDEX account_matches_cover; DROP TABLE quest_rewards; DROP TABLE cosmetic_equipped; DROP TABLE cosmetic_owned; DROP TABLE glix_ledger; ALTER TABLE accounts DROP COLUMN glix;",
    );
    const put = raw.prepare(
      "INSERT INTO content_overrides (pool_id, entry_key, action, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    put.run("laf-sokma/aile", "ortak soru", "disable", null, 10, 10);
    put.run("laf-sokma/ofis", "ortak soru", "disable", null, 5, 5); // çakışma: daha eski olan kalır
    put.run("laf-sokma/arkadas", "yeni soru", "add", "Yeni soru?", 20, 21);
    put.run("laf-sokma/ofis", "yeni soru", "add", "Yeni soru (ofis)?", 30, 30); // çakışma: arkadaş kalır
    put.run("sozluk-blofu/kelimeler", "kelime", "disable", null, 1, 1); // başka havuza dokunulmaz
    raw.close();

    const accounts = createAccounts(path);
    const rows = accounts.contentOverrides();
    accounts.close();
    expect(rows.some((r) => /^laf-sokma\/(aile|arkadas|ofis)$/.test(r.poolId))).toBe(false);
    const laf = rows.filter((r) => r.poolId === "laf-sokma/sorular");
    expect(laf.map((r) => [r.key, r.action, r.value, r.createdAt])).toEqual([
      ["ortak soru", "disable", null, 5],
      ["yeni soru", "add", "Yeni soru?", 20],
    ]);
    expect(rows.filter((r) => r.poolId === "sozluk-blofu/kelimeler")).toHaveLength(1);

    // İkinci açılışta göç yeniden çalışmaz (idempotent).
    const again = createAccounts(path);
    expect(again.contentOverrides()).toHaveLength(3);
    again.close();
  });
});
