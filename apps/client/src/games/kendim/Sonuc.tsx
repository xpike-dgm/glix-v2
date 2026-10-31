import type { KendimReveal, KendimRevealCard } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { atServerTime } from "../../net/serverTimer.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { kendimArtUrl } from "./art.js";
import type { Crew } from "./KendimScreen.js";
import { bonusFanfare, cardWhoosh, drumRoll, rightDing } from "./sounds.js";
import { activeSlot, type CardSlot, revealOrder, revealTimeline } from "./timeline.js";
import { awardLabel, choiceOf, guessesFor, outcomeOf, runningScores, wordLen } from "./view.js";
import { TopicLine } from "./Yazma.js";

interface Props {
  reveal: KendimReveal;
  /** Açılışın başladığı an (sunucu saati; eşleştirmenin bittiği an). */
  startAt: number;
  topic: string;
  crew: Crew[];
  selfId: string;
  now: () => number;
  spectator: boolean;
  tv?: boolean;
}

/** Geç açılan ekranda geçmiş anların sesi çalınmaz. */
const LATE_SOUND_MS = 350;

/**
 * Kart kart açılış (KN-U4) ve özet (KN-U5). Her kart 3 sn: kart büyür ve kelime okunur → kimin kimi tahmin ettiği →
 * kart döner, sahibi açılır, doğru bilenler ✓ ile zıplar → tek bulan şeridi. Senin kartın en son: "Seni kim
 * tanıdı?". Zamanlar sunucu saatine bağlıdır (timeline.ts); geç açılan ekran olduğu yerden devam eder.
 */
