// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { hapticError, hapticReady, hapticSolo } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fail, solo as soloSound } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { GhostButton } from "../../ui/GhostButton.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { ChainLock } from "./ChainLock.js";
import { StepCard } from "./StepCard.js";
import { StepHeader } from "./StepHeader.js";
import { chainClink, laugh, paperSlide } from "./sounds.js";
import { robustPair } from "./story.js";
import type { BozukScreenView, ParsedReveal } from "./view.js";

interface Props {
  view: BozukScreenView;
  reveal: ParsedReveal;
  players: PlayerInfo[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

/**
 * Gösteri (BT-U1, BT-U5, BT-U6): zincir dikey bir hikâye akışı olarak açılır (mesajlaşma gibi, büyük kartlar,
 * otomatik kaydırma); yazılar daktiloyla, çizimler çiziliş sırasıyla gelir. Son adım görünür görünmez oylama açılır:
 * karta dokununca tam ekran büyür, oradan "😂 EN KOMİK BU". Gösteri ve oylamada yazarlar gizli; sonuçta 👑, 😂
 * yığını, yazarlar ve (varsa) sağlam zincir halkası.
 */
export function Gosteri(props: Props) {
  const r = () => props.reveal;
  const person = (id: string | null): PlayerInfo | undefined =>
    id === null ? undefined : props.players.find((p) => p.id === id);
  const result = () => r().stage === "result";

  const [sent, setSent] = createSignal<number | null>(null);
  const [zoom, setZoom] = createSignal<number | null>(null);
  createEffect(
    on(
      () => r().chain,
      () => {
        setSent(null);
        setZoom(null);
      },
    ),
  );
  createEffect(() => {
    if (r().stage !== "vote") setZoom(null);
  });
  const zoomAt = (): number => zoom() ?? 0;
  const zoomOwn = (): boolean => props.view.myStep === zoomAt();
  const myVote = () => props.view.myVote ?? sent();
  const canVote = () => !props.spectator && r().stage === "vote" && myVote() === null;
  const vote = (i: number): void => {
    if (!canVote() || i === props.view.myStep) return;
    setSent(i);
    setZoom(null);
    laugh();
    hapticReady();
    void sendActionAck({ kind: "vote", step: i }).then((ack) => {
      if (ack.ok || ack.reason === "timeout") return;
      setSent(null);
      fail();
      hapticError();
    });
  };

  // İlk görünüş (daktilo/yeniden çizim) her adım için bir kez; ekrana sonradan girilirse eski adımlar hazır gelir.
  const seen = new Set<string>();
  {
    const shown = props.reveal.steps.length;
    for (let i = 0; i < shown - 1; i++) seen.add(`${props.reveal.chain}:${i}`);
    if (props.reveal.stage === "result") seen.add(`${props.reveal.chain}:${shown - 1}`);
  }
  const freshOnce = (i: number): boolean => {
    const key = `${r().chain}:${i}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  // Akış: yeni adımda kâğıt kayması ve aşağı kaydırma; sonuçta taçlı karta kaydırma.
  let feed: HTMLDivElement | undefined;
  const scrollFeed = (to: "end" | number): void => {
    const el = feed;
    if (!el) return;
    const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth";
    requestAnimationFrame(() => {
      if (to === "end") {
        el.scrollTo({ top: el.scrollHeight, behavior });
        return;
      }
      const card = el.querySelector<HTMLElement>(`[data-i="${to}"]`);
      if (card) el.scrollTo({ top: Math.max(0, card.offsetTop - 8), behavior });
    });
  };
  createEffect(
    on(
      () => `${r().chain}:${r().steps.length}`,
      () => {
        if (!result()) {
          paperSlide();
          scrollFeed("end");
        }
      },
      { defer: true },
    ),
  );
  onMount(() => {
    const top =
      props.reveal.stage === "result" && !props.reveal.robust ? props.reveal.crowned?.[0] : undefined;
    scrollFeed(top ?? "end");
  });
  createEffect(
    on(
      () => `${r().chain}:${r().stage}`,
      () => {
        if (!result()) return;
        const top = r().crowned?.[0];
        // Sağlam zincirde halka paneli akışın sonunda: son kart ve panel görünsün; değilse taçlı karta kay.
        if (r().robust) scrollFeed("end");
        else if (top !== undefined) scrollFeed(top);
        if (r().robust) chainClink();
        else if (top !== undefined) laugh();
        else {
          soloSound();
          hapticSolo();
        }
      },
      { defer: true },
    ),
  );
  onCleanup(() => setZoom(null));

  const crowned = (i: number): boolean => result() && (r().crowned ?? []).includes(i);
  const stageStart = () => (r().stage === "show" ? r().chainStartedAt : r().voteStartsAt);
  const title = (): string => {
    if (r().stage === "show") return "Zincir açılıyor";
    if (r().stage === "vote") return "En komik hangisi?";
    return (r().crowned ?? []).length > 0 ? "En komik seçildi" : "Kimse oy vermedi";
  };
  const starter = () => person(r().starter);
  const hint = (): string => {
    if (r().stage === "show") return `${r().steps.length}/${props.view.steps}. adım · sonunda oylama`;
    if (r().stage === "vote") {
      if (props.spectator) return `${r().voted.length}/${props.view.players.length} oy verdi`;
      if (myVote() !== null) return `Oyun verildi · ${r().voted.length}/${props.view.players.length}`;
      return "En komik karta dokun, büyüt ve seç";
    }
    return r().robust ? "" : `Kahkaha puanı`;
  };
  const pair = createMemo(() => (result() && r().robust ? robustPair(r().steps) : null));

  return (
    <>
      <StepHeader
        chip={`ZİNCİR ${r().chain + 1}/${r().chains}`}
        title={title()}
        startedAt={stageStart()}
        endsAt={r().stageEndsAt}
      />
      <div class="bt__who">
        <Show
          when={result() ? starter() : undefined}
          fallback={
            <>
              <span class="bt__mask" aria-hidden="true">
                ?
              </span>
              <span class="bt__whotext">Kimin yazıp çizdiği sonda açılır</span>
            </>
          }
        >
          {(p) => (
            <>
              <Avatar index={p().avatar} size={34} connected={p().connected} />
              <span class="bt__whotext rise">
                <b>{p().id === props.selfId ? "Sen" : p().nickname}</b> başlattı
              </span>
            </>
          )}
        </Show>
      </div>
      <For each={[r().chain]}>
        {() => (
          <div class="btf" data-scroll ref={feed} data-stage={r().stage}>
            <For each={r().steps.map((_, i) => i)}>
              {(i) => {
                const step = () => r().steps[i];
                const fresh = freshOnce(i);
                return (
                  <Show when={step()}>
                    {(s) => (
                      <div class="btf__item" data-i={i}>
                        <Show when={i > 0}>
                          <span class="btf__link" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="18" height="18">
                              <path d="M12 4v14M6 12l6 6 6-6" />
                            </svg>
                            sonra şuna dönüştü
                          </span>
                        </Show>
                        <StepCard
                          step={s()}
                          index={i}
                          fresh={fresh}
                          sound={fresh}
                          author={result() ? person(s().author) : undefined}
                          mine={props.view.myStep === i}
                          crowned={crowned(i)}
                          votes={result() ? (r().tally?.[i] ?? 0) : null}
                          stamped={myVote() === i}
                          selfId={props.selfId}
                          disabled={r().stage !== "vote"}
                          onOpen={() => setZoom(i)}
                        />
                      </div>
                    )}
                  </Show>
                );
              }}
            </For>
            <Show when={pair()}>
              {(p) => (
                <div class="btf__item btf__lock">
                  <ChainLock first={p()[0]} last={p()[1]} />
                </div>
              )}
            </Show>
          </div>
        )}
      </For>
      <div class="bt__foot">
        <Show
          when={result()}
          fallback={
            <p class="bt__hint" role="status">
              {hint()}
            </p>
          }
        >
          <ul class="bt__scores" aria-label="Kahkaha puanı">
            <For each={props.view.players}>
              {(id) => {
                const p = () => person(id);
                return (
                  <li data-me={id === props.selfId ? "1" : undefined}>
                    <Show when={p()}>
                      {(pp) => <Avatar index={pp().avatar} size={28} connected={pp().connected} />}
                    </Show>
                    <b>{props.view.scores?.[id] ?? 0}</b>
                    <span class="sr-only">{p()?.nickname} kahkaha puanı</span>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>
      </div>
      <Show when={zoom() !== null ? r().steps[zoomAt()] : undefined}>
        {(s) => (
          <Portal>
            <div
              class="btz kd bt"
              role="dialog"
              aria-modal="true"
              aria-label={`${zoomAt() + 1}. adım büyütüldü`}
            >
              <div class="btz__card">
                <StepCard step={s()} index={zoomAt()} variant="big" mine={zoomOwn()} selfId={props.selfId} />
              </div>
              <div class="btz__actions">
                <GhostButton size="small" class="btz__back" onClick={() => setZoom(null)}>
                  Geri
                </GhostButton>
                <Show when={canVote()}>
                  <PrimaryButton
                    instant
                    disabled={zoomOwn()}
                    reason={zoomOwn() ? "Kendi kartına oy yok" : undefined}
                    onClick={() => vote(zoomAt())}
                  >
                    😂 EN KOMİK BU
                  </PrimaryButton>
                </Show>
              </div>
            </div>
          </Portal>
        )}
      </Show>
    </>
  );
}
