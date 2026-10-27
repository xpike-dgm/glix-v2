import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, type JSX, on, onCleanup, Show } from "solid-js";
import type { HudInfo } from "../games/registry.js";
import { Avatar } from "./Avatar.js";
import { Clock } from "./Clock.js";
import type { ClockWindow } from "./clockState.js";
import { EyeIcon } from "./Icons.js";
import { LeaveButton } from "./LeaveButton.js";
import { MatchPath } from "./MatchPath.js";
import { roundLabel } from "./matchPath.js";
import { RotateOverlay } from "./RotateOverlay.js";
import { SoundToggle } from "./SoundToggle.js";
import { ShellContext } from "./shell.js";
import { TvBadge } from "./TvBadge.js";
import { createPortrait, lockLandscape } from "./viewport.js";
import { WorldBackdrop } from "./WorldBackdrop.js";

interface Props {
  orientation: "portrait" | "landscape";
  /** Oyuncu bu oyunu yalnız izliyor. */
  spectator: boolean;
  gameName: string;
  gameId: string;
  /** 0 tabanlı oyun sırası ve maçtaki oyun sayısı. */
  round: number;
  total: number;
  /** Kuralı gereği süresi gizli oyun: kabuk saati hiç çizilmez. */
  noClock?: boolean | undefined;
  selfId: string;
  players: PlayerInfo[];
  participants: string[];
  /** Yalnız yatay oyunlarda yan şerit için. */
  hud: HudInfo | null;
  /** Sunucu saati (ms). */
  now: () => number;
  children: JSX.Element;
}

/** "İzliyorsun" şeridi: sakin, eylem yok. */
function SpectatorRibbon() {
  return (
    <div class="ribbon" role="status">
      <EyeIcon size={16} />
      <span>İzliyorsun · sonraki oyunda katılırsın</span>
    </div>
  );
}

/** Yatay oyunun yan şeridi: çık, süre çubuğu, kendi puanın, avatarlar, ses. */
function Rail(props: Props & { win: ClockWindow | null }) {
  const crew = () => props.players.filter((p) => props.participants.includes(p.id));
  const mine = (): number => props.hud?.myScore ?? props.hud?.scores[props.selfId] ?? 0;
  return (
    <aside class="rail" aria-label="Oyun durumu">
      <div class="rail__tools">
        <LeaveButton />
        <SoundToggle />
      </div>
      <div class="rail__title">
        <span class="rail__name">{props.gameName}</span>
        <span class="rail__round">{roundLabel(props.round, props.total)}</span>
      </div>
      <div class="rail__mid">
        <Show when={props.hud}>
          {(hud) => (
            <>
              <Show when={!props.spectator}>
                <div class="rail__score">
                  <span class="overline">Puanın</span>
                  <span class="rail__num">{mine()}</span>
                </div>
              </Show>
              <div class="rail__crew">
                <For each={crew()}>
                  {(p) => (
                    <div class="hudav" data-me={p.id === props.selfId ? "1" : undefined}>
                      <Avatar index={p.avatar} size={30} connected={p.connected} />
                      <span class="hudav__score">{hud().scores[p.id] ?? 0}</span>
                    </div>
                  )}
                </For>
              </div>
            </>
          )}
        </Show>
      </div>
      <Show when={!props.noClock && props.win}>
        {(win) => (
          <div class="rail__time">
            <Clock vertical tension={!props.noClock} win={win()} now={props.now} />
          </div>
        )}
      </Show>
    </aside>
  );
}

/**
 * Oyun çerçevesi. Dikey oyun: en çok 480 px'lik ortalı sütun (ekranın kendisi), isteğe bağlı izleyici şeridi
 * ve sol üstte çık düğmesi. Yatay oyun: sahne tüm kullanılabilir alanı (güvenli alanlar hariç) doldurur,
 * yan şerit sahnenin üstüne binmez; telefon dikeyse tam ekran "yan çevir" örtüsü çıkar (oyun arkada çalışır).
 */
export function GameFrame(props: Props) {
  const portraitViewport = createPortrait();
  const landscape = () => props.orientation === "landscape";
  const needsTurn = () => landscape() && portraitViewport();
  const [reported, setReported] = createSignal<ClockWindow | null>(null);
  let owner: symbol | null = null;
  const setClock = (who: symbol, w: ClockWindow | null): void => {
    if (w) {
      owner = who;
      setReported(w);
    } else if (owner === who) {
      owner = null;
      setReported(null);
    }
  };
  // Yatay oyunlar süreyi `hud` ile bildirir; dikey oyunlar `<PhaseClock>` ile.
  const win = createMemo<ClockWindow | null>(
    () => reported() ?? (props.hud ? { ...props.hud, urgency: true } : null),
  );

  createEffect(
    on(landscape, (is) => {
      if (!is) return;
      const unlock = lockLandscape();
      onCleanup(unlock);
    }),
  );

  return (
    <ShellContext.Provider
      value={{
        setClock,
        crew: () => props.players.filter((p) => props.participants.includes(p.id)),
      }}
    >
      <div
        class="gframe"
        data-o={props.orientation}
        data-spectator={props.spectator ? "1" : undefined}
        data-turn={needsTurn() ? "1" : undefined}
      >
        <WorldBackdrop gameId={props.gameId} />
        <Show when={landscape() && !needsTurn()}>
          <Rail {...props} win={win()} />
        </Show>
        <div class="gframe__main">
          <Show when={!landscape()}>
            <header class="gbar">
              <div class="gbar__row">
                <div class="gbar__title">
                  <span class="gbar__name">{props.gameName}</span>
                  <span class="gbar__round">{roundLabel(props.round, props.total)}</span>
                  <TvBadge />
                </div>
                <div class="gbar__clock">
                  <Show when={!props.noClock}>
                    <Clock tension={!props.noClock} win={win()} now={props.now} />
                  </Show>
                </div>
                <div class="gbar__tools">
                  <SoundToggle />
                  <LeaveButton />
                </div>
              </div>
              <MatchPath round={props.round} total={props.total} />
            </header>
          </Show>
          <Show when={props.spectator && !needsTurn()}>
            <SpectatorRibbon />
          </Show>
          <div class="gframe__body">
            {/* inert: izleyici eylem düğmesine dokunamaz ve klavyeyle odaklanamaz. */}
            <div
              class="gframe__game"
              ref={(el) =>
                createEffect(() => {
                  el.inert = props.spectator || needsTurn();
                })
              }
            >
              {props.children}
            </div>
          </div>
        </div>
        <Show when={needsTurn()}>
          <RotateOverlay gameName={props.gameName} />
        </Show>
      </div>
    </ShellContext.Provider>
  );
}
