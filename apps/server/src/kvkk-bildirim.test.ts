import { describe, expect, it } from "vitest";
import { createAccounts } from "./accountStore.js";
import { buildExport } from "./kvkk.js";
import { noopSocial } from "./social.js";

describe("verimi indir: gönderilen bildirimler", () => {
  it("hesabın yazdığı bildirim dökümde; başkasının bildirimi, hedef ve yönetici notu yok", () => {
    const db = createAccounts(":memory:");
    const mk = (n: string): number => {
      const r = db.create(n, `${n}@t.local`, "x", 1);
      if (!r.ok) throw new Error("hesap");
      return r.account.id;
    };
    const ali = mk("Ali");
    const veli = mk("Veli");
    const base = {
      targetAccountId: veli,
      targetName: "HedefAdi",
      targetPlayerId: "p1",
      roomCode: "ABCDE",
      gameId: null,
      reason: "abuse" as const,
      evidence: null,
      createdAt: 5_000,
    };
    db.reportInsert({ ...base, reporterAccountId: ali, note: "bana küfretti" });
    db.reportInsert({ ...base, reporterAccountId: veli, targetAccountId: ali, note: "VELI-NOTU" });
    const out = buildExport(db, noopSocial, ali, 10_000);
    expect(out?.reports_filed).toEqual([
      { at: new Date(5_000).toISOString(), reason: "abuse", note: "bana küfretti" },
    ]);
    const text = JSON.stringify(out);
    expect(text).not.toContain("VELI-NOTU");
    expect(text).not.toContain("HedefAdi");
  });
});
