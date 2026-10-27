import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from "solid-js";
import { hapticError, hapticPress, hapticReady, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { pressable } from "../../ui/press.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import type { GameScreenProps } from "../registry.js";
import { Revolver } from "./Revolver.js";
import { bang, click, cock, lock } from "./sounds.js";
import "./rus-ruleti.css";
import { crewColumns, parseRusRuletiView, riskFraction, stageOf } from "./view.js";

const RED = "#FF3B5C";
/** Gönderilen atış sunucudan onay görmezse yerel "gönderildi" durumu bu kadar sonra düşer. */
const PENDING_MS = 1800;

export default function RusRuletiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseRusRuletiView(props.match.publicView, props.match.view));
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  onCleanup(() => clearInterval(timer));

  const stage = () => {
    const v = view();
    return v ? stageOf(v.pub, clock()) : "deciding";
  };
  const crew = createMemo(() => {
    const v = view();
    if (!v) return [];
    return v.pub.players.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [p] : [];
    });
  });
  const person = (id: string) => crew().find((p) => p.id === id);
  const nameOf = (id: string): string => (id === props.selfId ? "Sen" : (person(id)?.nickname ?? "Oyuncu"));
  const isAlive = (id: string): boolean => view()?.pub.alive.includes(id) ?? false;

  const imAlive = () => !props.spectator && view()?.priv.role === "alive";
  const iHold = () => imAlive() && view()?.pub.holder === props.selfId;
  const canAim = () => iHold() && stage() === "deciding" && !pending();

  // Seçilen hedef ve gönderim durumu: yeni atış gelince sıfırlanır.
  const [sel, setSel] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(pendingTimer));

  const aim = (id: string): void => {
    if (!canAim()) return;
    unlockAudio();
    lock();
    hapticPress();
    setSel(id);
  };
  const fire = (): void => {
    const target = sel();
    if (!canAim() || target === null) return;
    setPending(true);
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => setPending(false), PENDING_MS);
    sendAction({ kind: "shoot", target });
  };

  // Atış sonucu: ses, titreşim; ilk açılışta (sayfa yenilenince) tekrar çalmaz.
  let seenSeq: number | null = null;
  createEffect(
    on(
      () => view()?.pub.last?.seq ?? 0,
      (seq) => {
        const prev = seenSeq;
        seenSeq = seq;
        setSel(null);
        setPending(false);
        const last = untrack(view)?.pub.last;
        if (prev === null || !last || seq <= prev) return;
        if (last.exploded) {
          bang();
          if (last.target === props.selfId) hapticError();
          else hapticSolo();
        } else {
          click();
          hapticTick();
        }
      },
    ),
  );
  // Silah sana geçip pencere açılınca kısa uyarı.
  let wasAiming = false;
  createEffect(() => {
    const now = canAim() || (iHold() && stage() === "deciding");
    if (now && !wasAiming) {
      cock();
      hapticReady();
    }
    wasAiming = now;
  });

  const holderName = () => nameOf(view()?.pub.holder ?? "");
  const last = () => view()?.pub.last ?? null;

  const head = (): { text: string; tone: "boom" | "safe" | "hold" | "dim"; sub: string } => {
    const v = view();
    if (!v) return { text: "Hazırlanıyor", tone: "dim", sub: "" };
    const l = v.pub.last;
    if (v.pub.over) {
      if (imAlive()) return { text: "Hayattasın!", tone: "safe", sub: "Hayatta kalanlar +1 alır" };
      return {
        text: "Oyun bitti",
        tone: "dim",
        sub: props.spectator ? "Hayatta kalanlar +1 alır" : "Elendin, bu sefer olmadı",
      };
    }
    if (stage() === "result" && l) {
      if (l.exploded) {
        return {
          text: "BAM!",
          tone: "boom",
          sub: l.target === props.selfId ? "Elendin" : `Elendi: ${nameOf(l.target)}`,
        };
      }
      return {
        text: "Klik!",
        tone: "safe",
        sub:
          l.target === l.shooter
            ? `${nameOf(l.shooter)} kendine sıktı, boş`
            : `Boş! Sıradaki: ${nameOf(l.target)}`,
      };
    }
    if (iHold()) return { text: "Silah sende!", tone: "hold", sub: "Kendini ya da birini seç" };
    if (props.spectator)
      return { text: "Oyunu izliyorsun", tone: "dim", sub: `${holderName()} karar veriyor` };
    if (v.priv.role === "out") return { text: "Elendin", tone: "dim", sub: "Oyunun sonunu izle" };
    return { text: "Silah başkasında", tone: "dim", sub: `${holderName()} karar veriyor` };
  };

  const bar = () => {
    const v = view();
    if (!v || v.pub.deadline === null) return { from: 0, to: 1 };
    return { from: v.pub.openAt, to: v.pub.deadline };
  };
  const hit = () => {
    const l = last();
    return stage() === "result" && l?.exploded === true ? String(l.seq) : undefined;
  };
  const targetFx = (id: string): "hit" | "safe" | undefined => {
    const l = last();
    if (stage() !== "result" || !l || l.target !== id) return undefined;
    return l.exploded ? "hit" : "safe";
  };
  const footerNote = () => {
    if (props.spectator) return "Elenenler izleyici olur";
    if (stage() === "result") return "Silah el değiştiriyor…";
    if (view()?.priv.role === "out") return "Oyun bitene kadar izle";
    return "Silah sahibini bekle";
  };

  return (
    <Screen class="game rr">
      <header class="game__top">
        <Show when={view()} fallback={<div class="pbar" />}>
          <ProgressBar
            startedAt={bar().from}
            endsAt={bar().to}
            now={serverNow}
            urgency={stage() === "deciding"}
          />
        </Show>
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <div class="rr__text">
        <span class="overline">Rus Ruleti</span>
        <h2 class="rr__head" data-tone={head().tone}>
          {head().text}
        </h2>
        <p class="rr__sub" role="status">
          {head().sub}
        </p>
      </div>

      <div class="rr__stage" data-hit={hit()}>
        <div class="rr__ring" data-danger={(view()?.pub.risk ?? 0) >= 50 ? "1" : undefined}>
          <svg viewBox="0 0 120 120" aria-hidden="true" role="presentation">
            <title>Risk</title>
            <circle class="rr__track" cx="60" cy="60" r="52" />
            <circle
              class="rr__arc"
              cx="60"
              cy="60"
              r="52"
              pathLength="100"
              stroke-dasharray={`${(riskFraction(view()?.pub.risk ?? 0) * 100).toFixed(1)} 100`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div class="rr__core">
            <Revolver class="rr__gunico" part="tambur" />
            <span class="rr__pct">%{view()?.pub.risk ?? 0}</span>
            <span class="rr__cap">patlama riski</span>
          </div>
        </div>
      </div>

      <div class="rr__crew" style={{ "--cols": crewColumns(crew().length) }}>
        <For each={crew()}>
          {(p) => {
            const alive = () => isAlive(p.id);
            const aimable = () => canAim() && alive() && (p.id === props.selfId || p.connected);
            const picked = () => sel() === p.id;
            const press = pressable(() => aim(p.id));
            return (
              <button
                type="button"
                class="rr__cell"
                data-alive={alive() ? "1" : "0"}
                data-picked={picked() ? "1" : undefined}
                data-holder={view()?.pub.holder === p.id && alive() ? "1" : undefined}
                data-fx={targetFx(p.id)}
                disabled={!aimable()}
                aria-pressed={picked()}
                aria-label={`${nameOf(p.id)} hedef al`}
                onPointerDown={press.onPointerDown}
                onClick={press.onClick}
              >
                <span class="rr__portrait">
                  <Avatar
                    index={p.avatar}
                    size="var(--rr-av)"
                    mood={alive() ? undefined : "out"}
                    connected={p.connected}
                    ring={picked() ? RED : undefined}
                  />
                  <Show when={view()?.pub.holder === p.id && alive()}>
                    <span class="rr__badge">
                      <Revolver />
                    </span>
                  </Show>
                  <Show when={!alive()}>
                    <svg class="rr__x" viewBox="0 0 24 24" aria-hidden="true" role="presentation">
                      <title>Elendi</title>
                      <path d="M5 5l14 14M19 5L5 19" />
                    </svg>
                  </Show>
                  <Show when={picked()}>
                    <i class="rr__sight" aria-hidden="true" />
                  </Show>
                </span>
                <span class="rr__name">{nameOf(p.id)}</span>
              </button>
            );
          }}
        </For>
      </div>

      <footer class="rr__foot">
        <Show
          when={iHold() && stage() === "deciding"}
          fallback={
            <p class="rr__note" role="status">
              {footerNote()}
            </p>
          }
        >
          <PrimaryButton
            instant
            variant="danger"
            disabled={sel() === null || pending()}
            busy={pending()}
            reason={sel() === null ? "Bir hedef seç" : `Hedef: ${nameOf(sel() as string)}`}
            onClick={fire}
          >
            ATEŞ ET
          </PrimaryButton>
        </Show>
      </footer>
    </Screen>
  );
}
