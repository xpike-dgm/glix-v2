import type { ZehirliKadehPublicView } from "@glix/engine";
import { type Accessor, createEffect, createMemo, on } from "solid-js";
import { hapticMatch, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { tick } from "../../fx/sound.js";
import { cheersSound, cleanSound, poisonSound } from "./sounds.js";
import { hashSeed, revealPlan, revealStart, ZK_REVEAL } from "./view.js";

export interface Opening {
  /** Açılış evresi sürüyor (sonuç görünümü geldi). */
  active: Accessor<boolean>;
  /** Oyuncunun kadehi açıldıysa sonucu; açılmadıysa null. */
  outcome: (id: string) => "clean" | "poison" | null;
  cheers: Accessor<boolean>;
  clink: Accessor<boolean>;
  title: Accessor<string>;
  /** Başlığın tonu: kendi kadehin açıldıysa temiz/zehirli. */
  tone: Accessor<"ok" | "bad" | undefined>;
}

/**
 * "Şerefe!" açılış evresi (oyun ekranının kendisi, tam ekran): önce kadehler kalkar ve tokuşur, sonra rastgele
 * sırayla tek tek açılır; senin kadehin en son. Zaman evrenin başından (süre bitişi, sunucu saati) sayılır:
 * yeniden bağlanınca baştan oynamaz, her cihazda ve TV'de aynı anda ilerler. Hareket azaltmada son hâl hemen görünür.
 */
export function createOpening(
  pub: Accessor<ZehirliKadehPublicView | null>,
  selfId: string,
  spectator: boolean,
  clock: Accessor<number>,
): Opening {
  const active = () => pub()?.ended === true && pub()?.result != null;
  const players = () => pub()?.players ?? [];
  const mine = () => !spectator && players().includes(selfId);
  const plan = createMemo(() => {
    const v = pub();
    const seed = hashSeed(
      `${v?.startedAt ?? 0}|${players().join(",")}|${v?.result?.poisonedCups.join(",") ?? ""}`,
    );
    return revealPlan(players(), mine() ? selfId : "", seed);
  });
  const reduced = reducedMotion();
  const elapsed = (): number => {
    const v = pub();
    if (!v || !active()) return -1;
    return reduced ? Number.POSITIVE_INFINITY : clock() - revealStart(v.endsAt);
  };
  const isClean = (id: string) => pub()?.result?.clean.includes(id) ?? false;
  const opened = (id: string) => active() && elapsed() >= (plan().at[id] ?? 0);
  const outcome = (id: string): "clean" | "poison" | null =>
    opened(id) ? (isClean(id) ? "clean" : "poison") : null;
  const cheers = () => active() && elapsed() < ZK_REVEAL.cheersMs;
  const clink = () => cheers() && elapsed() >= ZK_REVEAL.clinkMs;
  const selfOpen = () => mine() && opened(selfId);
  const done = () => active() && elapsed() >= plan().doneMs;
  const openCount = createMemo(() => plan().order.filter((id) => opened(id)).length);

  // Sesler yalnız canlı geçişte: sonradan açılan (yeniden bağlanan) ekranda geçmiş anlar çalınmaz.
  createEffect(
    on(clink, (lit, before) => {
      if (lit && before === false) cheersSound();
    }),
  );
  createEffect(
    on(openCount, (n, before) => {
      if (before === undefined || n <= before) return;
      const id = plan().order[n - 1];
      if (id === undefined) return;
      if (id === selfId && mine()) {
        if (isClean(id)) {
          cleanSound();
          hapticMatch();
        } else {
          poisonSound();
          hapticSolo();
        }
        return;
      }
      tick();
      if (mine()) hapticTick();
    }),
  );

  const title = (): string => {
    if (cheers()) return "Şerefe!";
    if (selfOpen()) return isClean(selfId) ? "Kadehin temiz!" : "Zehri sen içtin!";
    if (!mine() && done()) return "Kadehler açıldı";
    return "Kadehler açılıyor…";
  };
  const tone = (): "ok" | "bad" | undefined => (selfOpen() ? (isClean(selfId) ? "ok" : "bad") : undefined);
  return { active, outcome, cheers, clink, title, tone };
}
