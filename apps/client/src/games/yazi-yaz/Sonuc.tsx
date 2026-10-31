import type { YaziYazReveal } from "@glix/engine";
import { createMemo, createSignal, For, Index, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { atServerTime } from "../../net/serverTimer.js";
import { Avatar } from "../../ui/Avatar.js";
import { CheckIcon } from "../../ui/Icons.js";
import { dingSound, drumRollSound, stampSound, typeKeySound } from "./sounds.js";
import { revealPlan } from "./timeline.js";
import { findersOf, outcomeOf } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";

interface Props {
  reveal: YaziYazReveal;
  /** Açılışın başladığı an (sunucu saati; tahminin bittiği an). */
  startAt: number;
  topic: string | null;
  crew: Crew[];
  selfId: string;
  now: () => number;
  spectator: boolean;
  /** Spiker yorumu (YY-AI2); yoksa hiç görünmez. */
  comment: string | null;
}

const Cross = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" />
  </svg>
);

const reduced = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * "Yazanlar…" açılışı (YY-U5): davul → yazan kartları döner, kelime daktiloyla yazılır → bulanların avatarları karta
 * uçar, damga → oyuncu satırları → kendi satırın parlar. Zamanlar sunucu saatine bağlıdır (timeline.ts); geç açılan
 * ekran olduğu yerden devam eder, kaçırılan sesler çalınmaz. Hareket azaltmada her şey hemen görünür.
 */
