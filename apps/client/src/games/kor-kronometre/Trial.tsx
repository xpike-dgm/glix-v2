import { createSignal } from "solid-js";
import { hapticPress } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { Dial } from "./Dial.js";
import { clickSound } from "./sounds.js";
import { formatOffset, formatSeconds } from "./view.js";
import "./kor-kronometre.css";

const TRIAL_MS = 3_000;

/**
 * KR-U14: anlatımda iç saat denemesi: "3 saniye say, bas". "Başla"ya dokun, içinden say, bas; sonuç anında
 * ("3,24 sn · 0,24 geç"). İstediğin kadar tekrar; puan yok, sunucuya hiçbir şey gitmez. Deneme kadranı nabızsızdır
 * (KR-M4). Altında KR-U15 ipucu.
 */
export default function Trial() {
  const [startedAt, setStartedAt] = createSignal<number | null>(null);
  const [result, setResult] = createSignal<number | null>(null);
  const tap = (): void => {
    unlockAudio();
    const s = startedAt();
    if (s === null) {
      setResult(null);
      setStartedAt(performance.now());
      return;
    }
    const ms = performance.now() - s;
    setStartedAt(null);
    setResult(ms);
    clickSound();
    hapticPress(10);
  };
  const label = () => (startedAt() !== null ? "Bas" : result() !== null ? "Yeniden dene" : "Başla");
  return (
    <div class="krotry">
      <div class="krotry__row">
        <span class="krotry__dial">
          <Dial locked={result() !== null && startedAt() === null} />
        </span>
        <div class="krotry__body">
          <span class="krotry__title">3 saniye say, bas</span>
          <span class="krotry__out" role="status">
            {result() !== null
              ? `${formatSeconds(result() ?? 0)} sn · ${formatOffset(result() ?? 0, TRIAL_MS)}`
              : startedAt() !== null
                ? "İçinden say…"
                : "Puan yok; istediğin kadar dene"}
          </span>
        </div>
        <button
          type="button"
          class="krotry__btn"
          data-live={startedAt() !== null ? "1" : undefined}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.preventDefault();
            tap();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            tap();
          }}
        >
          {label()}
        </button>
      </div>
      <span class="krotry__tip">Sesli saymak serbest — yanlış sayıp arkadaşlarını şaşırtmak da.</span>
    </div>
  );
}
