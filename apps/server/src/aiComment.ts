/**
 * Oyun sonu yorumu: oyundan bağımsız, sunucunun ek katmanı. Oyun sonucu hesaplanınca tek bir istekle dil modeli
 * servisine (Anthropic Messages API) kısa bir özet yazdırır. Oyun motoru bundan habersizdir ve deterministik kalır.
 *
 * Güvenceler: anahtar yoksa özellik tamamen kapalıdır (hiç istek yok). Anahtar günlüğe, yanıta ya da istemciye
 * gitmez. Modele yalnız oyun bilgisi gider (çağıran kurar). Zaman aşımı, hata ya da boş/uygunsuz yanıtta yorum
 * yoktur; oyun hiç beklemez (sonuç geciktirilmez; yorum gelirse sonradan eklenir). Sunucu genelinde dakikalık sınır.
 */
import { GAME_COMMENT_MAX } from "@glix/engine";
import type { Clock } from "./clock.js";
import { log } from "./log.js";

export const AI_COMMENT_URL = "https://api.anthropic.com/v1/messages";
export const AI_COMMENT_MODEL = "claude-haiku-5-5";
export const AI_COMMENT_API_VERSION = "2023-06-01";
export const AI_COMMENT_TIMEOUT_MS = 2_500;
/** Sunucu genelinde bir dakikada en çok bu kadar istek. */
export const AI_COMMENT_PER_MINUTE = 20;
const MINUTE_MS = 60_000;
const MAX_TOKENS = 120;

/** Yerleşik `fetch`in burada kullanılan kısmı (testlerde sahte verilir). */
export type AiFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    redirect: "manual";
    signal: AbortSignal;
  },
) => Promise<{ status: number; json(): Promise<unknown> }>;

/** Modele giden istek: kısa sistem talimatı ve yalnız oyun bilgisinden kurulmuş metin. */
export interface AiPrompt {
  system: string;
  user: string;
  /**
   * Yer tutucu -> gerçek ad ("Oyuncu1" -> "Mert"). Modele gerçek adlar gitmez (istem enjeksiyonuna karşı); doğrulanmış
   * yanıttaki yer tutucular bu tabloyla değiştirilir ve metin yeniden doğrulanır.
   */
  names?: Readonly<Record<string, string>>;
}

export interface AiCommenter {
  /** Anahtar tanımlı mı (değilse hiçbir şey denenmez). */
  readonly enabled: boolean;
  /**
   * Tek istek başlatır ve hemen döner (beklenmez). Yanıt geçerliyse `onText` bir kez çağrılır; aksi hâlde hiç.
   * true: istek gönderildi; false: kapalı ya da hız sınırı dolu. Hiç fırlatmaz.
   */
  request(prompt: AiPrompt, onText: (text: string) => void): boolean;
}

export const disabledAiCommenter: AiCommenter = { enabled: false, request: () => false };

export interface AiCommenterOptions {
  apiKey: string | null;
  clock: Clock;
  /** Metin yasaklı kelimeye takılıyor mu (yönetici listesi). */
  isBanned: (text: string) => boolean;
  fetch?: AiFetch;
  timeoutMs?: number;
  perMinute?: number;
}

/**
 * Yanıt metnini doğrular: tek satır düz metin, en çok 90 karakter, biçimlendirme/bağlantı yok, yasaklı kelime yok.
 * Baştaki/sondaki tırnaklar atılır. Geçmezse null.
 */
