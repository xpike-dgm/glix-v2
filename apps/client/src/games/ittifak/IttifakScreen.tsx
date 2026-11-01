import { ittifakMaxPromises } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { hapticError, hapticSingle, hapticTap, hapticTick } from "../../fx/haptics.js";
import { fail } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./ittifak.css";
import { type CrewMember, Pazarlik } from "./Pazarlik.js";
import { Sonuc } from "./Sonuc.js";
import { gong, lastTick, sealBreak, sealPress } from "./sounds.js";
import { parseIttifakView, TALK_URGENT_MS, togglePromise, VOTE_URGENT_MS, voteOpensAt } from "./view.js";

const LOCK = "#B6FF3B";
/** Şeride bu kadar basılı tutunca mühürler ve adlar görünür (IT-U10). */
const PEEK_HOLD_MS = 300;

export default function IttifakScreen(props: GameScreenProps) {
  const view = createMemo(() => parseIttifakView(props.match.publicView, props.match.view));
  const crew = createMemo<CrewMember[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true;
  const nameOf = (id: string) => crew().find((m) => m.id === id)?.nickname ?? "";
  // Aşama sunucudan gelir: geçişlerde sunucu yayın yapar (tick durumu değiştirir).
  const phase = () => view()?.phase ?? "talk";
  /** IT-U8: pazarlık bitince 1 sn "PAZARLIK BİTTİ · OYLAR GİZLİ" bandı; oylama ardından başlar. */
  const band = () => {
    const v = view();
    return v !== null && v.phase === "vote" && props.now() < voteOpensAt(v);
  };
  const closed = () => spectator() || phase() !== "vote" || view()?.locked === true || band();
  const maxPromises = () => ittifakMaxPromises(view()?.players.length ?? crew().length);

  const pick = createPendingPick({
    server: () => view()?.myVote ?? null,
    send: (id) => sendActionAck({ kind: "vote", target: id }),
    closed,
  });
  const chosen = () => {
    const id = pick.value();
    return id === null ? null : (crew().find((m) => m.id === id) ?? null);
  };

  // Söz işaretleri: yalnız sana görünür; dokununca hemen görünür, sunucu onaylayınca kesinleşir.
  const sameSet = (a: string[], b: string[]): boolean =>
    a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
  const [promised, setPromised] = createOptimistic<string[]>(() => view()?.myPromises ?? [], {
    equals: sameSet,
  });
  const [placedAt, setPlacedAt] = createSignal<Record<string, number>>({});
  const [note, setNote] = createSignal<"first" | "full" | null>(null);
  const [shake, setShake] = createSignal<string | null>(null);
  const [broken, setBroken] = createSignal<string | null>(null);
  let firstShown = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, fn: () => void): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });

  const promise = (id: string): void => {
    const next = togglePromise(promised(), id, maxPromises());
    if (next === null) {
      fail();
      hapticError();
      setNote("full");
      setShake(id);
      later(450, () => setShake(null));
      return;
    }
    const on = next.includes(id);
    if (on) {
      sealPress();
      hapticTap();
      setPlacedAt((m) => ({ ...m, [id]: props.now() }));
      setBroken(null);
      if (!firstShown) {
        firstShown = true;
        setNote("first");
        later(2_600, () => setNote((n) => (n === "first" ? null : n)));
      } else setNote(null);
    } else {
      sealBreak();
      hapticSingle();
      setBroken(id);
      later(700, () => setBroken((b) => (b === id ? null : b)));
      setNote(null);
    }
    setPromised(next, () => sendActionAck({ kind: "promise", target: id, on }));
  };

  // IT-U10: şerit basılı tutulunca mühürler ve adlar tam görünür.
  const [peek, setPeek] = createSignal(false);
  let peekTimer: ReturnType<typeof setTimeout> | undefined;
  const peekStart = (): void => {
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => setPeek(true), PEEK_HOLD_MS);
  };
  const peekEnd = (): void => {
    clearTimeout(peekTimer);
    setPeek(false);
  };
  onCleanup(() => clearTimeout(peekTimer));

  const talkLeft = () => Math.max(0, (view()?.talkEndsAt ?? 0) - props.now());
  const talkUrgent = () => phase() === "talk" && talkLeft() <= TALK_URGENT_MS;
  const voteLeft = () => Math.max(0, (view()?.voteEndsAt ?? 0) - props.now());
  const voteUrgent = () => phase() === "vote" && !band() && voteLeft() <= VOTE_URGENT_MS;

  // IT-U8: son 10 sn (pazarlık) ve son 5 sn (oylama) her saniye tik; bant gongla açılır.
  createEffect(
    on(
      () => (talkUrgent() ? Math.ceil(talkLeft() / 1000) : voteUrgent() ? Math.ceil(voteLeft() / 1000) : 0),
      (sec, prev) => {
        if (sec > 0 && prev !== undefined && sec !== prev) lastTick();
      },
    ),
  );
  let buzzed = false;
  createEffect(() => {
    if (!voteUrgent() || buzzed || spectator() || view()?.locked === true) return;
    buzzed = true;
    hapticTick();
  });
  createEffect(
    on(band, (on, prev) => {
      if (on && prev === false) gong();
    }),
  );

  // IT-U11: geri dönen oyuncuya kısa not.
  const [back, setBack] = createSignal<string | null>(null);
  onMount(() => {
    const v = view();
    if (!v || spectator() || v.reveal || props.now() - v.startedAt < 4_000) return;
    // Geliştirme önizlemesi oyunun ortasında açılır: not yalnız `&back=1` ile gösterilir.
    if (import.meta.env.DEV && /[?&]mock=/.test(location.search) && !/[?&]back=1/.test(location.search))
      return;
    const left = Math.ceil(
      Math.max(0, (v.phase === "talk" ? v.talkEndsAt : v.voteEndsAt) - props.now()) / 1000,
    );
    const marks = v.phase === "talk" && v.myPromises.length > 0 ? " · söz işaretlerin duruyor" : "";
    setBack(`Döndün · ${left} sn kaldı${marks}`);
    later(3_500, () => setBack(null));
  });

  const bar = () => {
    const v = view();
    if (!v) return { from: 0, to: 1, urgency: false };
    if (v.reveal) return { from: v.voteEndsAt, to: v.finishAt, urgency: false };
    if (v.phase === "vote") return { from: voteOpensAt(v), to: v.voteEndsAt, urgency: true };
    return { from: v.startedAt, to: v.talkEndsAt, urgency: false };
  };

  const strip = () => {
    const n = promised().length;
    if (note() === "full") return `Önce bir sözü geri al · en çok ${maxPromises()} söz`;
    if (note() === "first") return "Tekrar dokun: sözü geri al";
    if (n === 0) return "Portreye dokun: gizli söz işareti";
    if (peek()) return `Söz verdiklerin: ${promised().map(nameOf).join(" · ")}`;
    return `Sözlerin: ${n} · görmek için basılı tut`;
  };
  const voteStatus = () => {
    const v = view();
    if (!v) return "";
    if (v.locked) return `Mühürlendi · ${v.ready.length}/${crew().length} hazır`;
    const c = chosen();
    if (c) return `Oyun: ${c.nickname} · değiştirebilirsin`;
    return voteUrgent() ? "Oy vermezsen zar atılacak 🎲" : "Bir portreye dokun";
  };
  const sealers = () => crew().filter((m) => view()?.ready.includes(m.id));

  return (
    <Screen class={`game it it--${phase()}`}>
      <Show when={view()}>
        <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency={bar().urgency} />
      </Show>

      <Show when={view()}>
        {(v) => (
          <Show
            when={v().reveal}
            fallback={
              <Show
                when={v().phase === "vote"}
                fallback={
                  <div class="it__body" data-urgent={talkUrgent() ? "1" : undefined}>
                    <div class="it__head">
                      <span class="overline">{talkUrgent() ? "sözler kilitleniyor" : "Pazarlık zamanı"}</span>
                      <span class="it__title">{talkUrgent() ? "Son 10 saniye" : "Oy iste, söz ver"}</span>
                    </div>
                    <Pazarlik
                      crew={crew()}
                      selfId={props.selfId}
                      endsAt={v().talkEndsAt}
                      now={props.now}
                      clock={props.now}
                      ready={v().ready}
                      promised={spectator() ? [] : promised()}
                      placedAt={placedAt()}
                      peek={peek()}
                      shake={shake()}
                      broken={broken()}
                      {...(spectator() ? {} : { onPromise: promise })}
                    />
                    <div class="it__side">
                      <Show
                        when={!spectator()}
                        fallback={
                          <p class="it__hint" role="status">
                            Oylamaya hazır: {v().ready.length}/{crew().length}
                          </p>
                        }
                      >
                        <button
                          type="button"
                          class="it__strip"
                          data-note={note() ?? undefined}
                          data-peek={peek() ? "1" : undefined}
                          aria-live="polite"
                          onPointerDown={peekStart}
                          onPointerUp={peekEnd}
                          onPointerLeave={peekEnd}
                          onPointerCancel={peekEnd}
                          onContextMenu={(e) => e.preventDefault()}
                          onClick={(e) => {
                            // Klavye/ekran okuyucu: basılı tutamaz; 3 sn göster.
                            if (e.detail !== 0) return;
                            setPeek(true);
                            later(3_000, () => setPeek(false));
                          }}
                        >
                          {strip()}
                        </button>
                      </Show>
                      <TamamBar
                        locked={v().locked}
                        ready={v().ready.length}
                        readyIds={v().ready}
                        total={crew().length}
                        spectator={spectator()}
                        label="Oylamaya geç"
                        doneLabel="Hazırsın"
                        onLock={() => sendActionAck({ kind: "skip" })}
                      />
                    </div>
                  </div>
                }
              >
                <div class="it__body it__body--vote" data-urgent={voteUrgent() ? "1" : undefined}>
                  <div class="it__head">
                    <span class="overline">{spectator() ? "Gizli oylama" : "Gizli oyun"}</span>
                    <Show
                      when={!spectator()}
                      fallback={
                        <>
                          <span class="it__title">Oylar mühürleniyor</span>
                          <span class="it__status">
                            {v().ready.length}/{crew().length} mühürledi
                          </span>
                        </>
                      }
                    >
                      <Show when={chosen()} fallback={<span class="it__title">Kime oy veriyorsun?</span>}>
                        {(p) => (
                          <span
                            class="it__title it__title--locked"
                            style={{ "--tc": look(p().avatar).color }}
                          >
                            {p().nickname}
                          </span>
                        )}
                      </Show>
                      <span class="it__status" data-warn={voteUrgent() && !chosen() ? "1" : undefined}>
                        {voteStatus()}
                      </span>
                    </Show>
                  </div>
                  <Show
                    when={!spectator()}
                    fallback={
                      <div class="it__sealers">
                        <For each={sealers()}>{(m) => <Avatar index={m.avatar} size={44} />}</For>
                      </div>
                    }
                  >
                    <div class="it__pick">
                      <PlayerPicker
                        players={crew()}
                        selfId={props.selfId}
                        selected={pick.value()}
                        disabled={closed()}
                        ring={LOCK}
                        // IT-M2: kopan katılımcıya da oy verilebilir (portresi soluk ama seçilebilir).
                        canPick={() => true}
                        label={(p) =>
                          `${p.nickname} adlı oyuncuya oy ver${p.connected ? "" : " (bağlantı yok)"}`
                        }
                        ready={v().ready}
                        onPick={(id) => pick.pick(id)}
                      />
                    </div>
                  </Show>
                  <div class="it__side">
                    <TamamBar
                      locked={v().locked}
                      ready={v().ready.length}
                      readyIds={v().ready}
                      total={crew().length}
                      disabled={pick.value() === null || band()}
                      spectator={spectator()}
                      doneLabel="Mühürlendi"
                      onLock={() => sendActionAck({ kind: "lock" })}
                    />
                  </div>
                  <Show when={band()}>
                    <div class="it__band" role="status">
                      <b>PAZARLIK BİTTİ</b>
                      <span>OYLAR GİZLİ</span>
                    </div>
                  </Show>
                </div>
              </Show>
            }
          >
            <Sonuc
              view={v()}
              crew={crew()}
              selfId={props.selfId}
              spectator={spectator()}
              now={props.now}
              comment={props.match.comment ?? null}
            />
          </Show>
        )}
      </Show>
      <Show when={back()}>
        {(t) => (
          <p class="it__back" role="status">
            {t()}
          </p>
        )}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
