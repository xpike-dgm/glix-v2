import { describe, expect, it, vi } from "vitest";
import {
  AI_COMMENT_MODEL,
  type AiFetch,
  type AiPrompt,
  cleanComment,
  createAiCommenter,
  disabledAiCommenter,
  responseText,
} from "./aiComment.js";
import { commentPrompt, promptName } from "./aiCommentGames.js";
import { createManualClock } from "./clock.js";

const PROMPT: AiPrompt = { system: "s", user: "u" };
const noBan = () => false;
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const reply = (text: string, status = 200) =>
  vi.fn<AiFetch>(async () => ({ status, json: async () => ({ content: [{ type: "text", text }] }) }));

describe("oyun sonu yorumu", () => {
  it("anahtar yoksa özellik kapalıdır ve hiç istek yapılmaz", () => {
    const fetch = reply("x");
    for (const apiKey of [null, "", "   "]) {
      const ai = createAiCommenter({ apiKey, clock: createManualClock(), isBanned: noBan, fetch });
      expect(ai.enabled).toBe(false);
      expect(ai.request(PROMPT, () => undefined)).toBe(false);
    }
    expect(disabledAiCommenter.enabled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("tek istek: doğru adres, başlıklar ve model; geçerli yanıt bir kez iletilir", async () => {
    const fetch = reply("  Bomba uzmanı bile bu kadar sakin kesemezdi.  ");
    const ai = createAiCommenter({ apiKey: "k-1", clock: createManualClock(), isBanned: noBan, fetch });
    const got: string[] = [];
    expect(ai.request(PROMPT, (t) => got.push(t))).toBe(true);
    await flush();
    expect(got).toEqual(["Bomba uzmanı bile bu kadar sakin kesemezdi."]);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init?.method).toBe("POST");
    expect(init?.headers["x-api-key"]).toBe("k-1");
    expect(init?.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
    expect(body.model).toBe(AI_COMMENT_MODEL);
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.system).toBe("s");
    expect(body.messages).toEqual([{ role: "user", content: "u" }]);
  });

  it("zaman aşımında (2,5 sn) yorum yok; geç gelen yanıt yok sayılır ve istek iptal edilir", async () => {
    const clock = createManualClock();
    let release: (v: { status: number; json(): Promise<unknown> }) => void = () => undefined;
    let aborted = false;
    const fetch = vi.fn<AiFetch>(
      (_url, init) =>
        new Promise((resolve) => {
          init.signal.addEventListener("abort", () => {
            aborted = true;
          });
          release = resolve;
        }),
    );
    const ai = createAiCommenter({ apiKey: "k", clock, isBanned: noBan, fetch });
    const got: string[] = [];
    ai.request(PROMPT, (t) => got.push(t));
    clock.advance(2_499);
    expect(aborted).toBe(false);
    clock.advance(1);
    expect(aborted).toBe(true);
    release({ status: 200, json: async () => ({ content: [{ type: "text", text: "Geç kaldım." }] }) });
    await flush();
    expect(got).toEqual([]);
  });

  it("hata, başarısız durum kodu, boş ya da bozuk yanıt: yorum yok, fırlatmaz", async () => {
    const cases: AiFetch[] = [
      vi.fn<AiFetch>(async () => {
        throw new Error("ağ yok k-gizli");
      }),
      reply("Güzel", 500),
      reply(""),
      vi.fn<AiFetch>(async () => ({ status: 200, json: async () => ({ content: [] }) })),
      vi.fn<AiFetch>(async () => ({ status: 200, json: async () => "x" })),
      vi.fn<AiFetch>(async () => ({
        status: 200,
        json: async () => {
          throw new Error("bozuk");
        },
      })),
    ];
    for (const fetch of cases) {
      const ai = createAiCommenter({ apiKey: "k-gizli", clock: createManualClock(), isBanned: noBan, fetch });
      const got: string[] = [];
      expect(() => ai.request(PROMPT, (t) => got.push(t))).not.toThrow();
      await flush();
      expect(got).toEqual([]);
    }
  });

  it("uzun, çok satırlı, işaretlemeli ya da yasaklı kelimeli metin reddedilir", async () => {
    expect(cleanComment("a".repeat(90), noBan)).toBe("a".repeat(90));
    expect(cleanComment("a".repeat(91), noBan)).toBeNull();
    expect(cleanComment("ilk satır\nikinci satır", noBan)).toBeNull();
    expect(cleanComment("**kalın** yorum", noBan)).toBeNull();
    expect(cleanComment("<b>yorum</b>", noBan)).toBeNull();
    expect(cleanComment("bak https://ornek.com", noBan)).toBeNull();
    expect(cleanComment("   ", noBan)).toBeNull();
    expect(cleanComment(42, noBan)).toBeNull();
    expect(cleanComment('"Tırnaklı yorum."', noBan)).toBe("Tırnaklı yorum.");
    const banned = (t: string) => t.includes("kötü");
    expect(cleanComment("Bu kötü bir kesimdi", banned)).toBeNull();
    const fetch = reply("x".repeat(120));
    const ai = createAiCommenter({ apiKey: "k", clock: createManualClock(), isBanned: noBan, fetch });
    const got: string[] = [];
    ai.request(PROMPT, (t) => got.push(t));
    await flush();
    expect(got).toEqual([]);
    expect(
      responseText({
        content: [{ type: "text", text: "a" }, { type: "tool_use" }, { type: "text", text: "b" }],
      }),
    ).toBe("ab");
  });

  it("sunucu genelinde dakikada en çok 20 istek", () => {
    const clock = createManualClock();
    const fetch = reply("Tamam.");
    const ai = createAiCommenter({ apiKey: "k", clock, isBanned: noBan, fetch });
    for (let i = 0; i < 20; i++) expect(ai.request(PROMPT, () => undefined)).toBe(true);
    expect(ai.request(PROMPT, () => undefined)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(20);
    clock.advance(60_000);
    expect(ai.request(PROMPT, () => undefined)).toBe(true);
    const small = createAiCommenter({ apiKey: "k", clock, isBanned: noBan, fetch, perMinute: 1 });
    expect(small.request(PROMPT, () => undefined)).toBe(true);
    expect(small.request(PROMPT, () => undefined)).toBe(false);
  });
});

describe("oyun sonu yorumu: oyun özeti", () => {
  const view = {
    players: ["id-1", "id-2"],
    results: [
      { rows: { "id-1": { cut: "blue", correct: true }, "id-2": { cut: null, correct: false } } },
      { rows: { "id-1": { cut: "red", correct: false }, "id-2": { cut: "green", correct: true } } },
      { rows: { "id-1": { cut: "purple", correct: true }, "id-2": { cut: "yellow", correct: false } } },
    ],
    reveal: { totals: { "id-1": 3, "id-2": 2 }, awards: { "id-1": 2, "id-2": 1 } },
  };
  const names: Record<string, string> = { "id-1": "Mert", "id-2": "Elif\nyeni satır" };

  it("yalnız takma adlar, dalga dalga kesimler ve puanlar; kimlik yok", () => {
    const p = commentPrompt("kontrol-paneli-kaosu", view, (id) => names[id] ?? null);
    expect(p).not.toBeNull();
    const user = p?.user ?? "";
    expect(user).toContain("- Mert: dalga 1: mavi (doğru), dalga 2: kırmızı (yanlış), dalga 3: mor (doğru)");
    expect(user).toContain("imha puanı 3, ödül +2");
    expect(user).toContain("- Elif yeni satır: dalga 1: kesmedi");
    expect(user).not.toContain("id-1");
    expect(p?.system).toMatch(/Türkçe/);
  });

  it("sonuç açılmadıysa ya da oyun desteklemiyorsa özet yok", () => {
    expect(commentPrompt("kontrol-paneli-kaosu", { ...view, reveal: null }, () => "x")).toBeNull();
    expect(commentPrompt("kontrol-paneli-kaosu", null, () => "x")).toBeNull();
    expect(commentPrompt("butona-bas", view, () => "x")).toBeNull();
  });

  it("takma ad kısaltılır ve işaretlemeden arındırılır", () => {
    expect(promptName("<script>**Ali**</script>")).not.toMatch(/[<>*]/);
    expect(Array.from(promptName("x".repeat(80)))).toHaveLength(24);
    expect(promptName("   ")).toBe("Oyuncu");
  });
});
