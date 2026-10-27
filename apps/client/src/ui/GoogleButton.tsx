import { hapticTap } from "../fx/haptics.js";
import { tap, unlockAudio } from "../fx/sound.js";
import { startGoogle } from "../net/account.js";

/** Google'ın dört renkli "G" işareti (satır içi; dışarıdan görsel yüklenmez). */
function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.3-4 6.8-9.9 6.8-16.9z"
      />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.6 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/** "Google ile devam et": tarayıcıyı sunucudaki giriş başlangıcına götürür. */
export function GoogleButton(props: { label?: string }) {
  return (
    <button
      type="button"
      class="gglbtn"
      onPointerDown={() => {
        unlockAudio();
        tap();
        hapticTap();
      }}
      onClick={startGoogle}
    >
      <GoogleMark />
      <span>{props.label ?? "Google ile devam et"}</span>
    </button>
  );
}
