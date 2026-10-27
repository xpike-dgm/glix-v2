import { createEffect, createRoot } from "solid-js";
import {
  createMusicScheduler,
  type MusicMode,
  type MusicScheduler,
  TENSION_START_S,
} from "./musicScheduler.js";
import { musicBus, musicVolume, muted, onAudioUnlocked } from "./sound.js";

/**
 * Müzik katmanının uygulama tarafı: istenen durumu (lobi döngüsü / gerilim) tutar, bağlam kullanıcı jestiyle
 * açılınca, ses kapalı değilken ve sekme görünürken çalar. Jestten önce hiçbir şey çalmaz (iOS); istek
 * saklanır, bağlam açılınca başlar. Sessiz tercihi ve müzik düzeyi 0 hepsini keser.
 */

let lobbyOn = false;
let tension = 0;
let scheduler: MusicScheduler | null = null;
let schedulerCtx: unknown = null;

function wantedMode(): MusicMode | null {
  if (tension > 0) return "tension";
  return lobbyOn ? "lobby" : null;
}

function sync(): void {
  const mode = wantedMode();
  const silent = muted() || musicVolume() <= 0 || (typeof document !== "undefined" && document.hidden);
  const bus = musicBus();
  if (!bus || silent || mode === null) {
    scheduler?.stop();
    return;
  }
  if (!scheduler || schedulerCtx !== bus.ctx) {
    scheduler?.stop();
    scheduler = createMusicScheduler({ ctx: bus.ctx, out: bus.out });
    schedulerCtx = bus.ctx;
  }
  scheduler.setIntensity(tension);
  scheduler.start(mode);
}

/** Lobi döngüsü: lobide açık, maç başlayınca kapalı. */
export function setLobbyMusic(on: boolean): void {
  if (lobbyOn === on) return;
  lobbyOn = on;
  sync();
}

/**
 * Gerilim yoğunluğu 0..1 (0: kapalı). Yalnız kabuk saatinden (`Clock`) gelir; saati gizli oyunlarda
 * saat hiç çizilmediği için bu hiç çağrılmaz.
 */
export function setTensionLevel(level: number): void {
  const clean = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  if (clean === tension) return;
  const wasOn = tension > 0;
  tension = clean;
  if (wasOn !== clean > 0) sync();
  else scheduler?.setIntensity(clean);
}

export { TENSION_START_S };

let installed = false;
/** Bir kez: sinyaller, bağlamın açılması ve sekme görünürlüğü müziği yeniden değerlendirir. */
export function installMusic(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  createRoot(() => {
    createEffect(() => {
      muted();
      musicVolume();
      sync();
    });
  });
  onAudioUnlocked(sync);
  document.addEventListener("visibilitychange", sync);
}
