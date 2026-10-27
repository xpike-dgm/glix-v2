import { createSignal } from "solid-js";
import { type ProfileInfo, parseProfile } from "./profileRules.js";

export type ProfileState =
  | { kind: "loading" }
  | { kind: "ready"; profile: ProfileInfo }
  | { kind: "error"; message: string };

const [profileState, setProfileState] = createSignal<ProfileState>({ kind: "loading" });

export { profileState };

/** Yalnız geliştirme önizlemesi: durum sabitlenir, ağdan okuma yapılmaz. */
let frozen = false;
export function freezeProfile(next: ProfileState): void {
  frozen = true;
  setProfileState(next);
}

/** Aynı anda tek istek; eski bir yanıt yenisinin üstüne yazmaz. */
let seq = 0;

/** Oturumdaki hesabın profilini yükler. Hata olursa Türkçe bir metin gösterilir. */
export async function loadProfile(): Promise<void> {
  if (frozen) return;
  const mine = ++seq;
  setProfileState({ kind: "loading" });
  const done = (s: ProfileState): void => {
    if (mine === seq) setProfileState(s);
  };
  try {
    const res = await fetch("/api/profile", { credentials: "same-origin" });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // gövde okunamadı
    }
    if (res.status === 401) return done({ kind: "error", message: "Profilini görmek için giriş yap." });
    const profile = res.ok ? parseProfile(data) : null;
    if (profile) return done({ kind: "ready", profile });
    done({ kind: "error", message: "Profil şu an yüklenemedi. Biraz sonra tekrar dene." });
  } catch {
    done({ kind: "error", message: "Bağlantı kurulamadı, tekrar dene." });
  }
}
