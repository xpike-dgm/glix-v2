import { createSignal, onCleanup } from "solid-js";

/** Bir CSS medya sorgusunun anlık sonucu (örn. `(orientation: portrait)`). */
export function createMediaQuery(query: string): () => boolean {
  const mq = window.matchMedia(query);
  const [matches, setMatches] = createSignal(mq.matches);
  const on = (e: MediaQueryListEvent): void => {
    setMatches(e.matches);
  };
  mq.addEventListener("change", on);
  onCleanup(() => mq.removeEventListener("change", on));
  return matches;
}

/** Ekran yüksekliği genişliğinden büyük (ya da eşit) mi? Telefon dikeyde. */
export const createPortrait = (): (() => boolean) => createMediaQuery("(orientation: portrait)");

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>;
};

/**
 * Yatay oyun için ekran yönünü kilitlemeyi dener (yalnız yüklü uygulama / tam ekranda çalışır);
 * desteklenmiyorsa ya da reddedilirse sessizce vazgeçer. Dönen işlev kilidi bırakır.
 */
export function lockLandscape(): () => void {
  let locked = false;
  try {
    const o = screen.orientation as LockableOrientation | undefined;
    if (o && typeof o.lock === "function") {
      o.lock("landscape").then(
        () => {
          locked = true;
        },
        () => {},
      );
    }
  } catch {
    // desteklenmiyor
  }
  return () => {
    try {
      if (locked) screen.orientation.unlock();
    } catch {
      // yok sayılır
    }
  };
}
