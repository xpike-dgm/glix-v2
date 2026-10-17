import type { PlayerInfo } from "@glix/engine";
import { createEffect, For, type JSX, on, onCleanup, Show } from "solid-js";
import type { HudInfo } from "../games/registry.js";
import { Avatar } from "./Avatar.js";
import { EyeIcon } from "./Icons.js";
import { LeaveButton } from "./LeaveButton.js";
import { ProgressBar } from "./ProgressBar.js";
import { RotateOverlay } from "./RotateOverlay.js";
import { SoundToggle } from "./SoundToggle.js";
import { createPortrait, lockLandscape } from "./viewport.js";

interface Props {
  orientation: "portrait" | "landscape";
  /** Oyuncu bu oyunu yalnız izliyor. */
  spectator: boolean;
  gameName: string;
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
      <span>İzliyorsun — sonraki oyuna katılacaksın</span>
    </div>
  );
}

/** Yatay oyunun yan şeridi: çık, süre çubuğu, kendi puanın, avatarlar, ses. */
function Rail(props: Props) {
  const crew = () => props.players.filter((p) => props.participants.includes(p.id));
  const mine = (): number => props.hud?.myScore ?? props.hud?.scores[props.selfId] ?? 0;
  return (
    <aside class="rail" aria-label="Oyun durumu">
      <LeaveButton />
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
      <SoundToggle />
      <Show when={props.hud}>
        {(hud) => (
          <ProgressBar
            vertical
            class="rail__time"
            startedAt={hud().startedAt}
            endsAt={hud().endsAt}
            now={props.now}
            urgency
          />
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

  createEffect(
    on(landscape, (is) => {
      if (!is) return;
      const unlock = lockLandscape();
      onCleanup(unlock);
    }),
  );

  return (
    <div
      class="gframe"
      data-o={props.orientation}
      data-spectator={props.spectator ? "1" : undefined}
      data-turn={needsTurn() ? "1" : undefined}
    >
      <Show when={landscape() && !needsTurn()}>
        <Rail {...props} />
      </Show>
      <div class="gframe__main">
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
          <Show when={!landscape()}>
            <div class="gframe__chrome">
              <div class="gframe__row">
                <LeaveButton />
                {/* İzleyicide oyunun kendi ses düğmesi inert olur; aynı yerde bu çalışır. */}
                <Show when={props.spectator} fallback={<span />}>
                  <SoundToggle />
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
      <Show when={needsTurn()}>
        <RotateOverlay gameName={props.gameName} />
      </Show>
    </div>
  );
}