export function cleanComment(raw: unknown, isBanned: (text: string) => boolean): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  if (/[\r\n]/.test(text)) return null;
  text = text.replace(/^["'“”‘’«»„\s]+|["'“”‘’«»„\s]+$/g, "");
  if (text.length === 0 || Array.from(text).length > GAME_COMMENT_MAX) return null;
  // Denetim karakteri, işaretleme ya da bağlantı içeren metin "düz metin" değildir.
  if (/\p{Cc}/u.test(text) || /[<>`*#_[\]{}|\\]/.test(text) || /https?:|www\./i.test(text)) return null;
  if (isBanned(text)) return null;
  return text;
}

/**
 * Messages API yanıtından metin bloklarını birleştirir; biçim tutmuyorsa ya da yanıt kendiliğinden bitmediyse
 * (`stop_reason` "end_turn" değil: yarım cümle olabilir) null.
 */
export function responseText(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if ((body as { stop_reason?: unknown }).stop_reason !== "end_turn") return null;
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as { type?: unknown; text?: unknown };
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.length > 0 ? parts.join("") : null;
}

/**
 * Yer tutucuları ("Oyuncu3") gerçek adlarla değiştirir ve sonucu yeniden doğrular (uzunluk, süzgeç). Bilinmeyen yer
 * tutucu kalırsa ya da ad değişiminden sonra metin geçmezse null (kısaltılmaz, gösterilmez).
 */
export function withNames(
  text: string,
  names: Readonly<Record<string, string>> | undefined,
  isBanned: (text: string) => boolean,
): string | null {
  if (!names) return text;
  let unknown = false;
  const replaced = text.replace(/Oyuncu\d+/g, (m) => {
    const name = Object.hasOwn(names, m) ? names[m] : undefined;
    if (name === undefined) unknown = true;
    return name ?? m;
  });
  if (unknown) return null;
  return cleanComment(replaced, isBanned) === replaced ? replaced : null;
}

export function createAiCommenter(opts: AiCommenterOptions): AiCommenter {
  const key = opts.apiKey?.trim() ?? "";
  if (!key) return disabledAiCommenter;
  const doFetch: AiFetch = opts.fetch ?? (fetch as unknown as AiFetch);
  const timeoutMs = opts.timeoutMs ?? AI_COMMENT_TIMEOUT_MS;
  const perMinute = opts.perMinute ?? AI_COMMENT_PER_MINUTE;
  const sent: number[] = [];

  const allow = (): boolean => {
    const now = opts.clock.now();
    while (sent.length > 0 && (sent[0] as number) <= now - MINUTE_MS) sent.shift();
    if (sent.length >= perMinute) return false;
    sent.push(now);
    return true;
  };

  async function run(prompt: AiPrompt, signal: AbortSignal): Promise<string | null> {
    const res = await doFetch(AI_COMMENT_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": AI_COMMENT_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: AI_COMMENT_MODEL,
        max_tokens: MAX_TOKENS,
        // Düşünme kapalı: açıkken kısa sınırda yalnız düşünme bloğu gelir, metin hiç çıkmaz.
        thinking: { type: "disabled" },
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      }),
      redirect: "manual",
      signal,
    });
    if (res.status < 200 || res.status >= 300) {
      log.warn("ai_comment_failed", { status: res.status });
      return null;
    }
    const text = cleanComment(responseText(await res.json()), opts.isBanned);
    return text === null ? null : withNames(text, prompt.names, opts.isBanned);
  }

  return {
    enabled: true,
    request(prompt, onText) {
      if (!allow()) {
        log.warn("ai_comment_rate_limited");
        return false;
      }
      const controller = new AbortController();
      let settled = false;
      const cancelTimer = opts.clock.setTimeout(() => {
        if (settled) return;
        settled = true;
        controller.abort();
        log.warn("ai_comment_timeout");
      }, timeoutMs);
      const finish = (text: string | null): void => {
        if (settled) return;
        settled = true;
        cancelTimer();
        if (text === null) return;
        try {
          onText(text);
        } catch (err) {
          log.warn("ai_comment_apply_failed", { error: String(err) });
        }
      };
      // Hata metni anahtar ya da istek ayrıntısı içerebilir: yalnız genel kayıt.
      run(prompt, controller.signal).then(finish, () => {
        if (!settled) log.warn("ai_comment_failed");
        finish(null);
      });
      return true;
    },
  };
}
