import type { CagrisimReveal, PlayerInfo } from "@glix/engine";
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
import { hapticError, hapticGo, hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { fail, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import type { GameScreenProps } from "../registry.js";
import "./cagrisim.css";
import { Hub, type OrbitNode } from "./Hub.js";
import { Cluster, createAfter, LoneList, NetworkRing, StampLine } from "./Reveal.js";
import { humSound, reigniteSound, sparkSound, zapSound } from "./sounds.js";
import {
  type CagrisimScreenView,
  canSubmit,
  currentReveal,
  guessGroup,
  headlineOf,
  isLongAnswer,
  lateHint,
  medalOf,
  miniLine,
  outcomeOf,
  parseCagrisimView,
  ringState,
  shortName,
  stampOf,
} from "./view.js";

const MAX_LENGTH = 60;
/** Ekran klavyesi açıkken görünür alan bu yüksekliğin altına inerse düzen sıkışık kipine geçer. */
const TIGHT_HEIGHT = 440;

const LockIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
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
    return { top: vv?.offsetTop ?? 0, height, keyboard: window.innerHeight - height > 120 };
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

/** Seri ilerlemesi (CG-U4): "● ○ ○ Kelime 1/3" ve toplam ağ puanın. */
function Progress(props: { v: CagrisimScreenView; total: number | null }) {
  return (
    <div class="cgprog">
      <span class="cgprog__dots" aria-hidden="true">
        <For each={Array.from({ length: props.v.rounds }, (_, i) => i)}>
          {(i) => (
            <i
              data-on={i <= props.v.round ? "1" : undefined}
              data-now={i === props.v.round ? "1" : undefined}
            />
          )}
        </For>
      </span>
      <span class="cgprog__label">
        Kelime {props.v.round + 1}/{props.v.rounds}
      </span>
      <Show when={props.total !== null}>
        <span class="cgprog__score" title="Toplam ağ puanın">
          Ağ puanın <b>{props.total}</b>
        </span>
      </Show>
    </div>
  );
}

/** Genel skor rozeti (CG-U6): +2 altın, +1 gümüş. */
function Medal(props: { kind: "gold" | "silver" }) {
  return (
    <span class="cgmedal" data-kind={props.kind}>
      <i aria-hidden="true">{props.kind === "gold" ? "1" : "2"}</i>
      {props.kind === "gold" ? "+2" : "+1"}
    </span>
  );
}

/** İzleyicinin denemesinin sonucu (CG-U12). */
function guessText(reveal: CagrisimReveal, guess: string | undefined): string | null {
  if (guess === undefined) return null;
  const g = guessGroup(reveal, guess);
  return g ? `Sen de “${g.text}” ağındaydın` : `“${guess}” ile bu sefer tek kalırdın`;
}

interface StageProps {
  v: CagrisimScreenView;
  reveal: CagrisimReveal;
  players: PlayerInfo[];
  order: string[];
  selfId: string;
  spectator: boolean;
  guess: string | undefined;
  tv: boolean;
}

/** Kelimeler arası 4 sn'lik mini açılış (CG-M2, CG-U4): şerit, kendi sonucun ve kısa ağ kutuları. */
function MiniReveal(props: StageProps) {
  const outcome = () => (props.spectator ? null : outcomeOf(props.reveal, props.selfId));
  const line = () => miniLine(props.reveal);
  const stamp = () => stampOf(props.reveal);
  return (
    <div class="cgmini" data-scroll>
      <div class="cgmini__strip" role="status">
        <span class="cgmini__word">{props.v.word}</span>
        <span class="cgmini__line">{line() ?? "Kimse aynı cevabı vermedi"}</span>
      </div>
      <Show when={outcome()}>
        {(o) => {
          const h = () => headlineOf(o());
          return (
            <p class="cgmini__me" data-tone={h().tone}>
              {h().big}
            </p>
          );
        }}
      </Show>
      <Show when={props.spectator ? guessText(props.reveal, props.guess) : null}>
        {(t) => <p class="cgmini__me cgmini__me--try">{t()}</p>}
      </Show>
      <StampLine stamp={stamp()} players={props.players} selfId={props.selfId} />
      <ul class="cls cls--mini">
        <For each={props.reveal.groups}>
          {(g, i) => (
            <Cluster
              group={g}
              index={i()}
              players={props.players}
              selfId={props.selfId}
              chips={props.tv ? 8 : 4}
            />
          )}
        </For>
      </ul>
      <LoneList reveal={props.reveal} players={props.players} selfId={props.selfId} stamp={stamp()} />
    </div>
  );
}

/** Büyük açılış (CG-U5): önce ağ halkası, sonra okunacak liste ve seri özeti (CG-M2, CG-U6). */
function FinalReveal(props: StageProps & { comment: string | null; scores: (p: PlayerInfo) => number }) {
  const stamp = () => stampOf(props.reveal);
  const after = createAfter(1_400);
  const outcome = () => (props.spectator ? null : outcomeOf(props.reveal, props.selfId));
  const total = () => props.v.totals[props.selfId] ?? 0;
  const medal = () => (props.spectator ? null : medalOf(props.v.awards, props.selfId));
  const crew = () =>
    props.order
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is PlayerInfo => p !== undefined)
      .sort((a, b) => (props.v.totals[b.id] ?? 0) - (props.v.totals[a.id] ?? 0));
  const myIn = (reveal: CagrisimReveal): string => {
    const o = outcomeOf(reveal, props.selfId);
    if (!o) return "";
    return o.kind === "group" ? `sen: ${o.group.points} kişi` : o.kind === "single" ? "sen: tek" : "sen: —";
  };
  return (
    <Show
      when={after.ready()}
      fallback={
        <div class="cgfinal__ring">
          <NetworkRing
            reveal={props.reveal}
            word={props.v.word}
            players={props.players}
            order={props.order}
            selfId={props.selfId}
            startedAt={props.v.answerEndsAt}
            budgetMs={props.v.revealEndsAt - props.v.answerEndsAt}
            stamp={stamp()}
            sound={!props.tv}
            onDone={() => after.arm()}
          />
        </div>
      }
    >
      <div class="cgfinal" data-scroll>
        <Show when={outcome()}>
          {(o) => {
            const h = () => headlineOf(o());
            return (
              <div class="cgfinal__me" data-tone={total() > 0 ? "win" : "none"}>
                <span class="cgfinal__big">Toplam ağ puanın {total()}</span>
                <span class="cgfinal__small">
                  Son kelime: {h().big}
                  <Show when={medal()}>{(m) => <Medal kind={m()} />}</Show>
                </span>
              </div>
            );
          }}
        </Show>
        <Show when={props.spectator ? guessText(props.reveal, props.guess) : null}>
          {(t) => <p class="cgmini__me cgmini__me--try">{t()}</p>}
        </Show>
        <Show when={props.comment}>
          {(c) => (
            <p class="cgcomment">
              <span class="cgcomment__tag">Spiker</span>
              {c()}
            </p>
          )}
        </Show>
        <div class="cgfinal__cols">
          <section class="cgfinal__last" aria-label={`Son kelime ${props.v.word}`}>
            <h3 class="cgfinal__h">{props.v.word}</h3>
            <StampLine stamp={stamp()} players={props.players} selfId={props.selfId} />
            <ul class="cls">
              <For each={props.reveal.groups}>
                {(g, i) => (
                  <Cluster group={g} index={i()} players={props.players} selfId={props.selfId} compact />
                )}
              </For>
            </ul>
            <LoneList reveal={props.reveal} players={props.players} selfId={props.selfId} stamp={stamp()} />
          </section>
          <section class="cgfinal__series" aria-label="Seri özeti">
            <h3 class="cgfinal__h">Üç kelime</h3>
            <ul class="cgseries">
              <For each={props.v.results}>
                {(r) => {
                  const top = () => r.reveal.groups[0];
                  return (
                    <li class="cgseries__row">
                      <span class="cgseries__word">{r.word}</span>
                      <span class="cgseries__net">
                        {top() ? `${top()?.text} · ${top()?.members.length} kişi` : "ağ kurulmadı"}
                      </span>
                      <Show when={!props.spectator}>
                        <span class="cgseries__me">{myIn(r.reveal)}</span>
                      </Show>
                    </li>
                  );
                }}
              </For>
            </ul>
            <ul class="cgtotals">
              <For each={crew()}>
                {(p) => {
                  const m = () => medalOf(props.v.awards, p.id);
                  return (
                    <li class="cgtotals__row" data-me={p.id === props.selfId ? "1" : undefined}>
                      <Avatar index={p.avatar} size={28} connected={p.connected} />
                      <span class="cgtotals__name">{shortName(p.nickname, p.id === props.selfId)}</span>
                      <span class="cgtotals__pts">{props.v.totals[p.id] ?? 0}</span>
                      <span class="cgtotals__medal">
                        <Show when={m()}>{(k) => <Medal kind={k()} />}</Show>
                      </span>
                      <Show when={props.tv}>
                        <span class="cgtotals__score">{props.scores(p)}</span>
                      </Show>
                    </li>
                  );
                }}
              </For>
            </ul>
          </section>
        </div>
      </div>
    </Show>
  );
}

/** `tv`: büyük ekran (StageView, CG-U11) yerleşimi; kişisel bilgi hiç yoktur. */
export default function CagrisimAgiScreen(props: GameScreenProps & { tv?: boolean }) {
  const tv = () => props.tv === true;
  const view = createMemo(() => parseCagrisimView(props.match.publicView, props.match.view));
  const order = () => props.match.participants;
  const strip = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const spectator = () => props.spectator === true || tv();
  const area = createVisibleArea();
  const tight = () => !tv() && area().height < TIGHT_HEIGHT;

  const [text, setText] = createSignal("");
  /** Gönderilen cevap (kelime sırası ile); sunucu reddederse geri açılır. */
  const [sent, setSent] = createSignal<{ round: number; text: string } | null>(null);
  /** İzleyicinin "Sen de dene" cevapları (kelime sırası -> metin); yalnız bu ekranda. */
  const [guesses, setGuesses] = createSignal<Record<number, string>>({});
  const [clock, setClock] = createSignal(serverNow());
  const timer = setInterval(() => setClock(serverNow()), 250);
  onCleanup(() => clearInterval(timer));
  let input: HTMLInputElement | undefined;

  const round = () => view()?.round ?? 0;
  const mine = (): string | null => {
    const v = view();
    if (!v) return null;
    if (v.myAnswer !== null) return v.myAnswer;
    const s = sent();
    return s && s.round === v.round ? s.text : null;
  };
  const guess = () => guesses()[round()];
  const locked = () => (spectator() ? guess() !== undefined : mine() !== null);
  const over = () => {
    const v = view();
    return !v || v.phase !== "answer" || clock() >= v.answerEndsAt;
  };
  const remaining = () => {
    const v = view();
    return v ? v.answerEndsAt - clock() : 0;
  };
  const hint = () => (tv() || over() ? null : lateHint(text(), remaining(), locked()));

  // Yeni kelime: alan temizlenir, küre bir an söner (CG-U4).
  const [dim, setDim] = createSignal(false);
  createEffect(
    on(round, (r, prev) => {
      if (prev === undefined || r === prev) return;
      setText("");
      setDim(true);
      if (!tv()) reigniteSound();
      const t = setTimeout(() => setDim(false), 420);
      onCleanup(() => clearTimeout(t));
    }),
  );

  const submit = (e: Event): void => {
    e.preventDefault();
    const value = text().trim();
    if (tv() || locked() || over() || !canSubmit(value)) return;
    unlockAudio();
    input?.blur();
    zapSound();
    hapticTap();
    if (spectator()) {
      // İzleyici denemesi sunucuya gitmez, hazır sayısına girmez (CG-U12).
      setGuesses({ ...guesses(), [round()]: value });
      return;
    }
    const r = round();
    setSent({ round: r, text: value });
    void sendActionAck({ kind: "answer", text: value }).then((ack) => {
      if (ack.ok || ack.reason === "timeout") return;
      if (sent()?.round === r) setSent(null);
      fail();
      hapticError();
    });
  };

  // Başkası gönderince çok hafif çıtırtı (yalnız ses; CG-U13).
  createEffect(
    on(
      () => view()?.answeredIds.length ?? 0,
      (n, prev) => {
        if (tv() || prev === undefined || n <= prev) return;
        const ids = untrack(() => view()?.answeredIds ?? []);
        if (ids[ids.length - 1] !== props.selfId) sparkSound();
      },
    ),
  );
  // Son 5 sn: küre uğultusu (saniyede bir) ve boş alan uyarısında tek titreşim (CG-U13, CG-U15).
  createEffect(
    on(
      () => {
        const v = view();
        return v && v.phase === "answer" ? ringState(clock(), v.roundStartedAt, v.answerEndsAt) : null;
      },
      (r, prev) => {
        if (!r || tv() || !r.urgent || r.secs === prev?.secs) return;
        humSound(r.secs);
      },
    ),
  );
  createEffect(
    on(hint, (h, prev) => {
      if (h !== null && prev === null) hapticGo();
    }),
  );
  // Açılışta kendi sonucun: ağ kurduysan iki kısa, tek kaldıysan tek uzun yumuşak titreşim (CG-U13).
  createEffect(
    on(
      () => view()?.phase,
      (phase, prev) => {
        if (phase === undefined || phase === "answer" || prev !== "answer" || spectator()) return;
        untrack(() => {
          const v = view();
          const reveal = v ? currentReveal(v) : null;
          const o = reveal ? outcomeOf(reveal, props.selfId) : null;
          if (o?.kind === "group") hapticMatch();
          else if (o) hapticSolo();
        });
      },
    ),
  );

  const nodes = (): OrbitNode[] => {
    const v = view();
    if (!v) return [];
    return v.answeredIds.flatMap((id) => {
      const p = props.players.find((x) => x.id === id);
      const slot = order().indexOf(id);
      return p && slot >= 0 ? [{ id, color: look(p.avatar).color, slot }] : [];
    });
  };
  const answeredCount = () => view()?.answeredIds.length ?? 0;
  const areaStyle = (): JSX.CSSProperties | undefined => {
    const a = area();
    return !tv() && a.keyboard ? { top: `${a.top}px`, bottom: "auto", height: `${a.height}px` } : undefined;
  };
  const myTotal = () => (spectator() ? null : (view()?.totals[props.selfId] ?? 0));

  return (
    <section
      class="screen ca"
      data-tight={tight() ? "1" : undefined}
      data-kb={!tv() && area().keyboard ? "1" : undefined}
      data-tv={tv() ? "1" : undefined}
      data-phase={view()?.phase}
      style={areaStyle()}
    >
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
            <>
              <Show when={v().phase === "answer"}>
                <PhaseClock startedAt={v().roundStartedAt} endsAt={v().answerEndsAt} urgency />
              </Show>
              <Show when={v().phase === "mini"}>
                <PhaseClock startedAt={v().answerEndsAt} endsAt={v().revealEndsAt} />
              </Show>
              <Show when={v().phase !== "final"}>
                <Progress v={v()} total={myTotal()} />
              </Show>
              <Show when={v().phase === "answer"}>
                <div class="cgans">
                  <div class="ca__mid">
                    <Hub
                      word={v().word}
                      timer={{ startedAt: v().roundStartedAt, endsAt: v().answerEndsAt }}
                      nodes={nodes()}
                      slots={order().length}
                      dim={dim()}
                    />
                  </div>
                  <div class="cgans__side">
                    <p class="cgans__goal">Çoğunluk ne yazar? Aynısını yazanlarla ağ kur.</p>
                    <ul class="ca__crew" aria-label="Cevaplayanlar">
                      <For each={strip()}>
                        {(p) => (
                          <li class="ca__p" data-done={v().answeredIds.includes(p.id) ? "1" : undefined}>
                            <Avatar
                              index={p.avatar}
                              size={tv() ? 64 : "min(40px, calc((100vw - 40px - 56px) / 8))"}
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
                        when={!tv()}
                        fallback={
                          <p class="ca__watch">
                            Cevaplar açılınca görünür · {answeredCount()}/{strip().length} hazır
                          </p>
                        }
                      >
                        <Show
                          when={!locked()}
                          fallback={
                            <div class="lock" role="status">
                              <span class="lock__icon">
                                <LockIcon />
                              </span>
                              <span class="lock__answer">{spectator() ? guess() : mine()}</span>
                              <span class="lock__wait">
                                {spectator()
                                  ? "Sen de denedin (sayılmaz)"
                                  : answeredCount() >= strip().length
                                    ? "Herkes yazdı"
                                    : `${answeredCount()}/${strip().length} hazır`}
                              </span>
                            </div>
                          }
                        >
                          <form
                            class="aform"
                            onSubmit={submit}
                            autocomplete="off"
                            data-hint={hint() ?? undefined}
                          >
                            <Show when={spectator()}>
                              <p class="cgans__try">
                                Sen de dene (sayılmaz) · {answeredCount()}/{strip().length} hazır
                              </p>
                            </Show>
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
                              placeholder="Herkesin aklına ilk ne gelir?"
                              aria-label="Çağrışımın"
                              disabled={over()}
                              value={text()}
                              onInput={(e) => setText(e.currentTarget.value)}
                            />
                            <Show when={hint()}>
                              {(h) => (
                                <p class="cgans__late" role="status">
                                  {h() === "empty"
                                    ? "Bir şey yaz, ağa katılma şansın var!"
                                    : "Gönder'e basmayı unutma!"}
                                </p>
                              )}
                            </Show>
                            <Show when={!hint() && isLongAnswer(text())}>
                              <p class="cgans__long">Kısa cevaplar daha kolay eşleşir.</p>
                            </Show>
                            <PrimaryButton type="submit" disabled={over() || !canSubmit(text())}>
                              Gönder
                            </PrimaryButton>
                          </form>
                        </Show>
                      </Show>
                    </div>
                  </div>
                </div>
              </Show>
              <Show when={v().phase === "mini" ? currentReveal(v()) : null}>
                {(reveal) => (
                  <MiniReveal
                    v={v()}
                    reveal={reveal()}
                    players={props.players}
                    order={order()}
                    selfId={props.selfId}
                    spectator={spectator()}
                    guess={guess()}
                    tv={tv()}
                  />
                )}
              </Show>
              <Show when={v().phase === "final" ? currentReveal(v()) : null}>
                {(reveal) => (
                  <FinalReveal
                    v={v()}
                    reveal={reveal()}
                    players={props.players}
                    order={order()}
                    selfId={props.selfId}
                    spectator={spectator()}
                    guess={guess()}
                    tv={tv()}
                    comment={props.match.comment ?? null}
                    scores={(p) => p.score}
                  />
                )}
              </Show>
            </>
          )}
        </Show>
        <Show when={!tv()}>
          <RevealContinue
            match={props.match}
            selfId={props.selfId}
            now={props.now}
            spectator={props.spectator}
          />
        </Show>
      </div>
    </section>
  );
}
