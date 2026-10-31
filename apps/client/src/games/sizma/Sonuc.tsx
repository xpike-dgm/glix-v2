import { SIZMA_GUESS_MAX } from "@glix/engine";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { match as matchSound, solo as soloSound, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { atServerTime } from "../../net/serverTimer.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { BigMask, Mask } from "./Mask.js";
import { applause, crack, giggle, gong, miss, tok } from "./sounds.js";
import { FINAL, flightAt, OPENING } from "./timeline.js";
import {
  type CrewMember,
  flightPlan,
  outcomeOf,
  reasonLine,
  type SizmaScreenView,
  scoreLine,
} from "./view.js";

interface Props {
  view: SizmaScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  /** Spiker yorumu (yapay zekâ); yoksa ya da boşsa hiç görünmez. */
  comment: () => string | null;
  tv?: boolean | undefined;
}

/** `target` sunucu anında bir kez çalar; ekrana bu andan sonra gelindiyse (yeniden bağlanma) çalmaz. */
function cue(target: () => number | null, now: () => number, fn: () => void): void {
  createEffect(() => {
    const t = target();
    if (t === null || untrack(now) > t + 250) return;
    onCleanup(atServerTime(t, fn, now));
  });
}

export function Sonuc(props: Props) {
  const r = () => props.view.reveal as NonNullable<SizmaScreenView["reveal"]>;
  const member = (id: string) => props.crew.find((m) => m.id === id) ?? null;
  const name = (id: string) => member(id)?.nickname ?? "?";
  const odd = () => member(r().infiltrator);
  const iAmOdd = () => !props.spectator && r().infiltrator === props.selfId;
  const still = () => reducedMotion();
  const elapsed = () => props.now() - r().openedAt;
  const at = (ms: number) => still() || elapsed() >= ms;
  const finalElapsed = () => props.now() - r().finalAt;
  const atFinal = (ms: number) => r().final !== null && (still() || finalElapsed() >= ms);

  const verdictShown = () => at(OPENING.verdictAt);
  const guessing = () => props.view.phase === "guess" && props.now() >= (r().guessOpensAt ?? 0);
  /** Kelimeler ve puanlar: kurtulduysa açılışın sonunda, yakalandıysa son şanstan sonra. */
  const wordsShown = () => (r().caught ? atFinal(FINAL.wordsAt) : r().final !== null && at(OPENING.wordsAt));
  const scoreShown = () => (r().caught ? atFinal(FINAL.scoreAt) : r().final !== null && at(OPENING.scoreAt));
  const maskState = (): "on" | "wobble" | "broken" | "wink" => {
    if (!r().caught) return at(OPENING.maskAt) ? "wink" : "on";
    if (at(OPENING.breakAt)) return "broken";
    return at(OPENING.maskAt) ? "wobble" : "on";
  };

  const verdict = (): string => {
    if (props.spectator) return r().caught ? "Sızma yakalandı" : "Sızma kurtuldu";
    if (iAmOdd()) return r().caught ? "Yakalandın" : "Kimse seni yakalayamadı";
    return r().caught ? "Sızmayı yakaladınız" : "Sızma aranızdan kaçtı";
  };

  // Oyların uçuşu: az oy alandan çok alana; her oy bir küçük avatar.
  const ids = () => props.crew.map((m) => m.id);
  const flights = createMemo(() => flightPlan(ids(), r().votes));
  const landedAt = (i: number) => flightAt(i, flights().length) + OPENING.flyMs;
  const landed = (to: string) => flights().filter((f) => f.to === to && at(landedAt(f.index)));
  const flying = () =>
    still()
      ? []
      : flights().filter((f) => {
          const t0 = flightAt(f.index, flights().length);
          return elapsed() >= t0 && elapsed() < t0 + OPENING.flyMs;
        });

  // Uçuş için kartların konumları (tahta kutusuna göre). Yeniden boyutlanmada yeniden ölçülür.
  let board: HTMLDivElement | undefined;
  const [spots, setSpots] = createSignal<Record<string, { x: number; y: number }>>({});
  const measure = (): void => {
    if (!board) return;
    const box = board.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    for (const el of board.querySelectorAll<HTMLElement>("[data-id]")) {
      const id = el.dataset.id;
      const av = el.querySelector<HTMLElement>(".sz__tav") ?? el;
      const b = av.getBoundingClientRect();
      if (id) next[id] = { x: b.left - box.left + b.width / 2, y: b.top - box.top + b.height / 2 };
    }
    setSpots(next);
  };
  onMount(() => {
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
    queueMicrotask(() => {
      measure();
      if (board && ro) ro.observe(board);
    });
    onCleanup(() => ro?.disconnect());
  });

  // Sesler sunucu saatine bağlı: her olay bir kez, kendi anında.
  const openAt = (ms: number) => r().openedAt + ms;
  createEffect(
    (before: number) => {
      const n = flights().filter((f) => at(landedAt(f.index))).length;
      if (n > before && !still()) tok();
      return n;
    },
    untrack(() => flights().filter((f) => at(landedAt(f.index))).length),
  );
  cue(() => (r().runoff && !r().caught ? openAt(OPENING.verdictAt) : null), props.now, gong);
  cue(() => (r().caught ? openAt(OPENING.breakAt) : null), props.now, crack);
  cue(() => (r().caught ? null : openAt(OPENING.stampAt)), props.now, giggle);
  cue(
    () => (r().caught && r().final ? r().finalAt + FINAL.verdictAt : null),
    props.now,
    () => (r().final?.stole ? applause() : miss()),
  );
  cue(
    () => (r().final ? (r().caught ? r().finalAt + FINAL.scoreAt : openAt(OPENING.scoreAt)) : null),
    props.now,
    () => {
      if (props.spectator) return;
      if (outcomeOf(r(), props.selfId) === "win") {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    },
  );

  const quip = (): string | null => {
    const text = props.comment();
    return scoreShown() && text !== null && text.trim() !== "" ? text.trim() : null;
  };

  return (
    <div
      class="sz__rev"
      data-caught={r().caught ? "1" : "0"}
      data-guess={guessing() ? "1" : undefined}
      data-tv={props.tv ? "1" : undefined}
    >
      <div class="sz__head sz__head--reveal">
        <span class="overline">
          {guessing()
            ? "Son şans!"
            : verdictShown()
              ? r().caught
                ? "Yakalandı!"
                : "Kurtuldu!"
              : "Oylar açılıyor"}
        </span>
        <Show
          when={verdictShown()}
          fallback={<span class="sz__verdict sz__verdict--wait">Kim kime oy verdi?</span>}
        >
          <span class="sz__verdict">{verdict()}</span>
          <span class="sz__reason">{reasonLine(r(), name)}</span>
        </Show>
      </div>

      <div
        class="sz__culprit"
        style={{ "--tc": look(odd()?.avatar ?? 0).color }}
        data-on={verdictShown() ? "1" : undefined}
      >
        <div class="sz__culprit-av">
          <Show
            when={verdictShown() && odd()}
            fallback={
              <span class="sz__culprit-q" aria-hidden="true">
                <Mask size="70%" />
              </span>
            }
          >
            {(o) => <Avatar index={o().avatar} size="var(--sz-cav)" connected={o().connected} />}
          </Show>
          <Show when={verdictShown()}>
            <BigMask state={maskState()} />
          </Show>
          <Show when={!r().caught && at(OPENING.stampAt)}>
            <span class="sz__stamp">KURTULDU!</span>
          </Show>
          <Show when={r().caught && atFinal(FINAL.verdictAt)}>
            <span class="sz__stamp" data-kind={r().final?.stole ? "stole" : "miss"}>
              {r().final?.stole ? "KELİMEYİ ÇALDI!" : "TUTMADI!"}
            </span>
          </Show>
        </div>
        <Show when={verdictShown()}>
          <span class="sz__culprit-name">{odd()?.nickname ?? "?"}</span>
        </Show>
        <Show when={verdictShown() && at(OPENING.badgeAt)}>
          <span class="sz__notice" data-yes={r().selfNoticed ? "1" : "0"} role="status">
            {r().selfNoticed ? "Kendini fark etti · +1" : "Kendini fark etmedi"}
          </span>
        </Show>
      </div>

      <div class="sz__side">
        <Show
          when={!guessing()}
          fallback={<LastChance view={props.view} odd={odd()} me={iAmOdd()} now={props.now} />}
        >
          <Show when={props.view.phase === "guess" && r().caught && at(OPENING.breakAt)}>
            <p class="sz__waitline" role="status">
              {iAmOdd()
                ? "Son şansın geliyor: ortak kelimeyi tahmin et"
                : `${odd()?.nickname ?? "Sızma"} son şansını kullanacak`}
            </p>
          </Show>
          <Show when={wordsShown() && r().final}>
            {(f) => (
              <div class="sz__words">
                <span class="sz__wchip">
                  <em>Ortak</em>
                  {f().commonWord}
                </span>
                <span class="sz__wchip sz__wchip--odd">
                  <em>Sızma</em>
                  {f().infiltratorWord}
                </span>
                <Show when={r().caught}>
                  <span class="sz__guess" data-ok={f().stole ? "1" : "0"}>
                    <em>Tahmin</em>
                    <Show when={f().guess} fallback={<span class="sz__guess-none">yok</span>}>
                      {(g) => <s data-ok={f().stole ? "1" : "0"}>{g()}</s>}
                    </Show>
                  </span>
                </Show>
              </div>
            )}
          </Show>
          <Show when={scoreShown()}>
            <Show
              when={!props.spectator}
              fallback={
                <p class="sz__score" data-zero="1" role="status">
                  Yakalanırsa doğru oy verenler +1, kurtulursa sızma +2
                </p>
              }
            >
              <p
                class="sz__score"
                data-zero={(r().final?.scores[props.selfId] ?? 0) === 0 ? "1" : undefined}
                role="status"
              >
                {scoreLine(r(), props.selfId, props.view.myNotice)}
              </p>
            </Show>
          </Show>

          <div class="sz__boardbox" ref={board}>
            <ul class="sz__tally" aria-label="Kim kime oy verdi" data-n={props.crew.length}>
              <For each={props.crew}>
                {(m) => {
                  const got = () => landed(m.id);
                  const right = () => scoreShown() && (r().final?.rightVoters.includes(m.id) ?? false);
                  return (
                    <li
                      class="sz__tcell"
                      data-id={m.id}
                      data-me={m.id === props.selfId ? "1" : undefined}
                      data-odd={verdictShown() && m.id === r().infiltrator ? "1" : undefined}
                      data-right={right() ? "1" : undefined}
                    >
                      <span class="sz__tav">
                        <Avatar index={m.avatar} size="var(--sz-tav)" connected={m.connected} />
                        <span class="sz__tbadge" data-zero={got().length === 0 ? "1" : undefined}>
                          {got().length}
                        </span>
                        <Show when={right()}>
                          <span class="sz__tright" role="img" aria-label="Doğru oy">
                            ✓
                          </span>
                        </Show>
                      </span>
                      <span class="sz__tname">
                        <Show when={m.id === props.selfId} fallback={m.nickname}>
                          <span class="sz__you" title={m.nickname}>
                            Sen
                          </span>
                        </Show>
                      </span>
                      <span class="sz__voters" aria-hidden="true">
                        <For each={got().slice(0, 4)}>
                          {(f) => (
                            <span class="sz__voter">
                              <Avatar index={member(f.from)?.avatar ?? 0} size={18} />
                            </span>
                          )}
                        </For>
                        <Show when={got().length > 4}>
                          <span class="sz__voter-more">+{got().length - 4}</span>
                        </Show>
                      </span>
                    </li>
                  );
                }}
              </For>
            </ul>
            <For each={flying()}>
              {(f) => {
                const style = (): JSX.CSSProperties | undefined => {
                  const a = spots()[f.from];
                  const b = spots()[f.to];
                  if (!a || !b) return undefined;
                  return {
                    left: `${a.x}px`,
                    top: `${a.y}px`,
                    "--dx": `${b.x - a.x}px`,
                    "--dy": `${b.y - a.y}px`,
                    "--fly": `${OPENING.flyMs}ms`,
                  };
                };
                return (
                  <Show when={style()}>
                    {(s) => (
                      <span class="sz__fly" style={s()} aria-hidden="true">
                        <Avatar index={member(f.from)?.avatar ?? 0} size={26} />
                      </span>
                    )}
                  </Show>
                );
              }}
            </For>
          </div>
          <Show when={quip()}>{(q) => <p class="sz__quip">“{q()}”</p>}</Show>
        </Show>
      </div>
    </div>
  );
}

interface LastProps {
  view: SizmaScreenView;
  odd: CrewMember | null;
  me: boolean;
  now: () => number;
}

/** Son şans (SZ-M5, SZ-U6): sızmada yazı alanı ve 15 sn halkası; diğerlerinde "Mert tahmin ediyor…". */
function LastChance(props: LastProps) {
  const r = () => props.view.reveal as NonNullable<SizmaScreenView["reveal"]>;
  const start = () => r().guessOpensAt ?? 0;
  const end = () => r().guessEndsAt ?? 0;
  const left = () => Math.max(0, Math.ceil((end() - props.now()) / 1_000));
  const frac = () => Math.max(0, Math.min(1, (end() - props.now()) / Math.max(1, end() - start())));
  const [text, setText] = createSignal("");
  const [sent, setSent] = createOptimistic<boolean>(() => props.view.locked);
  const submit = (e?: Event): void => {
    e?.preventDefault();
    const t = text().trim();
    if (t === "" || sent()) return;
    unlockAudio();
    setSent(true, () => sendActionAck({ kind: "guess", text: t }));
  };
  const ring = () => (
    <span class="sz__ring" style={{ "--p": frac() }} role="timer" aria-label={`${left()} saniye`}>
      <b>{left()}</b>
    </span>
  );
  return (
    <div class="sz__last" data-me={props.me ? "1" : undefined}>
      <Show
        when={props.me}
        fallback={
          <>
            {ring()}
            <p class="sz__last-who">
              {props.odd?.nickname ?? "Sızma"} tahmin ediyor
              <span class="sz__dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </p>
            <p class="sz__last-sub">Ortak kelimeyi bilirse +1 kazanır</p>
          </>
        }
      >
        <Show
          when={!sent()}
          fallback={
            <>
              {ring()}
              <p class="sz__last-who">Tahminin gönderildi</p>
              <p class="sz__last-sub">Kelimeler açılıyor…</p>
            </>
          }
        >
          <div class="sz__last-top">
            {ring()}
            <div>
              <h2 class="sz__last-q">Ortak kelime neydi?</h2>
              <Show when={props.view.word}>
                {(w) => (
                  <p class="sz__mine">
                    Senin kelimen <b>{w()}</b>
                  </p>
                )}
              </Show>
            </div>
          </div>
          <form class="sz__last-form" onSubmit={submit}>
            <input
              class="sz__last-in"
              type="text"
              value={text()}
              maxLength={SIZMA_GUESS_MAX}
              autocomplete="off"
              autocapitalize="characters"
              spellcheck={false}
              enterkeyhint="send"
              placeholder="Kelimeyi yaz"
              aria-label="Ortak kelime tahminin"
              onInput={(e) => setText(e.currentTarget.value)}
              ref={(el) => queueMicrotask(() => el.focus({ preventScroll: true }))}
            />
            <PrimaryButton type="submit" disabled={text().trim() === ""}>
              Tahmin et
            </PrimaryButton>
          </form>
        </Show>
      </Show>
    </div>
  );
}