export function Sonuc(props: Props) {
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const order = createMemo(() => revealOrder(props.reveal.order, props.reveal.cards, props.selfId));
  const tl = createMemo(() => revealTimeline(order()));
  const [t, setT] = createSignal(props.now() - props.startAt);
  const cardById = (id: number) => props.reveal.cards.find((c) => c.id === id);
  const players = () => props.crew.map((m) => m.id);
  const mineCard = () => props.reveal.cards.find((c) => c.owner === props.selfId);
  const mine = () => outcomeOf(props.reveal, props.selfId);
  const isPlayer = () => !props.spectator && players().includes(props.selfId);

  const cancels: (() => void)[] = [];
  onCleanup(() => {
    for (const c of cancels) c();
  });
  onMount(() => {
    const at = (ms: number, fx?: () => void): void => {
      cancels.push(
        atServerTime(
          props.startAt + ms,
          () => {
            setT((v) => Math.max(v, ms));
            if (fx && props.now() - (props.startAt + ms) < LATE_SOUND_MS) fx();
          },
          props.now,
        ),
      );
    };
    for (const slot of tl().slots) {
      const card = cardById(slot.card);
      const own = card?.owner === props.selfId;
      at(slot.startAt, own && !props.tv ? drumRoll : hapticTap);
      at(slot.guessesAt);
      at(slot.flipAt, () => {
        cardWhoosh();
        if (!isPlayer() || !card) return;
        const my = choiceOf(props.reveal, props.selfId, card.id);
        if (my?.ok || (own && card.finders.length > 0)) {
          rightDing();
          hapticMatch();
        }
      });
      at(slot.bonusAt, card?.bonus ? bonusFanfare : undefined);
    }
    at(tl().summaryAt, () => {
      if (!isPlayer()) return;
      if (mine().total > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    });
    at(tl().endAt);
  });

  const current = () => activeSlot(tl(), t());
  const slot = () => tl().slots[current()];
  const flipped = () =>
    tl()
      .slots.filter((s) => t() >= s.flipAt)
      .map((s) => s.card);
  const bonused = () =>
    tl()
      .slots.filter((s) => t() >= s.bonusAt)
      .map((s) => s.card);
  const live = createMemo(() => runningScores(props.reveal, flipped(), bonused()));

  return (
    <div class="knr" data-tv={props.tv ? "1" : undefined}>
      <Show
        when={current() >= 0 ? slot() : null}
        fallback={
          <Summary {...props} order={order()} member={member} mineCard={mineCard()} isPlayer={isPlayer()} />
        }
      >
        {(s) => (
          <div class="knr__run">
            <div class="knr__main">
              <div class="kn__head kn__head--rev">
                <TopicLine topic={props.topic} size="small" />
                <span
                  class="kn__title"
                  data-me={cardById(s().card)?.owner === props.selfId ? "1" : undefined}
                >
                  {cardById(s().card)?.owner === props.selfId && isPlayer()
                    ? "Seni kim tanıdı?"
                    : `Kart ${current() + 1}/${order().length}`}
                </span>
              </div>
              <Show when={cardById(s().card)} keyed>
                {(card) => (
                  <CardStage
                    card={card}
                    slot={s()}
                    t={t()}
                    reveal={props.reveal}
                    players={players()}
                    member={member}
                    selfId={props.selfId}
                    tv={props.tv === true}
                  />
                )}
              </Show>
              <ol class="knr__dots" aria-hidden="true">
                <For each={order()}>
                  {(_, i) => <li data-on={i() === current() ? "1" : i() < current() ? "done" : undefined} />}
                </For>
              </ol>
            </div>
            <Show when={props.tv}>
              <LiveBoard crew={props.crew} points={live()} />
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}

interface StageProps {
  card: KendimRevealCard;
  slot: CardSlot;
  t: number;
  reveal: KendimReveal;
  players: string[];
  member: (id: string) => Crew | undefined;
  selfId: string;
  tv: boolean;
}

/** Tek kartın açılışı: kelime → tahminler → sahibi → tek bulan şeridi. */
function CardStage(props: StageProps) {
  const back = kendimArtUrl("kart-arka");
  const owner = () => props.member(props.card.owner);
  const groups = () => guessesFor(props.reveal, props.card.id, props.players);
  const shown = () => props.t >= props.slot.guessesAt;
  const open = () => props.t >= props.slot.flipAt;
  const bonus = () => props.card.bonus && props.t >= props.slot.bonusAt;
  const finder = () => props.member(props.card.finders[0] ?? "");
  return (
    <div class="knr__stage">
      <div class="knr__card" data-open={open() ? "1" : undefined}>
        <Show when={props.card.twin}>
          <span class="knr__twin">İkiz kelime!</span>
        </Show>
        <span class="knr__card-in">
          <span class="knr__face knr__front">
            <span
              class="knr__word"
              data-long={wordLen(props.card.text) > 7 ? "1" : undefined}
              style={{ "--len": wordLen(props.card.text) }}
            >
              {props.card.text}
            </span>
          </span>
          <span
            class="knr__face knr__back"
            data-art={back ? "1" : undefined}
            style={back ? { "background-image": `url(${back})` } : undefined}
          >
            <span class="knr__back-word">{props.card.text}</span>
            <Avatar index={owner()?.avatar ?? 0} size="var(--knr-oav)" ring="var(--amber)" />
            <span class="knr__owner">{owner()?.nickname ?? "?"}</span>
          </span>
        </span>
      </div>

      <ul class="knr__guesses" data-on={shown() ? "1" : undefined} data-open={open() ? "1" : undefined}>
        <For
          each={groups()}
          fallback={<li class="knr__none">{open() ? "Kimse tahmin etmedi" : "Tahminler…"}</li>}
        >
          {(g, i) => (
            <li class="knr__guess" data-ok={open() ? (g.ok ? "1" : "0") : undefined} style={{ "--i": i() }}>
              <span class="knr__target">
                <Avatar index={props.member(g.target)?.avatar ?? 0} size={props.tv ? 48 : 34} />
                <span class="knr__tname">{props.member(g.target)?.nickname ?? "?"}</span>
              </span>
              <span class="knr__by">
                <span class="knr__said">
                  {g.by.includes(props.selfId)
                    ? g.by.length === 1
                      ? "Sen"
                      : `Sen + ${g.by.length - 1} kişi`
                    : `${g.by.length} kişi`}
                </span>
                <span class="knr__faces">
                  <For each={g.by}>
                    {(id, k) => (
                      <span class="knr__voter" style={{ "--k": k() }}>
                        <Avatar index={props.member(id)?.avatar ?? 0} size={props.tv ? 34 : 24} />
                      </span>
                    )}
                  </For>
                </span>
              </span>
              <Show when={open()}>
                <CbState kind={g.ok ? "ok" : "bad"} size={14} class="knr__mark" always />
              </Show>
            </li>
          )}
        </For>
      </ul>

      <p class="knr__bonus" data-on={bonus() ? "1" : undefined} aria-hidden={bonus() ? undefined : "true"}>
        <span class="knr__bonus-tag">TEK BULAN</span>
        <span class="knr__bonus-text">
          {finder()?.nickname ?? "?"} · {owner()?.nickname ?? "?"} +1
        </span>
      </p>
    </div>
  );
}

/** TV: sağda oyuncular ve canlı artan tanıma puanları. */
function LiveBoard(props: { crew: Crew[]; points: Record<string, number> }) {
  const sorted = () => [...props.crew].sort((a, b) => (props.points[b.id] ?? 0) - (props.points[a.id] ?? 0));
  return (
    <ul class="knr__live">
      <For each={sorted()}>
        {(m) => (
          <li class="knr__live-row">
            <Avatar index={m.avatar} size={44} connected={m.connected} />
            <span class="knr__live-name">{m.nickname}</span>
            <span class="knr__live-pts">{props.points[m.id] ?? 0}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

interface SummaryProps extends Props {
  order: number[];
  member: (id: string) => Crew | undefined;
  mineCard: KendimRevealCard | undefined;
  isPlayer: boolean;
}

/** Özet (KN-U5): tanıma puanı ve genel ödül ayrı; her kartta senin seçimin; sıralı liste. */
function Summary(props: SummaryProps) {
  const mine = () => outcomeOf(props.reveal, props.selfId);
  const ranking = () =>
    [...props.crew].sort((a, b) => (props.reveal.scores[b.id] ?? 0) - (props.reveal.scores[a.id] ?? 0));
  const cards = () => props.order.flatMap((id) => props.reveal.cards.filter((c) => c.id === id));
  const verdict = (): string => {
    const o = mine();
    const found = props.mineCard?.finders.length ?? 0;
    if (o.right + o.wrong === 0) return found > 0 ? "Eşleme yapmadın ama seni tanıdılar" : "Eşleme yapmadın";
    if (o.wrong === 0) return o.right === 1 ? "Doğru bildin!" : `${o.right} doğru, hiç yanlış yok!`;
    return `${o.right} doğru, ${o.wrong} yanlış`;
  };
  return (
    <div class="kns" data-n={props.crew.length}>
      <div class="kn__head kn__head--res">
        <Show
          when={props.isPlayer}
          fallback={
            <>
              <TopicLine topic={props.topic} size="small" />
              <span class="kn__title">Kartlar açıldı</span>
            </>
          }
        >
          <TopicLine topic={props.topic} size="small" />
          <span class="kns__me">
            <span class="kns__score" data-zero={mine().total === 0 ? "1" : undefined}>
              <b>{mine().total}</b>
              <small>tanıma puanı</small>
            </span>
            <span class="kns__award" data-v={mine().award}>
              {awardLabel(mine().award)}
            </span>
          </span>
          <span class="kn__verdict">{verdict()}</span>
        </Show>
      </div>

      <ul class="kns__cards" data-count={cards().length}>
        <For each={cards()}>
          {(card, i) => {
            const owner = () => props.member(card.owner);
            const my = () => choiceOf(props.reveal, props.selfId, card.id);
            const own = () => card.owner === props.selfId && props.isPlayer;
            return (
              <li
                class="kns__card"
                data-me={own() ? "1" : undefined}
                data-mine={my() ? (my()?.ok ? "ok" : "bad") : undefined}
                style={{ "--i": i() }}
              >
                <span class="kns__top">
                  <span
                    class="kns__word"
                    data-long={wordLen(card.text) > 7 ? "1" : undefined}
                    style={{ "--len": wordLen(card.text) }}
                  >
                    {card.text}
                  </span>
                  <Show when={card.bonus}>
                    <span class="kns__bonus">+1</span>
                  </Show>
                </span>
                <span class="kns__owner">
                  <Avatar index={owner()?.avatar ?? 0} size={props.tv ? 32 : 22} />
                  <span class="kns__oname">{own() ? "Senin kelimen" : (owner()?.nickname ?? "?")}</span>
                </span>
                <Show when={props.isPlayer}>
                  <span class="kns__line">
                    <Show
                      when={!own()}
                      fallback={
                        card.finders.length > 0
                          ? `Seni bulan: ${card.finders.map((id) => props.member(id)?.nickname ?? "?").join(", ")}`
                          : "Kimse bulamadı"
                      }
                    >
                      <Show when={my()} fallback={<span class="kns__dim">Boş bıraktın</span>}>
                        {(p) => (
                          <>
                            Sen: {props.member(p().target)?.nickname ?? "?"}{" "}
                            <CbState kind={p().ok ? "ok" : "bad"} size={12} class="kns__mark" always />
                            <Show when={!p().ok}>
                              <span class="kns__dim"> · Sahibi: {owner()?.nickname ?? "?"}</span>
                            </Show>
                          </>
                        )}
                      </Show>
                    </Show>
                  </span>
                </Show>
              </li>
            );
          }}
        </For>
      </ul>

      <ul class="kns__rank">
        <For each={ranking()}>
          {(m, i) => {
            const total = () => props.reveal.scores[m.id] ?? 0;
            const award = () => props.reveal.awards[m.id] ?? 0;
            return (
              <li class="kns__row" data-me={m.id === props.selfId ? "1" : undefined} style={{ "--i": i() }}>
                <Avatar index={m.avatar} size={props.tv ? 40 : 28} connected={m.connected} />
                <span class="kns__name">{m.nickname}</span>
                <Show when={award() > 0}>
                  <span class="kns__medal" data-v={award()}>
                    +{award()}
                  </span>
                </Show>
                <span class="kns__pts" data-zero={total() === 0 ? "1" : undefined}>
                  {total()}
                </span>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
}
