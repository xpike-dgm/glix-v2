import { muted, toggleMute, unlockAudio } from "../fx/sound.js";
import { SoundOffIcon, SoundOnIcon } from "./Icons.js";

export function SoundToggle() {
  return (
    <button
      type="button"
      class="icon-btn"
      aria-label={muted() ? "Sesi aç" : "Sesi kapat"}
      aria-pressed={muted()}
      onClick={() => {
        unlockAudio();
        toggleMute();
      }}
    >
      {muted() ? <SoundOffIcon size={22} /> : <SoundOnIcon size={22} />}
    </button>
  );
}
