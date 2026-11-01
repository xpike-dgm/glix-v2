// biome-ignore-all lint/a11y/noSvgWithoutTitle: süsler dekoratif (aria-hidden)
import { KARALAMA_GUESS_MAX, type KaralamaReveal, type PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { karalamaProp } from "../../ui/props.js";
import { Mask, sizmaArt } from "../sizma/Mask.js";
import { DrawingCanvas } from "./DrawingCanvas.js";
import * as sfx from "./sounds.js";
import { wallLayout } from "./VoteWall.js";
import { type ParsedDrawing, scoreStrip, shownWord, wallName } from "./view.js";

/** Açılış zamanlaması (KD-U5): oylar 0,25 sn arayla uçar, sonra davul + maske (2 sn), sonra damga. */
export const VOTE_STEP_MS = 250;
export function openingTimes(votes: number): { votesEnd: number; mask: number; stamp: number } {
  const votesEnd = Math.min(8, votes) * VOTE_STEP_MS + 200;
  return { votesEnd, mask: votesEnd + 1_200, stamp: votesEnd + 2_200 };
}

interface Props {
  phase: "unmask" | "guess" | "done";
  reveal: KaralamaReveal;
  players: string[];
  drawings: Record<string, ParsedDrawing> | null;
  crew: PlayerInfo[];
  selfId: string;
  /** Bu oyuncu bilgisiz mi (son şansta yazı alanı). */
  me: boolean;
  /** Bilgisizin kendi kelimesi (yalnız onun görünümünde). */
  myWord: string | null;
  tv?: boolean;
  now: () => number;
}

/** Kırık maske: Sızma görseli varsa o, yoksa Sızma'nın SVG maskesi (yeniden kullanılır). */
function MaskArt() {
  const src = sizmaArt("maske");
  return (
    // Düşen maske kendi kırpma kutusunda kalır: çerçevenin kaydırılabilir taşmasını büyütmez.
    <span class="kdop__maskbox" aria-hidden="true">
      <span class="kdop__mask">
        <Show when={src} fallback={<Mask size="100%" />}>
          {(s) => <img src={s()} alt="" draggable={false} />}
        </Show>
      </span>
    </span>
  );
}

/**
 * Damga: görsel varsa yazısız eğik çerçeve görseli ve yazı kodla çerçevenin içinde (aynı eğimle), yoksa CSS damgası.
 */
function Stamp(props: { caught: boolean }) {
  const src = () => karalamaProp(props.caught ? "damga-yakalandi" : "damga-kurtuldu");
  const text = () => (props.caught ? "YAKALANDI!" : "KURTULDU!");
  return (
    <span class="kdop__stamp" data-caught={props.caught ? "1" : "0"} data-art={src() ? "1" : undefined}>
      <Show when={src()} fallback={<b>{text()}</b>}>
        {(s) => (
          <>
            <span class="kdop__stamptext">{text()}</span>
            <img src={s()} alt="" draggable={false} />
          </>
        )}
      </Show>
    </span>
  );
}

/**
 * Oyunun kendi açılışı (KD-U5, KD-U7, KD-U10): sergi duvarında oylar oy verenin çiziminden seçtiği çizime kıvrılan
 * ışık izleriyle uçar, sayaçlar büyür; davul, bilgisizin çiziminde maske düşer, altında onun kelimesi; damga. Ardından
 * son şans (bilgisizde yazı alanı, diğerlerinde "düşünüyor…") ve sonda kart döner: ortak kelime, tahmin, puan şeridi.
 * Ana kelime son şans bitene kadar hiçbir ekranda yoktur (sunucu da göndermez).
 */
export function Acilis(props: Props) {
  const r = () => props.reveal;
  const nameOf = (id: string): string => props.crew.find((p) => p.id === id)?.nickname ?? "Biri";
  const outsider = () => props.crew.find((p) => p.id === r().outsider);
  /** Oylar katılım sırasıyla uçar. */
  const flights = createMemo(() =>
    props.players
      .filter((id) => Object.hasOwn(r().votes, id) && r().votes[id] !== id)
      .map((from, i) => ({ from, to: r().votes[from] as string, i })),
  );
  const times = createMemo(() => openingTimes(flights().length));
  const t = () => props.now() - r().openedAt;
  const arrived = (id: string): number =>
    flights().filter((f) => f.to === id && t() >= (f.i + 1) * VOTE_STEP_MS).length;
  const masked = () => props.phase !== "unmask" || t() >= times().mask;
  const stamped = () => props.phase !== "unmask" || t() >= times().stamp;

  // Ses: yalnız gelecekteki anlar zamanlanır (yeniden bağlanan geçmişi duymaz).
  onMount(() => {
    if (props.phase !== "unmask") return;
    const at = (ms: number, fn: () => void): void => {
      const wait = r().openedAt + ms - props.now();
      if (wait < -150) return;
      const h = setTimeout(fn, Math.max(0, wait));
      onCleanup(() => clearTimeout(h));
    };
    for (const f of flights()) at(f.i * VOTE_STEP_MS, sfx.whoosh);
    at(times().votesEnd, sfx.drum);
    at(times().mask, sfx.maskCrack);
    at(times().stamp, sfx.stamp);
  });

  // Işık izleri: kartların konumları ölçülür; oy verenin kartından hedef karta kıvrılan yol.
  let wall: HTMLDivElement | undefined;
  const cards = new Map<string, HTMLElement>();
  const [rects, setRects] = createSignal<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  const measure = (): void => {
    if (!wall) return;
    const base = wall.getBoundingClientRect();
    setSize({ w: wall.clientWidth, h: wall.clientHeight });
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const [id, el] of cards) {
      const b = el.getBoundingClientRect();
      out[id] = { x: b.left - base.left, y: b.top - base.top, w: b.width, h: b.height };
    }
    setRects(out);
  };
  onMount(() => {
    if (!wall) return;
    measure();
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(wall);
    onCleanup(() => ro.disconnect());
  });
  const layout = () => wallLayout(props.players.length, size().w, size().h);
  createEffect(on(layout, () => requestAnimationFrame(measure), { defer: true }));
  const path = (from: string, to: string): string | null => {
    const a = rects()[from];
    const b = rects()[to];
    if (!a || !b) return null;
    const x1 = a.x + a.w / 2;
    const y1 = a.y + a.h * 0.85;
    const x2 = b.x + b.w / 2;
    const y2 = b.y + b.h * 0.4;
    if (reducedMotion()) return `M${x1} ${y1}L${x2} ${y2}`;
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.25;
    const my = Math.min(y1, y2) - Math.max(40, Math.abs(x2 - x1) * 0.3);
    return `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`;
  };
  const trail = karalamaProp("isik-izi");

  const final = () => r().final;
  onMount(() => {
    if (props.phase !== "done") return;
    const f = final();
    if (f?.guess) (f.guessed ? sfx.bell : sfx.bzzt)();
  });

  const announce = (): string => {
    const o = nameOf(r().outsider);
    const votes = r().tally[r().outsider] ?? 0;
    const base = `Kelimeyi bilmeyen ${o}. ${votes} oy aldı, ${r().caught ? "yakalandı" : "kurtuldu"}.`;
    const f = final();
    return f ? `${base} Ortak kelime ${f.mainWord}, onun kelimesi ${r().nearWord}.` : base;
  };

  return (
    <div
      class="kdop"
      data-phase={props.phase}
      data-tv={props.tv ? "1" : undefined}
      data-me={props.me ? "1" : undefined}
    >
      <h2 class="kdop__title">
        {props.phase === "unmask"
          ? stamped()
            ? r().caught
              ? "Yakalandı!"
              : "Kurtuldu!"
            : "Kelimeyi bilmeyen…"
          : props.phase === "guess"
            ? "Son şans"
            : final()?.guessed
              ? "BİLDİ!"
              : r().caught
                ? "Yakalandı!"
                : "Kurtuldu!"}
      </h2>
      <div
        class="kdop__wall"
        ref={wall}
        style={{
          "--cols": layout().cols,
          "--colw": `${layout().colw}px`,
          "--cell": `${layout().cell}px`,
          visibility: layout().cell > 0 ? "visible" : "hidden",
        }}
      >
        <For each={props.players}>
          {(id) => {
            const p = () => props.crew.find((x) => x.id === id);
            const isOut = () => id === r().outsider;
            return (
              <div
                class="kdop__card"
                data-out={isOut() && masked() ? "1" : undefined}
                data-tight={layout().colw < 90 ? "1" : undefined}
                ref={(el) => {
                  cards.set(id, el);
                }}
              >
                <div class="kdop__frame">
                  <DrawingCanvas
                    strokes={props.drawings?.[id]?.strokes ?? []}
                    version={props.drawings?.[id]?.key ?? "0"}
                  />
                  <Show when={isOut() && masked()}>
                    <MaskArt />
                  </Show>
                  <Show when={arrived(id) > 0}>
                    <span class="kdop__count" data-n={arrived(id)}>
                      {arrived(id)}
                    </span>
                  </Show>
                </div>
                <span class="kdop__name">
                  <Show when={p()}>{(x) => <Avatar index={x().avatar} size={props.tv ? 40 : 22} />}</Show>
                  {id === props.selfId ? "Sen" : wallName(p()?.nickname ?? "?")}
                </span>
                <Show when={isOut() && masked()}>
                  <span class="kdop__near">
                    Onun: <b>{shownWord(r().nearWord)}</b>
                  </span>
                </Show>
              </div>
            );
          }}
        </For>
        <svg class="kdop__trails" width={size().w} height={size().h} aria-hidden="true">
          <For each={props.phase === "unmask" ? flights() : []}>
            {(f) => (
              <Show when={path(f.from, f.to)}>
                {(d) => (
                  <path
                    d={d()}
                    pathLength="1"
                    class="kdop__trail"
                    data-art={trail ? "1" : undefined}
                    style={{ "animation-delay": `${f.i * VOTE_STEP_MS}ms` }}
                  />
                )}
              </Show>
            )}
          </For>
        </svg>
        {/* Işık izinin ucu (KD-U5): görsel varsa yol boyunca kıvrılarak uçar; hareket azaltmada yalnız çizgi kalır. */}
        <Show when={trail && props.phase === "unmask" && !reducedMotion() ? trail : null}>
          {(src) => (
            <For each={flights()}>
              {(f) => (
                <Show when={path(f.from, f.to)}>
                  {(d) => (
                    <img
                      class="kdop__comet"
                      src={src()}
                      alt=""
                      draggable={false}
                      aria-hidden="true"
                      style={{
                        "offset-path": `path("${d()}")`,
                        "animation-delay": `${f.i * VOTE_STEP_MS}ms`,
                      }}
                    />
                  )}
                </Show>
              )}
            </For>
          )}
        </Show>
        <Show when={props.phase === "unmask" && stamped()}>
          <Stamp caught={r().caught} />
        </Show>
      </div>

      <Show when={props.phase === "guess"}>
        <LastChance
          reveal={r()}
          outsider={outsider()}
          me={props.me}
          myWord={props.myWord}
          now={props.now}
          tv={props.tv}
        />
      </Show>

      <Show when={props.phase === "done" ? final() : null}>
        {(f) => (
          <div class="kdop__final">
            <div class="kdop__flip" data-ok={f().guessed ? "1" : "0"}>
              <span class="kdop__flipq">{nameOf(r().outsider)} tahmini</span>
              <Show when={f().guess} fallback={<span class="kdop__none">Tahmin yok</span>}>
                {(g) => (
                  <span class="kdop__guess">
                    <s data-ok={f().guessed ? "1" : "0"}>{g()}</s> {f().guessed ? "✓" : "✗"}
                  </span>
                )}
              </Show>
            </div>
            <p class="kdop__words">
              Ortak: <b class="kdop__main">{shownWord(f().mainWord)}</b> · Onun:{" "}
              <b class="kdop__nearw">{shownWord(r().nearWord)}</b>
            </p>
            <ul class="kdop__strip">
              <For each={scoreStrip(r(), nameOf)}>{(line) => <li>{line}</li>}</For>
            </ul>
          </div>
        )}
      </Show>
      <p class="sr-only" aria-live="polite">
        {props.phase === "unmask" && !stamped() ? "" : announce()}
      </p>
    </div>
  );
}

