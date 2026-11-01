import { BUTONA_BAS_COOLDOWN_MS, BUTONA_BAS_WINDOW_MS } from "@glix/engine";
import { createSignal, onCleanup } from "solid-js";
import { hapticPress, hapticTick } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { ArcadeButton } from "./ArcadeButton.js";
import { klakSound, refillSound } from "./sounds.js";
import "./butona.css";

/**
 * BB-U15: anlatımda küçük deneme butonu: basınca halka dalgası, 1 sn dolum halkası ve "KLAK". Puan yok, sunucuya
 * hiçbir şey gitmez; "Hazırım" demeden önce el ısınır.
 */
export default function Trial() {
  const [pressed, setPressed] = createSignal(false);
  const [waves, setWaves] = createSignal<number[]>([]);
  const [fill, setFill] = createSignal<number | null>(null);
  const [ready, setReady] = createSignal<number | undefined>(undefined);
  const [empty, setEmpty] = createSignal<number | undefined>(undefined);
  let n = 0;
  let readyAt = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });
  const press = (): void => {
    unlockAudio();
    const now = performance.now();
    if (now < readyAt) {
      setEmpty(++n);
      return;
    }
    readyAt = now + BUTONA_BAS_COOLDOWN_MS;
    setPressed(true);
    later(() => setPressed(false), 120);
    klakSound();
    hapticPress(10);
    const id = ++n;
    setWaves((w) => [...w.slice(-2), id]);
    later(() => setWaves((w) => w.filter((x) => x !== id)), BUTONA_BAS_WINDOW_MS + 60);
    setFill(id);
    later(() => {
      if (fill() !== id) return;
      setFill(null);
      setReady(++n);
      refillSound();
      hapticTick();
    }, BUTONA_BAS_COOLDOWN_MS);
  };
  return (
    <div class="bbtry">
      <div class="bbtry__btn">
        <ArcadeButton
          pressed={pressed()}
          waves={waves()}
          waveMs={BUTONA_BAS_WINDOW_MS}
          fill={fill()}
          ready={ready()}
          empty={empty()}
          label=""
          ariaLabel="Deneme butonu"
          onDown={(e) => {
            e.preventDefault();
            press();
          }}
          onKey={press}
        />
      </div>
      <span class="bbtry__text">Dene: puan yok</span>
    </div>
  );
}
