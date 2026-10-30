import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { tick } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import { Cup } from "./Cup.js";
import { SwapHistory } from "./SwapHistory.js";
import { cheersSound, cleanSound, poisonSound } from "./sounds.js";
import "./zehirli-kadeh.css";
import { hashSeed, parseZehirliKadehPublicView, revealPlan, ZK_REVEAL } from "./view.js";

/**
 * "Şerefe!" sonuç açılışı: önce bütün kadehler kalkar ve tokuşur, sonra rastgele sırayla tek tek açılır (zehirli:
 * avatar yeşile döner, mor duman, "0"; temiz: altın parıltı, "+1"). Senin kadehin en son açılır. Zaman sonuç
 * aşamasının başından sayılır: yeniden bağlanınca açılış baştan oynamaz, her cihazda aynı anda ilerler.
 * Bitiş zamanlaması sonuç ekranınındır; bu açılış yalnız `ZK_REVEAL` çizelgesine göre oynar.
 */
export default function Reveal(props: GameScreenProps) {
  const pub = createMemo(() => parseZehirliKadehPublicView(props.match.publicView));
  const result = () => pub()?.result ?? null;
  const person = (id: string) => props.players.find((p) => p.id === id);
  const players = () => pub()?.players ?? [];
  const mine = () => players().includes(props.selfId);
  const isClean = (id: string) => result()?.clean.includes(id) ?? false;
  const nameOf = (id: string): string =>
    id === props.selfId && mine() ? "Sen" : (person(id)?.nickname ?? "Oyuncu");

  const plan = createMemo(() => {
    const v = pub();
    const seed = hashSeed(
      `${v?.startedAt ?? 0}|${players().join(",")}|${v?.result?.poisonedCups.join(",") ?? ""}`,
    );
    return revealPlan(players(), props.selfId, seed);
  });

  const reduced = reducedMotion();
  const elapsedNow = (): number =>
    reduced ? Number.POSITIVE_INFINITY : props.now() - props.match.phaseStartedAt;
  const [elapsed, setElapsed] = createSignal(elapsedNow());
  const timer = setInterval(() => {
    const e = elapsedNow();
    setElapsed(e);
    if (e > plan().doneMs + 500) clearInterval(timer);
  }, 100);
  onCleanup(() => clearInterval(timer));

  const opened = (id: string) => elapsed() >= (plan().at[id] ?? 0);
  const cheering = () => elapsed() < ZK_REVEAL.cheersMs;
  const openCount = createMemo(() => plan().order.filter((id) => opened(id)).length);
  const selfOpen = () => mine() && opened(props.selfId);
  const done = () => elapsed() >= plan().doneMs;

  // Sesler yalnız canlı geçişte: sonradan açılan (yeniden bağlanan) ekranda geçmiş anlar çalınmaz.
  createEffect(
    on(
      () => elapsed() >= ZK_REVEAL.clinkMs,
      (clinked, before) => {
        if (clinked && before === false) cheersSound();
      },
    ),
  );
  createEffect(
    on(openCount, (n, before) => {
      if (before === undefined || n <= before) return;
      const id = plan().order[n - 1];
      if (id === undefined) return;
      if (id === props.selfId && mine()) {
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
    if (cheering()) return "Şerefe!";
    if (selfOpen()) return isClean(props.selfId) ? "Kadehin temiz!" : "Zehri sen içtin!";
    if (!mine() && done()) return "Kadehler açıldı";
    return "Kadehler açılıyor…";
  };

  return (
    <Show when={pub() && result()}>
      <section class="zkr" aria-label="Zehirli Kadeh sonucu">
        <h2
          class="zkr__head"
          data-ok={selfOpen() && isClean(props.selfId) ? "1" : undefined}
          data-bad={selfOpen() && !isClean(props.selfId) ? "1" : undefined}
          data-cheers={cheering() ? "1" : undefined}
        >
          {title()}
        </h2>
        <div class="zkr__table" data-cheers={cheering() ? "1" : undefined}>
          <i
            class="zkr__clink"
            aria-hidden="true"
            data-on={cheering() && elapsed() >= ZK_REVEAL.clinkMs ? "1" : undefined}
          />
          <ul class="zkr__row" style={{ "--n": players().length }}>
            <For each={players()}>
              {(id, i) => {
                const open = () => opened(id);
                const clean = () => isClean(id);
                return (
                  <li
                    class="zkr__item"
                    data-open={open() ? "1" : undefined}
                    data-ok={open() && clean() ? "1" : undefined}
                    data-bad={open() && !clean() ? "1" : undefined}
                    data-me={id === props.selfId && mine() ? "1" : undefined}
                    style={{ "--i": i(), "--side": i() - (players().length - 1) / 2 }}
                  >
                    <span class="zkr__av">
                      <Show when={person(id)}>
                        {(p) => <Avatar index={p().avatar} size="var(--zkr-av)" connected={p().connected} />}
                      </Show>
                    </span>
                    <span class="zkr__lift">
                      <Cup
                        cup={pub()?.holdings[id] ?? 0}
                        mode={open() ? (clean() ? "clean" : "poison") : "unknown"}
                        class="zkr__cup"
                      />
                    </span>
                    <span class="zkr__pts" aria-hidden={!open()}>
                      {open() ? (clean() ? "+1" : "0") : ""}
                    </span>
                    <span class="zkr__name">{nameOf(id)}</span>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
        <SwapHistory swaps={pub()?.swaps ?? []} nameOf={nameOf} />
      </section>
    </Show>
  );
}
