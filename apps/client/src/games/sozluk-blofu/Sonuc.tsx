// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import { SOZLUK_KNEW_DELAY_MS } from "@glix/engine";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { match as matchSound, solo as soloSound, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { atServerTime } from "../../net/serverTimer.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { createOptimistic, toAck } from "../../ui/optimistic.js";
import { sozlukProp } from "../../ui/props.js";
import { boingSound, drumSound, fanfareSound, flipSound, stampSound } from "./sounds.js";
import {
  type CrewMember,
  chipName,
  myOutcome,
  type RevealCard,
  revealAnnouncement,
  revealCards,
  revealPlan,
  type SozlukScreenView,
  scoreLine,
  specialMoment,
} from "./view.js";
import { Term } from "./Write.js";

interface Props {
  view: SozlukScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  tv?: boolean;
}

const MOMENT_TEXT = { sozluk: "SÖZLÜK KAZANDI", usta: "BLÖF USTASI", herkes: "HERKES BİLDİ" } as const;

/** Mühür simgesi (SB-U5): görsel yoksa SVG halka; renk körü için gerçek kartta yeşilin yanında da durur (SB-U18). */
function Seal(props: { small?: boolean; label?: string }) {
  const img = sozlukProp("muhur");
  const arcId = `sbseal-arc-${createUniqueId()}`;
  return (
    <span
      class="sbseal"
      data-small={props.small ? "1" : undefined}
      data-art={img ? "1" : undefined}
      aria-hidden="true"
    >
      <Show
        when={img}
        fallback={
          <svg viewBox="0 0 64 64" width="100%" height="100%">
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4" />
            <circle
              cx="32"
              cy="32"
              r="21"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-dasharray="3 3"
            />
            <path
              d="M21 33l7 7 15-16"
              fill="none"
              stroke="currentColor"
              stroke-width="5"
              stroke-linecap="round"
            />
          </svg>
        }
      >
        {(src) => (
          <>
            <Show when={props.label}>
              <i class="sbseal__disc" />
            </Show>
            <img src={src()} alt="" />
            <Show when={props.label}>
              {(label) => (
                <svg class="sbseal__label" viewBox="0 0 256 256" width="100%" height="100%">
                  {/* Görselde yazı yok: kitabın altında, iç halkaya koşut kavisli yazı (merkez 128,129). */}
                  <path id={arcId} d="M44 129a84 84 0 0 0 168 0" fill="none" />
                  <text text-anchor="middle" textLength="178" lengthAdjust="spacing">
                    <textPath href={`#${arcId}`} startOffset="50%">
                      {label()}
                    </textPath>
                  </text>
                </svg>
              )}
            </Show>
          </>
        )}
      </Show>
    </span>
  );
}

