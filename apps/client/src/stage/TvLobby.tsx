import type { RoomSnapshot } from "@glix/engine";
import { MAX_PLAYERS } from "@glix/engine";
import { createMemo, For, Show } from "solid-js";
import { inviteLink } from "../net/code.js";
import { playersOnly } from "../screens/ranking.js";
import { Avatar } from "../ui/Avatar.js";
import { QrCode } from "../ui/QrCode.js";
import { TvBoard } from "./TvParts.js";

/** Lobi: dev oda kodu, telefonların okutacağı QR ve odaya girenlerin karakterleri. */
export function TvLobby(props: { snap: RoomSnapshot }) {
  const players = createMemo(() => playersOnly(props.snap.players));
  const link = () => inviteLink(location.origin, props.snap.code);
  const host = () => location.host;
  const gameCount = () =>
    props.snap.selection.mode === "random" ? props.snap.selection.count : props.snap.gameIds.length;
  return (
    <div class="tv__cols">
      <main class="tv__join">
        <p class="tv__overline">Odaya katıl</p>
        <h1 class="tv__bigcode" aria-label={`Oda kodu ${props.snap.code.split("").join(" ")}`}>
          <For each={props.snap.code.split("")}>{(ch) => <span class="tv__bigcode-ch">{ch}</span>}</For>
        </h1>
        <div class="tv__joinrow">
          <div class="tv__qr">
            <QrCode text={link()} label="Odaya katılma QR kodu" />
          </div>
          <ol class="tv__how">
            <li>
              <b>1</b>
              <span>Telefonunun kamerasıyla QR kodu okut</span>
            </li>
            <li>
              <b>2</b>
              <span>
                ya da <em>{host()}</em> adresine girip kodu yaz
              </span>
            </li>
            <li>
              <b>3</b>
              <span>Takma adını seç, oyun başlayınca telefon kumandan olur</span>
            </li>
          </ol>
        </div>
        <Show when={gameCount() > 0}>
          <p class="tv__lead">
            Bu gece <b>{gameCount()} oyun</b> var. Oyunu ev sahibi telefonundan başlatır.
          </p>
        </Show>
      </main>
      <TvBoard
        title={`Oyuncular · ${players().length} / ${MAX_PLAYERS}`}
        hostId={props.snap.hostId}
        rows={players().map((player) => ({
          player,
          ready: props.snap.lobbyReady.includes(player.id),
          note: player.id === props.snap.hostId ? "Ev sahibi" : undefined,
        }))}
        footer={
          <Show when={players().length === 0}>
            <div class="tv__waiting">
              <Avatar index={0} size={96} connected={false} />
              <p>İlk oyuncu bekleniyor…</p>
            </div>
          </Show>
        }
      />
    </div>
  );
}