/** Son şans (KD-U7): bilgisizde "Ortak kelime neydi?" ve 12 sn kırmızı halka; diğerlerinde "düşünüyor…". */
function LastChance(props: {
  reveal: KaralamaReveal;
  outsider: PlayerInfo | undefined;
  me: boolean;
  myWord: string | null;
  tv?: boolean | undefined;
  now: () => number;
}) {
  const start = () => props.reveal.guessOpensAt;
  const end = () => props.reveal.guessEndsAt;
  const left = () => Math.max(0, Math.ceil((end() - props.now()) / 1_000));
  const frac = () => Math.max(0, Math.min(1, (end() - props.now()) / Math.max(1, end() - start())));
  // Saat tiki: son 5 sn.
  createEffect(
    on(left, (s, prev) => {
      if (prev !== undefined && s < prev && s <= 5 && s > 0) sfx.clockTick();
    }),
  );
  const [text, setText] = createSignal("");
  const [sent, setSent] = createOptimistic<boolean>(() => props.reveal.guessSent);
  const submit = (e?: Event): void => {
    e?.preventDefault();
    const t = text().trim();
    if (t === "" || sent()) return;
    unlockAudio();
    setSent(true, () => sendActionAck({ kind: "guess", text: t }));
  };
  const ring = () => (
    <span class="kdop__ring" style={{ "--p": frac() }} role="timer" aria-label={`${left()} saniye`}>
      <b>{left()}</b>
    </span>
  );
  return (
    <div class="kdop__last" data-me={props.me ? "1" : undefined}>
      <Show
        when={props.me && !props.tv}
        fallback={
          <div class="kdop__think">
            <Show when={props.outsider}>
              {(o) => <Avatar index={o().avatar} size={props.tv ? 140 : 72} live="think" />}
            </Show>
            {ring()}
            <p class="kdop__thinkwho">
              {props.reveal.guessSent
                ? "Tahmin geldi…"
                : `${props.outsider?.nickname ?? "Bilgisiz"} kelimeyi tahmin ediyor…`}
            </p>
            <p class="kdop__sub">Ortak kelimeyi bilirse +1 kazanır</p>
          </div>
        }
      >
        <Show
          when={!sent()}
          fallback={
            <div class="kdop__think">
              {ring()}
              <p class="kdop__thinkwho">Tahminin gönderildi</p>
              <p class="kdop__sub">Kelimeler açılıyor…</p>
            </div>
          }
        >
          <div class="kdop__ask">
            {ring()}
            <div>
              <h3 class="kdop__q">Ortak kelime neydi?</h3>
              <Show when={props.myWord}>
                {(w) => (
                  <p class="kdop__sub">
                    Senin kelimen <b>{shownWord(w())}</b> · tek tahmin
                  </p>
                )}
              </Show>
            </div>
          </div>
          <form class="kdop__form" onSubmit={submit}>
            <input
              class="kdop__in"
              type="text"
              lang="tr"
              value={text()}
              maxLength={KARALAMA_GUESS_MAX}
              autocomplete="off"
              autocapitalize="none"
              spellcheck={false}
              enterkeyhint="send"
              placeholder="Kelimeyi yaz"
              aria-label="Ortak kelime tahminin"
              onInput={(e) => setText(e.currentTarget.value)}
              ref={(el) => queueMicrotask(() => el.focus({ preventScroll: true }))}
            />
            <PrimaryButton disabled={text().trim() === ""} onClick={() => submit()}>
              Gönder
            </PrimaryButton>
          </form>
        </Show>
      </Show>
    </div>
  );
}