/** Altın tüy kalem rozeti (SB-U8): görsel yoksa SVG. */
function Quill() {
  const img = sozlukProp("tuy-kalem");
  return (
    <span class="sbquill" aria-hidden="true">
      <Show
        when={img}
        fallback={
          <svg viewBox="0 0 32 32" width="100%" height="100%">
            <path d="M27 4C16 6 9 13 6 26l3 1c2-4 4-7 7-9-2 0-3 0-5 1 4-5 9-8 16-15z" fill="currentColor" />
            <path d="M5 28l3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        }
      >
        {(src) => <img src={src()} alt="" />}
      </Show>
    </span>
  );
}

/**
 * Mühürlü açılış (SB-U5…U9, U14, U18): kartlar seçme ekranındaki numaralarıyla durur; sahte kartlar azdan çoğa kandırana
 * tek tek çevrilir (seçenlerin isim çipleri karta uçar), en son "Gerçek anlam…" ve "SÖZLÜKTE" mührü; ardından tek bir özel
 * damga, puan başlığı ve kartlar son sıraya (gerçek üstte) kayar. Zamanlar sunucu saatine bağlıdır; geç açılan ekran
 * olduğu yerden devam eder, kaçırılan sesler çalınmaz. Hareket azaltmada çevirme ve uçuş yoktur, kartlar 0,6 sn arayla belirir.
 */
export function Sonuc(props: Props) {
  const reveal = () => props.view.reveal;
  const final = createMemo<RevealCard[]>(() => {
    const r = reveal();
    return r ? revealCards(props.view.cards ?? [], r, props.view.players) : [];
  });
  const byNumber = createMemo(() => [...final()].sort((a, b) => a.no - b.no));
  const calm = reducedMotion();
  const plan = createMemo(() => revealPlan(final(), calm));
  const moment = createMemo(() => specialMoment(final(), plan().champion));
  const start = () => props.view.pickEndsAt;
  const me = createMemo(() => {
    const r = reveal();
    return r && !props.spectator ? myOutcome(r, props.selfId) : null;
  });
  const member = (id: string | null) => props.crew.find((m) => m.id === id);

  const [t, setT] = createSignal(props.now() - start());
  const cancels: (() => void)[] = [];
  onCleanup(() => {
    for (const c of cancels) c();
  });
  onMount(() => {
    const p = plan();
    const at = (ms: number, fx?: () => void): void => {
      cancels.push(
        atServerTime(
          start() + ms,
          () => {
            setT((v) => Math.max(v, ms));
            // Geç açılan ekranda geçmiş anların sesi çalınmaz.
            if (fx && props.now() - (start() + ms) < 350) fx();
          },
          props.now,
        ),
      );
    };
    for (const c of final()) {
      const flip = p.flipAt[c.id];
      if (flip === undefined) continue;
      const fooledMe = me()?.pick === c.id;
      at(flip, () => {
        if (calm) return;
        flipSound();
        if (fooledMe) {
          boingSound();
          hapticMatch();
        }
      });
    }
    at(p.suspenseAt, calm ? undefined : drumSound);
    at(p.stampAt, () => {
      stampSound();
      hapticTap();
    });
    at(p.summaryAt, () => {
      if (moment() !== "usta") return;
      fanfareSound();
      const champ = final().find((c) => c.id === plan().champion);
      if (champ?.author === props.selfId) hapticSolo();
    });
    at(p.doneAt, () => {
      const o = me();
      if (!o) return;
      if (o.points > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    });
    // Kendi süresini aşan sekme (ör. arka plandan dönüş) her şeyi göstersin.
    at(p.doneAt + 50);
  });

  const done = () => t() >= plan().doneAt;
  const cards = () => (done() ? final() : byNumber());
  const flipped = (c: RevealCard): boolean =>
    c.real ? t() >= plan().stampAt : t() >= (plan().flipAt[c.id] ?? 0);
  const summary = () => t() >= plan().summaryAt;
  const ink = sozlukProp("murekkep");
  /** Mühür görseli yazısızdır: "SÖZLÜKTE" kodla mührün içine yazılır; görsel yoksa SVG halka ve altında yazı. */
  const seal = sozlukProp("muhur") !== null;

  return (
    <Show when={reveal()}>
      <div class="sb__head sb__head--res">
        <Term word={props.view.word} type={props.view.wordType} small />
        <Show
          when={summary() && me()}
          fallback={
            <span class="sb__verdict" data-wait={!summary() ? "1" : undefined}>
              {summary()
                ? "Gerçek anlam açıldı"
                : t() >= plan().suspenseAt
                  ? "Gerçek anlam…"
                  : "Kartlar açılıyor"}
            </span>
          }
        >
          {(o) => (
            <div class="sb__me" data-zero={o().points === 0 ? "1" : undefined}>
              <span class="sb__line">{scoreLine(o())}</span>
              <span class="sb__total">
                <b>blöf puanı {o().points}</b>
                <Show when={done() && o().award > 0}>
                  <span class="sbmedal" data-rank={o().award}>
                    +{o().award} genel
                  </span>
                </Show>
              </span>
            </div>
          )}
        </Show>
      </div>

      <ul class="sbres" data-scroll data-done={done() ? "1" : undefined} aria-label="Tanımlar">
        <For each={cards()}>
          {(c, i) => {
            const author = () => member(c.author);
            const mineCard = () => c.author === props.selfId;
            const myPick = () => me()?.pick === c.id;
            const open = () => flipped(c);
            const stampOf = () =>
              summary() && moment() !== null
                ? (moment() === "usta" && c.id === plan().champion) || (moment() !== "usta" && c.real)
                  ? moment()
                  : null
                : null;
            return (
              <li
                class="sbres__card"
                data-real={c.real && open() ? "1" : undefined}
                data-open={open() ? "1" : undefined}
                data-zero={open() && !c.real && c.pickers.length === 0 ? "1" : undefined}
                data-tremble={!open() && t() >= plan().suspenseAt ? "1" : undefined}
                data-me={mineCard() ? "1" : undefined}
                data-calm={calm ? "1" : undefined}
                style={{ "--i": i(), "--ac": look(author()?.avatar ?? 0).color }}
                ref={(el) => {
                  // Çevrilen kart görünür alana kayar (8 kişide liste uzun).
                  createEffect(
                    on(open, (now, was) => {
                      if (now && !was && !done())
                        el.scrollIntoView?.({ block: "nearest", behavior: calm ? "auto" : "smooth" });
                    }),
                  );
                }}
              >
                <div class="sbres__top">
                  <span class="sbcard__no">{c.no}</span>
                  <Show when={open()} fallback={<span class="sbres__who sbres__who--hidden">?</span>}>
                    <Show
                      when={c.real}
                      fallback={
                        <>
                          <Show when={author()}>
                            {(a) => <Avatar index={a().avatar} size={26} connected={a().connected} />}
                          </Show>
                          <span class="sbres__who">
                            {mineCard() ? "Sen" : (author()?.nickname ?? "?")}
                            <Show when={author() && !author()?.connected}>
                              <small class="sbres__off">bağlantı koptu</small>
                            </Show>
                          </span>
                          <span class="sbres__pts" data-zero={c.pickers.length === 0 ? "1" : undefined}>
                            +{c.pickers.length}
                          </span>
                        </>
                      }
                    >
                      <Seal small />
                      <span class="sbres__tag">Gerçek anlam</span>
                      <span class="sbres__found">
                        {c.pickers.length === 0 ? "Kimse bulamadı" : `${c.pickers.length} kişi buldu`}
                      </span>
                    </Show>
                  </Show>
                </div>
                <p class="sbres__text">{c.text}</p>
                <Show when={c.real && open() && !done()}>
                  <span class="sbres__stamp" data-art={seal ? "1" : undefined} aria-hidden="true">
                    <Show when={seal} fallback={<Seal />}>
                      <Seal label="SÖZLÜKTE" />
                    </Show>
                    <Show when={!seal}>
                      <b>SÖZLÜKTE</b>
                    </Show>
                  </span>
                  <i
                    class="sbres__ink"
                    data-art={ink ? "1" : undefined}
                    style={ink ? { "--sb-ink": `url(${ink})` } : undefined}
                    aria-hidden="true"
                  />
                </Show>
                <Show when={open() && c.pickers.length > 0}>
                  <div class="sbres__pickers">
                    <span class="sbres__lbl">{c.real ? "Bulanlar:" : "Kandırdığı:"}</span>
                    <For each={c.pickers}>
                      {(id, k) => {
                        const m = member(id);
                        return m ? (
                          <span
                            class="sbchip"
                            data-off={m.connected ? undefined : "1"}
                            data-self={id === props.selfId ? "1" : undefined}
                            style={{ "--k": k() }}
                          >
                            <Avatar index={m.avatar} size={28} connected={m.connected} />
                            <span class="sbchip__name">
                              {id === props.selfId ? "Sen" : chipName(m.nickname)}
                              <Show when={!m.connected}>
                                <small>koptu · seçimini yaptı</small>
                              </Show>
                            </span>
                          </span>
                        ) : null;
                      }}
                    </For>
                  </div>
                </Show>
                <Show when={open() && myPick() && !props.spectator}>
                  <span class="sbres__mine" data-ok={c.real ? "1" : undefined}>
                    {c.real
                      ? "✓ Senin seçimin"
                      : `Senin seçimin · Kandırıldın${author() ? ` · ${chipName(author()?.nickname ?? "")} yazdı` : ""}`}
                  </span>
                </Show>
                <Show when={stampOf()}>
                  {(m) => (
                    <span class="sbmoment" data-kind={m()}>
                      <Show when={m() === "usta"}>
                        <Quill />
                      </Show>
                      {MOMENT_TEXT[m()]}
                    </span>
                  )}
                </Show>
              </li>
            );
          }}
        </For>
      </ul>
      <Show when={!props.spectator && !props.tv}>
        <KnewButton view={props.view} now={props.now} />
      </Show>
      <p class="sr-only" aria-live="polite">
        {done() ? revealAnnouncement(final(), me()) : ""}
      </p>
    </Show>
  );
}

/**
 * "Bu kelimeyi önceden biliyordum" (SB-M7): puana etkisi yok; açılışın ilk 1,5 sn'sinden sonra etkin, geri alınabilir.
 * Anonim sayılır: kim bastığı kimseye gösterilmez.
 */
function KnewButton(props: { view: SozlukScreenView; now: () => number }) {
  const [on, setOn] = createOptimistic<boolean>(() => props.view.myKnew);
  const [ready, setReady] = createSignal(props.now() >= props.view.pickEndsAt + SOZLUK_KNEW_DELAY_MS);
  onMount(() => {
    if (ready()) return;
    onCleanup(atServerTime(props.view.pickEndsAt + SOZLUK_KNEW_DELAY_MS, () => setReady(true), props.now));
  });
  return (
    <button
      type="button"
      class="sbknew"
      aria-pressed={on()}
      disabled={!ready()}
      onClick={() => {
        unlockAudio();
        const next = !on();
        setOn(next, () => toAck(sendActionAck({ kind: "knew", on: next })));
      }}
    >
      <span class="sbknew__box" aria-hidden="true">
        {on() ? "✓" : ""}
      </span>
      Bu kelimeyi önceden biliyordum
    </button>
  );
}
