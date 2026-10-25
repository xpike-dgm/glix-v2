import { createMemo, For, Show } from "solid-js";
import { Avatar } from "./Avatar.js";
import { CheckIcon } from "./Icons.js";
import { pickerColumns } from "./playerPicker.js";
import { pressable } from "./press.js";
import "./player-picker.css";

export interface PickerPlayer {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

interface Props {
  players: readonly PickerPlayer[];
  /** Kendi kimliğin: avatarın görünür ama dokunulmaz (`allowSelf` yoksa). */
  selfId: string;
  /** Kendini de seçebil (ör. Sızma'da kendine oy serbest). */
  allowSelf?: boolean | undefined;
  /** Seçili oyuncu (halka ve tik ile işaretlenir). */
  selected?: string | null | undefined;
  /** Tüm ızgara dokunulmaz (süre doldu, izleyici). */
  disabled?: boolean | undefined;
  /** Seçim halkası rengi. */
  ring?: string | undefined;
  /** Avatarın köşesinde gösterilen sayı (ör. dağıtılan jeton); 0 ya da yok ise gösterilmez. */
  counts?: Record<string, number> | undefined;
  /** Sayı rozetinin etiketi (ekran okuyucu için). */
  countLabel?: string | undefined;
  /** "Hazır" işareti taşıyan oyuncular (örn. "Tamam" diyenler). */
  ready?: readonly string[] | undefined;
  /** Bağlantısı kopuk oyuncu da seçilebilsin mi (ör. bir sayıyı geri almak için). */
  canPick?: ((p: PickerPlayer) => boolean) | undefined;
  /** Düğme etiketi (ekran okuyucu için). */
  label: (p: PickerPlayer) => string;
  onPick: (id: string) => void;
}

/**
 * "Başka bir oyuncuyu seç" ızgarası: portreler ve adlar, kendi avatarın soluk ve dokunulmaz.
 * Ortak bileşendir (İttifak oylaması, Rüşvet ve Darbe başkan seçimi ve jeton dağıtımı).
 */
export function PlayerPicker(props: Props) {
  const cols = createMemo(() => ({
    tall: pickerColumns(props.players.length),
    wide: pickerColumns(props.players.length, true),
  }));
  const vars = () => ({
    "--cols-tall": cols().tall,
    "--rows-tall": Math.ceil(props.players.length / cols().tall),
    "--cols-wide": cols().wide,
    "--rows-wide": Math.ceil(props.players.length / cols().wide),
  });
  const pickable = (p: PickerPlayer): boolean => {
    if (props.disabled) return false;
    if (p.id === props.selfId) return props.allowSelf === true;
    if (props.canPick) return props.canPick(p);
    return p.connected;
  };
  return (
    <div class="ppick__stage">
      <div class="ppick" style={vars()}>
        <For each={props.players}>
          {(p) => {
            const picked = () => props.selected === p.id;
            const count = () => props.counts?.[p.id] ?? 0;
            const self = () => p.id === props.selfId;
            const dim = () => self() && props.allowSelf !== true;
            // Parmak dokunur dokunmaz etkinleşir; klavye/ekran okuyucu `click` ile.
            const press = pressable(() => {
              if (pickable(p)) props.onPick(p.id);
            });
            return (
              <button
                type="button"
                class="ppick__cell"
                data-picked={picked() ? "1" : undefined}
                data-self={dim() ? "1" : undefined}
                data-me={self() && props.allowSelf === true ? "1" : undefined}
                data-off={p.connected ? undefined : "1"}
                data-idle={props.disabled ? "1" : undefined}
                disabled={!pickable(p)}
                aria-pressed={picked()}
                aria-label={props.label(p)}
                onPointerDown={press.onPointerDown}
                onClick={press.onClick}
              >
                <span class="ppick__portrait">
                  <Avatar
                    index={p.avatar}
                    size="var(--pp-av)"
                    connected={p.connected}
                    self={self()}
                    ready={props.ready?.includes(p.id) === true}
                    ring={picked() ? props.ring : undefined}
                  />
                  <Show when={picked()}>
                    <span class="ppick__tick" aria-hidden="true">
                      <CheckIcon size="70%" />
                    </span>
                  </Show>
                  <Show when={count() > 0}>
                    <span class="ppick__count" role="img" aria-label={`${count()} ${props.countLabel ?? ""}`}>
                      {count()}
                    </span>
                  </Show>
                </span>
                <span class="ppick__name">{p.nickname}</span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
}
