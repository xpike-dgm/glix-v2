import type { Cosmetics } from "@glix/engine";
import { createEffect, onCleanup, onMount } from "solid-js";
import { hueShiftFor, lookOf } from "../character/look.js";
import type { CharacterStage as Stage, StageSlot } from "../character/stage.js";
import { reducedMotion } from "../fx/motion.js";
import { look } from "./avatars.js";

/** Kürsüdeki bir karakter: `key` yer tutucudaki `data-cslot` ile eşleşir. */
export interface PodiumChar {
  key: string;
  avatar: number;
  cosmetics: Cosmetics | undefined;
  /** "dance": kazanan kendi dansını oynar; "ovation": 2. ve 3. alkış ve selam. */
  act: "dance" | "ovation";
  /** Aynı anda alkışlayan karakterlerin birbirinden ayrışması için (sn). */
  offset?: number;
  /** Bağlantısı kopuk oyuncu: soluk çizilir. */
  dim?: boolean;
}

/**
 * Kürsü karakterlerini çizen tuval katmanı. Üst elemanın (kürsü) içine yerleşir; her karakter, üst elemandaki
 * `data-cslot="<key>"` kutusuna sığar. Pixi ve karakter varlıkları tembel yüklenir: hazır olana kadar yer tutucu
 * avatarlar görünür, hazır olunca üst elemana `data-chars="ready"` yazılır (CSS avatarı karaktere değiştirir).
 * Yüklenemezse hiçbir şey olmaz; ekran avatarlarla çalışmayı sürdürür.
 */
export function CharacterStage(props: { chars: readonly PodiumChar[] }) {
  let host: HTMLDivElement | undefined;
  let stage: Stage | null = null;
  let gone = false;
  let perfTimer: ReturnType<typeof setTimeout> | undefined;
  const reduced = reducedMotion();

  const slots = (): StageSlot[] => {
    const root = host?.parentElement;
    if (!root) return [];
    const anchors = new Map<string, HTMLElement>();
    for (const el of root.querySelectorAll<HTMLElement>("[data-cslot]"))
      anchors.set(el.dataset.cslot ?? "", el);
    const out: StageSlot[] = [];
    for (const c of props.chars) {
      const anchor = anchors.get(c.key);
      if (!anchor) continue;
      const lk = lookOf(c.cosmetics);
      out.push({
        key: c.key,
        anchor,
        layers: lk.layers,
        dim: c.dim === true,
        hue: hueShiftFor(look(c.avatar).color),
        act: reduced
          ? c.act === "dance"
            ? { kind: "still", id: lk.dance, at: 0 }
            : { kind: "still", id: "selam", at: 0 }
          : c.act === "dance"
            ? { kind: "dance", id: lk.dance }
            : { kind: "ovation", offset: c.offset ?? 0 },
      });
    }
    return out;
  };

  onMount(() => {
    const root = host?.parentElement;
    if (!host) return;
    void import("../character/stage.js")
      .then((m) => (host ? m.mountCharacterStage(host, { reduced }) : null))
      .then((s) => {
        if (!s) return;
        if (gone) {
          s.destroy();
          return;
        }
        stage = s;
        stage.update(slots());
        if (root) root.dataset.chars = "ready";
        if (import.meta.env.DEV) {
          (window as { __glixCharacterStage?: Stage }).__glixCharacterStage = s;
          // Geliştirme: kare maliyeti kaydı (hedef: masaüstünde 3 karakterle kare başına 4 ms altı).
          perfTimer = setTimeout(() => {
            const p = s.perf();
            console.info(
              `[karakter] ${p.frames} kare, ort ${p.avgMs.toFixed(2)} ms, en çok ${p.maxMs.toFixed(1)} ms`,
            );
          }, 6000);
        }
      })
      .catch(() => {
        // karakterler yüklenemedi: avatarlar kalır
      });
    onCleanup(() => {
      gone = true;
      clearTimeout(perfTimer);
      stage?.destroy();
      stage = null;
      if (root) delete root.dataset.chars;
      delete (window as { __glixCharacterStage?: Stage }).__glixCharacterStage;
    });
  });

  createEffect(() => {
    // Her sıra/giysi/dans değişiminde (ve kutular yerleştikten sonra) sahne güncellenir.
    props.chars.map((c) => [c.key, c.cosmetics, c.act, c.avatar]);
    stage?.update(slots());
  });

  return <div class="cstage" ref={host} aria-hidden="true" />;
}
