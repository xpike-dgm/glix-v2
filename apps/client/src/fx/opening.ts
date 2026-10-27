import { type Accessor, createSignal, onCleanup, untrack } from "solid-js";
import { serverNow } from "../net/store.js";
import { reducedMotion } from "./motion.js";

/** Açılış sahnesinin süresi (ms); bitince sahne kaldırılır. */
export const OPENING_MS = 1900;
/** Aşama başlangıcından bu kadar geç gelen (yeniden bağlanan, sayfayı yenileyen) oyuncuya sahne oynatılmaz. */
export const OPENING_FRESH_MS = 2500;

/** Bu oturumda açılışı oynatılmış aşamalar; ekran yeniden kurulsa da aynı aşama bir daha oynatmaz. */
const played = new Set<string>();

/** Saf karar: taze bir aşama başlangıcı, hareket azaltılmamış ve bu aşama için daha önce oynatılmamış. */
export function shouldPlayOpening(input: {
  startedAt: number;
  now: number;
  reduced: boolean;
  alreadyPlayed: boolean;
}): boolean {
  if (input.reduced || input.alreadyPlayed) return false;
  const age = input.now - input.startedAt;
  return age >= -500 && age <= OPENING_FRESH_MS;
}

/**
 * Oyun aşaması başlarken tek seferlik süs sahnesi. Girişi engellemez: yalnız "oynuyor" bilgisini verir,
 * sahne dokunulmaz bir katmandır. Anahtar oyun kimliği + aşama başlangıcıdır.
 */
export function createOpening(gameId: string, startedAt: Accessor<number | undefined>): Accessor<boolean> {
  const [playing, setPlaying] = createSignal(false);
  const at = untrack(startedAt);
  if (at !== undefined) {
    const key = `${gameId}:${at}`;
    const play = shouldPlayOpening({
      startedAt: at,
      now: serverNow(),
      reduced: reducedMotion(),
      alreadyPlayed: played.has(key),
    });
    played.add(key);
    if (play) {
      setPlaying(true);
      const t = setTimeout(() => setPlaying(false), OPENING_MS);
      onCleanup(() => clearTimeout(t));
    }
  }
  return playing;
}
