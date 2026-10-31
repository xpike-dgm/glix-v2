import { type Accessor, createEffect, createMemo, For, type JSX, on, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { playConfetti } from "../../fx/confetti.js";
import { hapticFinal, hapticMatch, hapticResult, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fanfare, match as matchSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { CrownIcon } from "../../ui/Icons.js";
import { CrewStrip } from "./Crew.js";
import { CornerTag, RingSign, Spotlights, VsBadge } from "./Stage.js";
import { applauseSound, bellSound, drumSound, gongSound, laughSound } from "./sounds.js";
import { duelPlan, duelVerdict, finalPlan, LAF_REVEAL_PLAN } from "./timeline.js";
import { type CrewMember, type LafScreenView, rankedCards, scoresBefore } from "./view.js";

interface Props {
  view: LafScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  /** Sunucu saati (ms); açılış evrenin başından sayılır, her cihazda ve TV'de aynı anda ilerler. */
  clock: Accessor<number>;
  /** TV: damga ve konfeti tüm ekranı kaplar. */
  tv?: boolean;
}

/** Konfeti: kabın üstünde (TV'de tüm ekranda) kısa Pixi patlaması. */
function useConfetti(): { host: (el: HTMLDivElement) => void; fire: () => void } {
  let el: HTMLDivElement | undefined;
  let stop: (() => void) | undefined;
  onCleanup(() => stop?.());
  return {
    host: (e) => {
      el = e;
    },
    fire: () => {
      if (!el) return;
      void playConfetti(el)
        .then((s) => {
          stop = s;
        })
        .catch(() => undefined);
    },
  };
}

/** Açılış ekranı: düello ya da final. */
export function Reveal(props: Props) {
  return (
    <Show when={props.view.phase === "finalReveal"} fallback={<DuelReveal {...props} />}>
      <FinalReveal {...props} />
    </Show>
  );
}

/** Ortadaki damga ("LAF USTASI!" / "Berabere!"); TV'de tüm ekranı kaplar. */
function Stamp(props: { kind: "master" | "tie"; tv: boolean }) {
  const body = (): JSX.Element => (
    <div class="lf__stamp" data-kind={props.kind} role="status">
      <span>{props.kind === "master" ? "Laf Ustası!" : "Berabere!"}</span>
    </div>
  );
  return (
    <Show when={props.tv} fallback={body()}>
      <Portal>
        <div class="lf-tvstamp" data-kind={props.kind}>
          {body()}
        </div>
      </Portal>
    </Show>
  );
}

/** Kartın üstündeki yazar şeridi (kart dönünce görünür). */
function AuthorRow(props: { member: CrewMember | undefined; self: boolean; points: number | null }) {
  return (
    <div class="lf__author">
      <Show when={props.member}>
        {(m) => <Avatar index={m().avatar} size={28} connected={m().connected} />}
      </Show>
      <span class="lf__who">{props.self ? "Sen" : (props.member?.nickname ?? "?")}</span>
      <Show when={props.points !== null}>
        <span class="lf__pts" data-zero={props.points === 0 ? "1" : undefined}>
          +{props.points}
        </span>
      </Show>
    </div>
  );
}

function DuelReveal(props: Props) {
  const reveal = () => props.view.reveal;
  const cards = () => reveal()?.cards ?? [];
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const plan = createMemo(() =>
    duelPlan(
      cards(),
      props.crew.map((m) => m.id),
    ),
  );
  const verdict = createMemo(() => duelVerdict(cards()));
  const reduced = reducedMotion();
  const elapsed = (): number =>
    reduced ? Number.POSITIVE_INFINITY : props.clock() - props.view.stageStartedAt;
  const flipAt = LAF_REVEAL_PLAN.flipAt;
  const flipped = (i: number): boolean => elapsed() >= (flipAt[i] ?? flipAt[1]);
  const landed = createMemo(() => plan().flights.filter((f) => elapsed() >= f.at));
  const votersOf = (card: string) => landed().filter((f) => f.card === card);
  const decided = () => elapsed() >= plan().verdictAt;
  const stampOn = () => {
    const e = elapsed();
    return e >= plan().stampAt && e < plan().doneAt && !reduced;
  };
  const top = () => Math.max(0, ...cards().map((c) => c.voters.length));
  const winner = (id: string): boolean => {
    const v = verdict();
    const c = cards().find((x) => x.id === id);
    return decided() && (v === "win" || v === "master" || v === "tie") && (c?.voters.length ?? 0) === top();
  };
  const sideWin = (): "a" | "b" | "both" | null => {
    if (!decided()) return null;
    if (verdict() === "tie") return "both";
    const i = cards().findIndex((c) => winner(c.id));
    return i === 0 ? "a" : i === 1 ? "b" : null;
  };
  const shown = (id: string): number => {
    const c = cards().find((x) => x.id === id);
    if (!c) return 0;
    return votersOf(id).length + (c.master && decided() ? 1 : 0);
  };
  const mine = () => cards().find((c) => c.author === props.selfId);
  const fx = useConfetti();

  // Sesler yalnız canlı geçişte: sonradan açılan (yeniden bağlanan) ekranda geçmiş anlar çalınmaz.
  createEffect(
    on(
      () => landed().length,
      (n, before) => {
        if (before === undefined || n <= before) return;
        const f = landed()[n - 1];
        if (!f) return;
        drumSound();
        laughSound(f.nth);
        if (mine()?.id === f.card && !props.spectator) hapticTick();
      },
    ),
  );
  createEffect(
    on(decided, (now, before) => {
      if (!now || before !== false) return;
      const v = verdict();
      const me = mine();
      if (v === "master") {
        gongSound();
        fx.fire();
      } else if (v === "tie") bellSound();
      else if (v === "win") matchSound();
      if (!me || props.spectator) return;
      if (me.master) hapticResult();
      else if (winner(me.id)) hapticMatch();
      else hapticSolo();
    }),
  );

  const line = (): { score: string; says: string } | null => {
    const me = mine();
    if (!me || props.spectator || !decided()) return null;
    const says = me.master
      ? "Laf Ustası sensin!"
      : verdict() === "tie" && me.points > 0
        ? "Berabere!"
        : me.points > 0
          ? "Oy aldın!"
          : "Bu sefer oy gelmedi";
    return { score: `+${me.points}`, says };
  };
  const status = (): string => {
    if (!decided()) return elapsed() >= LAF_REVEAL_PLAN.votesAt ? "Oylar sayılıyor…" : "Yazarlar açılıyor…";
    switch (verdict()) {
      case "master":
        return "Laf Ustası: bütün oylar tek karta!";
      case "tie":
        return "Oylar eşit: berabere!";
      case "none":
        return "Kimse oy vermedi";
      case "empty":
        return "İki taraf da cevap yazmadı";
      default:
        return "Kazanan belli oldu";
    }
  };
  const bumped = () =>
    decided()
      ? cards()
          .filter((c) => c.points > 0)
          .map((c) => c.author)
      : [];

  return (
    <Show when={reveal()}>
      {(r) => (
        <>
          <div class="lf__head lf__head--vote">
            <RingSign label={`Soru ${(props.view.index ?? 0) + 1}/${props.view.total}`} prompt={r().prompt} />
          </div>

          <div class="lf__ring" data-pair="1" data-n={cards().length} data-reveal="1">
            <Spotlights win={sideWin()} />
            <ul class="lf__cards" aria-label="Sonuçlar">
              <For each={cards()}>
                {(c, i) => {
                  const side = (): "a" | "b" => (i() % 2 === 0 ? "a" : "b");
                  const self = () => c.author === props.selfId;
                  const lose = () => decided() && !winner(c.id) && verdict() !== "none";
                  return (
                    <li style={{ "--i": i() }} data-side={side()}>
                      <div
                        class="lf__card lf__card--res"
                        data-side={side()}
                        data-flip={flipped(i()) ? "1" : undefined}
                        data-win={winner(c.id) ? "1" : undefined}
                        data-ko={lose() && verdict() === "master" ? "1" : undefined}
                        data-lose={lose() ? "1" : undefined}
                        data-me={self() ? "1" : undefined}
                        data-empty={c.text === null ? "1" : undefined}
                        style={{ "--ac": look(member(c.author)?.avatar ?? 0).color }}
                      >
                        <CornerTag side={side()} master={c.master && decided()} />
                        <Show when={flipped(i())}>
                          <AuthorRow member={member(c.author)} self={self()} points={shown(c.id)} />
                        </Show>
                        <span class="lf__card-text">{c.text ?? "Cevap yok"}</span>
                        <div class="lf__voters" data-from={side()}>
                          <For each={votersOf(c.id)}>
                            {(f) => {
                              const m = member(f.voter);
                              return m ? (
                                <span class="lf__fly">
                                  <Avatar index={m.avatar} size={26} connected={m.connected} />
                                </span>
                              ) : null;
                            }}
                          </For>
                        </div>
                      </div>
                    </li>
                  );
                }}
              </For>
            </ul>
            <VsBadge />
            <Show when={stampOn() && (verdict() === "master" || verdict() === "tie")}>
              <Stamp kind={verdict() === "master" ? "master" : "tie"} tv={props.tv === true} />
            </Show>
          </div>

          <div class="lf__actions lf__actions--res">
            <Show
              when={line()}
              fallback={
                <p class="lf__status" role="status">
                  {status()}
                </p>
              }
            >
              {(l) => (
                <div class="lf__me" data-zero={l().score === "+0" ? "1" : undefined}>
                  <span class="lf__score">{l().score}</span>
                  <span class="lf__says">{l().says}</span>
                </div>
              )}
            </Show>
          </div>
          <CrewStrip
            crew={props.crew}
            ready={[]}
            scores={decided() ? props.view.scores : scoresBefore(props.view.scores, reveal())}
            bumped={bumped()}
            selfId={props.selfId}
            label="Kahkaha puanları"
          />
          <Show when={props.tv} fallback={<div class="lf__fx confetti" ref={fx.host} aria-hidden="true" />}>
            <Portal>
              <div class="lf-tvfx confetti" ref={fx.host} aria-hidden="true" />
            </Portal>
          </Show>
        </>
      )}
    </Show>
  );
}

function FinalReveal(props: Props) {
  const reveal = () => props.view.reveal;
  const cards = createMemo(() => rankedCards(reveal()?.cards ?? []));
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const plan = createMemo(() => finalPlan(reveal()?.cards ?? []));
  const reduced = reducedMotion();
  const elapsed = (): number =>
    reduced ? Number.POSITIVE_INFINITY : props.clock() - props.view.stageStartedAt;
  const openAt = (id: string): number => plan().opens.find((o) => o.card === id)?.at ?? 0;
  const opened = (id: string): boolean => elapsed() >= openAt(id);
  const openCount = createMemo(() => plan().opens.filter((o) => elapsed() >= o.at).length);
  const crownOn = () => elapsed() >= plan().crownAt;
  const crowned = (id: string): boolean => crownOn() && plan().crowned.includes(id);
  const mine = () => reveal()?.cards.find((c) => c.author === props.selfId);
  const fx = useConfetti();
  const items = new Map<string, HTMLLIElement>();

  createEffect(
    on(openCount, (n, before) => {
      if (before === undefined || n <= before) return;
      const id = plan().opens[n - 1]?.card;
      const c = reveal()?.cards.find((x) => x.id === id);
      if (!c) return;
      drumSound();
      if (c.points > 0) laughSound(c.points);
      if (c.author === props.selfId && !props.spectator) hapticTick();
      // Açılan kart görünür alana kayar (8 kartta liste kayar).
      if (id !== undefined) items.get(id)?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }),
  );
  createEffect(
    on(crownOn, (now, before) => {
      if (!now || before !== false || plan().crowned.length === 0) return;
      applauseSound();
      fanfare();
      fx.fire();
      const first = plan().crowned[0];
      if (first !== undefined) items.get(first)?.scrollIntoView({ block: "nearest", behavior: "auto" });
      const me = mine();
      if (me && !props.spectator && plan().crowned.includes(me.id)) hapticFinal();
    }),
  );

  const line = (): { score: string; says: string } | null => {
    const me = mine();
    if (!me || props.spectator || !opened(me.id)) return null;
    const says = crowned(me.id)
      ? "Gecenin en komiği sensin!"
      : me.points > 0
        ? "Oy topladın!"
        : "Bu sefer oy gelmedi";
    return { score: `+${me.points}`, says };
  };
  const status = (): string => {
    if (!crownOn()) return "Final oyları açılıyor…";
    return plan().crowned.length > 0 ? "Gecenin en komiği belli oldu!" : "Finalde kimse oy almadı";
  };

  return (
    <Show when={reveal()}>
      {(r) => (
        <>
          <div class="lf__head lf__head--vote">
            <RingSign label="Final sonucu" prompt={r().prompt} final />
          </div>
          <div class="lf__ring" data-n={cards().length} data-reveal="1">
            <ul class="lf__cards lf__cards--final" data-scroll="1" aria-label="Final sonuçları">
              <For each={cards()}>
                {(c, i) => {
                  const self = () => c.author === props.selfId;
                  return (
                    <li
                      style={{ "--i": i() }}
                      ref={(el) => {
                        items.set(c.id, el);
                      }}
                    >
                      <div
                        class="lf__card lf__card--res"
                        data-side="f"
                        data-flip={opened(c.id) ? "1" : undefined}
                        data-crown={crowned(c.id) ? "1" : undefined}
                        data-lose={crownOn() && !crowned(c.id) ? "1" : undefined}
                        data-me={self() ? "1" : undefined}
                        style={{ "--ac": look(member(c.author)?.avatar ?? 0).color }}
                      >
                        <Show when={crowned(c.id)}>
                          <span class="lf__crown">
                            <CrownIcon size={16} /> Gecenin en komiği
                          </span>
                        </Show>
                        <Show
                          when={opened(c.id)}
                          fallback={
                            <div class="lf__author" data-hidden="1">
                              <span class="lf__qmark" aria-hidden="true">
                                ?
                              </span>
                              <span class="lf__who">Kimin?</span>
                            </div>
                          }
                        >
                          <AuthorRow member={member(c.author)} self={self()} points={c.points} />
                        </Show>
                        <span class="lf__card-text">{c.text ?? "Cevap yok"}</span>
                        <Show when={opened(c.id) && c.voters.length > 0}>
                          <div class="lf__voters" data-from="f">
                            <For each={c.voters}>
                              {(id) => {
                                const m = member(id);
                                return m ? (
                                  <span class="lf__fly">
                                    <Avatar index={m.avatar} size={24} connected={m.connected} />
                                  </span>
                                ) : null;
                              }}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </li>
                  );
                }}
              </For>
            </ul>
          </div>
          <div class="lf__actions lf__actions--res">
            <Show
              when={line()}
              fallback={
                <p class="lf__status" role="status">
                  {status()}
                </p>
              }
            >
              {(l) => (
                <div class="lf__me" data-zero={l().score === "+0" ? "1" : undefined}>
                  <span class="lf__score">{l().score}</span>
                  <span class="lf__says">{l().says}</span>
                </div>
              )}
            </Show>
          </div>
          <CrewStrip
            crew={props.crew}
            ready={[]}
            scores={crownOn() ? props.view.scores : scoresBefore(props.view.scores, reveal())}
            bumped={crownOn() ? (reveal()?.cards ?? []).filter((c) => c.points > 0).map((c) => c.author) : []}
            selfId={props.selfId}
            label="Kahkaha puanları"
          />
          <Show when={props.tv} fallback={<div class="lf__fx confetti" ref={fx.host} aria-hidden="true" />}>
            <Portal>
              <div class="lf-tvfx confetti" ref={fx.host} aria-hidden="true" />
            </Portal>
          </Show>
        </>
      )}
    </Show>
  );
}