export function Sonuc(props: Props) {
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const order = () => props.crew.map((m) => m.id);
  const finders = (w: string) => findersOf(props.reveal, order(), w);
  const plan = createMemo(() =>
    revealPlan(props.reveal.writers, props.reveal.words, finders, props.crew.length),
  );
  const elapsed0 = reduced() ? Number.POSITIVE_INFINITY : props.now() - props.startAt;
  const [t, setT] = createSignal(elapsed0);
  const mine = () => outcomeOf(props.reveal, props.selfId);
  const isWriter = () => props.reveal.writers.includes(props.selfId);

  const cancels: (() => void)[] = [];
  onCleanup(() => {
    for (const c of cancels) c();
  });
  onMount(() => {
    if (!Number.isFinite(elapsed0)) return;
    const at = (ms: number, fx?: () => void): void => {
      cancels.push(
        atServerTime(
          props.startAt + ms,
          () => {
            setT((v) => Math.max(v, ms));
            // Geç açılan ekranda geçmiş anların sesi çalınmaz.
            if (fx && props.now() - (props.startAt + ms) < 350) fx();
          },
          props.now,
        ),
      );
    };
    const p = plan();
    at(0, drumRollSound);
    for (const c of p.cards) {
      at(c.flipAt, hapticTap);
      c.letters.forEach((ms, i) => {
        at(ms, i === c.letters.length - 1 ? dingSound : typeKeySound);
      });
      for (const ms of c.flyAt) at(ms);
      at(c.stampAt, stampSound);
    }
    for (let i = 0; i < props.crew.length; i++) at(p.rowsAt + i * p.rowStep);
    at(p.meAt, () => {
      if (props.spectator) return;
      if (mine().points > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    });
  });

  const verdict = (): string => {
    const o = mine();
    if (o.hidden) return "İz bırakmadın!";
    if (o.personOk === null) return "Tahmin vermedin";
    if (o.personOk && o.wordOk) return "Tam isabet!";
    if (o.personOk) return o.wordOk === null ? "Yazanı buldun" : "Yazanı buldun, kelime tutmadı";
    return "Bu sefer olmadı";
  };
  const writerVerdict = (): string | null => {
    if (!isWriter() || mine().hidden) return null;
    const n = finders(props.selfId).filter((id) => !props.reveal.writers.includes(id)).length;
    return n > 0 ? `${n} kişi seni buldu` : null;
  };

  return (
    <div class="yyr" data-done={t() >= plan().meAt ? "1" : undefined}>
      <div class="yy__head yy__head--res">
        <Show
          when={t() >= plan().meAt && !props.spectator}
          fallback={
            <>
              <span class="overline">{props.topic ? `Konu · ${props.topic}` : "Sonuç"}</span>
              <span class="yy__title yyr__drum" data-on={t() < plan().rowsAt ? "1" : undefined}>
                {props.spectator && t() >= plan().rowsAt ? "Yazanlar belli oldu" : "Yazanlar…"}
              </span>
            </>
          }
        >
          <span class="yyr__me">
            <span class="yy__score" data-zero={mine().points === 0 ? "1" : undefined}>
              {mine().points}
              <small> puan</small>
            </span>
            <span class="yyr__award" data-v={mine().award}>
              {mine().award > 0 ? `+${mine().award}` : "0"}
            </span>
          </span>
          <span class="yy__verdict">{writerVerdict() ?? verdict()}</span>
        </Show>
      </div>

      <div class="yy__signs">
        <For each={plan().cards}>
          {(c) => {
            const word = () => props.reveal.words[c.writer] ?? "";
            const shown = () => c.letters.filter((ms) => t() >= ms).length;
            const who = () => finders(c.writer);
            const hidden = () => props.reveal.hidden.includes(c.writer);
            return (
              <div class="yy__card" data-open={t() >= c.flipAt ? "1" : undefined}>
                <span class="yy__card-in">
                  <span class="yy__card-face yy__card-back" aria-hidden="true">
                    ?
                  </span>
                  <span class="yy__card-face yy__card-front">
                    <Avatar index={member(c.writer)?.avatar ?? 0} size={44} ring="var(--magenta)" />
                    <span class="yy__card-name">{member(c.writer)?.nickname ?? "?"}</span>
                    <Show
                      when={word() !== ""}
                      fallback={
                        <span class="yy__card-word" data-empty="1">
                          Kelime yazmadı
                        </span>
                      }
                    >
                      <span class="yy__card-word">
                        <Index each={Array.from(word())}>
                          {(ch, i) => (
                            <span class="yy__type" data-on={i < shown() ? "1" : undefined}>
                              {ch()}
                            </span>
                          )}
                        </Index>
                      </span>
                    </Show>
                    <span class="yy__finders">
                      <For each={who()}>
                        {(id, k) => (
                          <span class="yy__fly" data-on={t() >= (c.flyAt[k()] ?? 0) ? "1" : undefined}>
                            <Avatar index={member(id)?.avatar ?? 0} size={26} />
                          </span>
                        )}
                      </For>
                    </span>
                    <span
                      class="yy__stamp"
                      data-kind={hidden() ? "hidden" : "found"}
                      data-on={t() >= c.stampAt ? "1" : undefined}
                    >
                      {hidden()
                        ? "İZ BIRAKMADI"
                        : who().length > 0
                          ? `${who().length} kişi buldu`
                          : "Kimse seçmedi"}
                    </span>
                  </span>
                </span>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={props.comment && t() >= plan().rowsAt ? props.comment : null}>
        {(c) => (
          <p class="yy__comment">
            <span class="yy__comment-tag">Spiker</span>
            {c()}
          </p>
        )}
      </Show>
      <p class="yy__rowhead" aria-hidden="true">
        <span>puan</span>
        <span>skor</span>
      </p>
      <ul class="yy__rows" data-scroll>
        <For each={props.crew}>
          {(m, i) => {
            const g = () => props.reveal.guesses[m.id];
            const pts = () => props.reveal.scores[m.id] ?? 0;
            const award = () => props.reveal.awards[m.id] ?? 0;
            const target = () => (g()?.target ? member(g()?.target as string) : undefined);
            const on = () => t() >= plan().rowsAt + i() * plan().rowStep;
            return (
              <li
                class="yy__row"
                data-on={on() ? "1" : undefined}
                data-me={m.id === props.selfId ? "1" : undefined}
                data-glow={m.id === props.selfId && t() >= plan().meAt ? "1" : undefined}
              >
                <Avatar index={m.avatar} size={32} connected={m.connected} />
                <span class="yy__row-name">{m.nickname}</span>
                <span class="yy__row-what">
                  <Show when={g()?.target} fallback={<span class="yy__none">tahmin yok</span>}>
                    <span class="yy__pick" data-ok={g()?.personOk ? "1" : "0"}>
                      <Avatar index={target()?.avatar ?? 0} size={36} />
                      {g()?.personOk ? <CheckIcon size={14} /> : <Cross />}
                    </span>
                    <Show when={g()?.word}>
                      <span class="yy__guess" data-ok={g()?.wordOk ? "1" : "0"}>
                        <span class="yy__guess-text">{g()?.word}</span>
                        {g()?.wordOk ? <CheckIcon size={14} /> : <Cross />}
                      </span>
                    </Show>
                  </Show>
                  <Show when={props.reveal.hidden.includes(m.id)}>
                    <span class="yy__hid">İz bırakmadı</span>
                  </Show>
                </span>
                <span class="yy__pts" data-zero={pts() === 0 ? "1" : undefined}>
                  {pts()}
                </span>
                <span class="yy__award" data-v={award()}>
                  {award() > 0 ? `+${award()}` : "0"}
                </span>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
}
