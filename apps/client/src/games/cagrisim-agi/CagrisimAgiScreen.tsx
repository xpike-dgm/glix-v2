import type { CagrisimGroup, CagrisimReveal, PlayerInfo } from "@glix/engine";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { hapticMatch, hapticReady, hapticResult, hapticSolo } from "../../fx/haptics.js";
import {
  match as matchSound,
  ready as readySound,
  roundResult,
  solo as soloSound,
  unlockAudio,
} from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import type { GameScreenProps } from "../registry.js";
import "./cagrisim.css";
import { Hub } from "./Hub.js";
import { canSubmit, type MyOutcome, outcomeOf, parseCagrisimView } from "./view.js";

/** Kümeleri ayıran neon renkler (oyuncu renk dizisiyle aynı palet). */
const GROUP_COLORS = [
  "var(--cyan)",
  "var(--magenta)",
  "var(--amber)",
  "var(--lime)",
  "var(--violet)",
  "var(--p6)",
];
const MAX_LENGTH = 60;
/** Ekran klavyesi açıkken görünür alan bu yüksekliğin altına inerse düzen sıkışık kipine geçer. */
const TIGHT_HEIGHT = 440;

const LockIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="3" fill="currentColor" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
  </svg>
);

/**
 * Ekran klavyesi açılınca görünen alan küçülür (Android'de yalnız görsel görünüm, iOS'ta kaydırma da olur).
 * `visualViewport`'u izler; klavye açıkken ekran görünen alana oturtulur, böylece alan ve GÖNDER hep görünür.
 */
function createVisibleArea(): () => { top: number; height: number; keyboard: boolean } {
  const read = () => {
    const vv = window.visualViewport;
    const height = vv?.height ?? window.innerHeight;
    return {
      top: vv?.offsetTop ?? 0,
      height,
      keyboard: window.innerHeight - height > 120,
    };
  };
  const [area, setArea] = createSignal(read());
  onMount(() => {
    const vv = window.visualViewport;
    const update = (): void => {
      setArea(read());
    };
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    onCleanup(() => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    });
  });
  return area;
}

function Cluster(props: {
  group: CagrisimGroup;
  index: number;
  players: PlayerInfo[];
  selfId: string;
  compact: boolean;
  tight: boolean;
}) {
  const color = () => GROUP_COLORS[props.index % GROUP_COLORS.length] ?? "var(--cyan)";
  const members = () =>
    props.group.members
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is PlayerInfo => p !== undefined);
  const size = () =>
    `min(${props.compact ? 40 : 46}px, calc((100vw - 96px) / ${Math.max(2, members().length)}))`;
  return (
    <li
      class="cl"
      style={{ "--gc": color(), "--i": props.index, "--n": members().length }}
      data-me={props.group.members.includes(props.selfId) ? "1" : undefined}
    >
      <div class="cl__top">
        <span class="cl__text">{props.group.text}</span>
        <span class="cl__pts">+{props.group.points}</span>
      </div>
      <div class="cl__row">
        <For each={members()}>
          {(p) => (
            <div class={p.id === props.selfId ? "cl__m cl__me" : "cl__m"}>
              <Avatar index={p.avatar} size={size()} ring={color()} />
            </div>
          )}
        </For>
      </div>
    </li>
  );
}

function Reveal(props: {
  reveal: CagrisimReveal;
  word: string;
  players: PlayerInfo[];
  selfId: string;
  spectator: boolean;
  tight: boolean;
  startedAt: number;
  endsAt: number;
}) {
  const outcome = (): MyOutcome | null => (props.spectator ? null : outcomeOf(props.reveal, props.selfId));
  const player = (id: string) => props.players.find((p) => p.id === id);
  const dimmed = () => props.reveal.singles.length + props.reveal.silent.length;
  const compact = () => props.reveal.groups.length >= 3 || dimmed() >= 3;
  const headline = (): { big: string; small: string; tone: "win" | "none" } | null => {
    const o = outcome();
    if (!o) return null;
    if (o.kind === "group") return { big: `+${o.group.points}`, small: "Ağ kurdun!", tone: "win" };
    if (o.kind === "single") return { big: "0", small: "Bu sefer tek kaldın", tone: "none" };
    return { big: "0", small: "Süre doldu", tone: "none" };
  };
  return (
    <>
      <header class="game__top">
        <ProgressBar startedAt={props.startedAt} endsAt={props.endsAt} now={serverNow} />
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>
      <div class="ca-res__head">
        <Hub word={props.word} mini />
        <Show when={headline()}>
          {(h) => (
            <div class="ca-res__me" data-tone={h().tone}>
              <span class="ca-res__big">{h().big}</span>
              <span class="ca-res__small">{h().small}</span>
            </div>
          )}
        </Show>
      </div>
      <div class="ca-res__list" data-scroll>
        <ul class="cls">
          <For each={props.reveal.groups}>
            {(g, i) => (
              <Cluster
                group={g}
                index={i()}
                players={props.players}
                selfId={props.selfId}
                compact={compact()}
                tight={props.tight}
              />
            )}
          </For>
        </ul>
        <Show when={dimmed() > 0}>
          <ul class="lone" style={{ "--i": props.reveal.groups.length }}>
            <For each={props.reveal.singles}>
              {(s) => (
                <li class="lone__it" data-me={s.playerId === props.selfId ? "1" : undefined}>
                  <Avatar index={player(s.playerId)?.avatar ?? 0} size={32} ring="var(--text-dim)" />
                  <span class="lone__text">{s.text}</span>
                </li>
              )}
            </For>
            <For each={props.reveal.silent}>
              {(id) => (
                <li class="lone__it lone__it--silent" data-me={id === props.selfId ? "1" : undefined}>
                  <Avatar index={player(id)?.avatar ?? 0} size={32} ring="var(--text-dim)" />
                  <span class="lone__text">Yazmadı</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </>
  );
}

export default function CagrisimAgiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseCagrisimView(props.match.publicView, props.match.view));
  const strip = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const area = createVisibleArea();
  const tight = () => area().height < TIGHT_HEIGHT;

  const [text, setText] = createSignal("");
  const [sent, setSent] = createSignal<string | null>(null);
  const [clock, setClock] = createSignal(serverNow());
  const timer = setInterval(() => setClock(serverNow()), 250);
  onCleanup(() => clearInterval(timer));
  let input: HTMLInputElement | undefined;

  const mine = () => view()?.myAnswer ?? sent();
  const locked = () => mine() !== null;
  const over = () => {
    const v = view();
    return !v || clock() >= v.answerEndsAt;
  };

  const submit = (e: Event): void => {
    e.preventDefault();
    const value = text().trim();
    if (props.spectator || locked() || over() || !canSubmit(value)) return;
    unlockAudio();
    if (!sendAction({ kind: "answer", text: value })) return;
    setSent(value);
    input?.blur();
    readySound();
    hapticReady();
  };

  // Açılışa geçince bir kez tepki: ağ kurduysan eşleşme, tek kaldıysan alçak ses.
  createEffect(
    on(
      () => view()?.phase,
      (phase, prev) => {
        if (phase !== "reveal" || prev !== "answer") return;
        untrack(() => {
          const reveal = view()?.reveal;
          const o = reveal && !props.spectator ? outcomeOf(reveal, props.selfId) : null;
          if (o?.kind === "group") {
            matchSound();
            hapticMatch();
          } else if (o) {
            soloSound();
            hapticSolo();
          } else {
            roundResult();
            hapticResult();
          }
        });
      },
    ),
  );

  const answeredCount = () => view()?.answeredIds.length ?? 0;
  const areaStyle = (): JSX.CSSProperties | undefined => {
    const a = area();
    return a.keyboard ? { top: `${a.top}px`, bottom: "auto", height: `${a.height}px` } : undefined;
  };

  return (
    <section class="screen ca" data-tight={tight() ? "1" : undefined} style={areaStyle()}>
      <div class="col">
        <Show
          when={view()}
          fallback={
            <div class="center-stack">
              <span class="loader" aria-hidden="true" />
            </div>
          }
        >
          {(v) => (
            <Show
              when={v().reveal}
              fallback={
                <>
                  <header class="game__top">
                    <ProgressBar
                      startedAt={v().startedAt}
                      endsAt={v().answerEndsAt}
                      now={serverNow}
                      urgency
                    />
                    <div class="game__tools">
                      <SoundToggle />
                    </div>
                  </header>

                  <div class="ca__mid">
                    <Hub word={v().word} />
                  </div>

                  <ul class="ca__crew" aria-label="Cevaplayanlar">
                    <For each={strip()}>
                      {(p) => (
                        <li class="ca__p" data-done={v().answeredIds.includes(p.id) ? "1" : undefined}>
                          <Avatar
                            index={p.avatar}
                            size="min(40px, calc((100vw - 40px - 56px) / 8))"
                            connected={p.connected}
                            ready={v().answeredIds.includes(p.id)}
                            ring={v().answeredIds.includes(p.id) ? "var(--lime)" : undefined}
                          />
                        </li>
                      )}
                    </For>
                  </ul>

                  <div class="ca__foot">
                    <Show
                      when={!locked()}
                      fallback={
                        <div class="lock" role="status">
                          <span class="lock__icon">
                            <LockIcon />
                          </span>
                          <span class="lock__title">Cevabın kilitlendi</span>
                          <span class="lock__answer">{mine()}</span>
                          <span class="lock__wait">
                            {answeredCount() >= strip().length
                              ? "Herkes yazdı"
                              : `Diğerleri bekleniyor · ${answeredCount()}/${strip().length} hazır`}
                          </span>
                        </div>
                      }
                    >
                      <Show
                        when={!props.spectator}
                        fallback={
                          <p class="ca__watch">
                            Cevaplar açılınca görünür · {answeredCount()}/{strip().length} hazır
                          </p>
                        }
                      >
                        <form class="aform" onSubmit={submit} autocomplete="off">
                          <input
                            ref={input}
                            class="field aform__field"
                            type="text"
                            inputmode="text"
                            enterkeyhint="send"
                            autocomplete="off"
                            autocapitalize="none"
                            autocorrect="off"
                            spellcheck={false}
                            maxlength={MAX_LENGTH}
                            placeholder="Aklına ne geliyor?"
                            aria-label="Çağrışımın"
                            disabled={over()}
                            value={text()}
                            onInput={(e) => setText(e.currentTarget.value)}
                          />
                          <PrimaryButton type="submit" disabled={over() || !canSubmit(text())}>
                            Gönder
                          </PrimaryButton>
                        </form>
                      </Show>
                    </Show>
                  </div>
                </>
              }
            >
              {(reveal) => (
                <Reveal
                  reveal={reveal()}
                  word={v().word}
                  players={props.players}
                  selfId={props.selfId}
                  spectator={!!props.spectator}
                  tight={tight()}
                  startedAt={v().answerEndsAt}
                  endsAt={v().endsAt}
                />
              )}
            </Show>
          )}
        </Show>
      </div>
    </section>
  );
}
