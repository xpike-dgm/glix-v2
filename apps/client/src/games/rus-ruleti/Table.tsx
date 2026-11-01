import type { PlayerInfo, RusRuletiPublicView } from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { ruletProp } from "../../ui/props.js";
import { cxArtSrc, hasArt } from "../capraz-ates/art.js";
import { LockIcon, PlugIcon } from "./icons.js";
import { Revolver } from "./Revolver.js";
import { aimAngle, type RusRuletiStage, riskFraction, type SeatPos, shortName } from "./view.js";

/** Koltuğun dokunma durumu: `on` hedeflenebilir/seçilebilir, `lock` RR-M1 kilidi, `off` dokunulmaz. */
export type SeatMode = "on" | "lock" | "off";

interface Props {
  pub: RusRuletiPublicView;
  stage: RusRuletiStage;
  seats: SeatPos[];
  playerOf: (id: string) => PlayerInfo | undefined;
  /** Koltuk altındaki ad (kendin "Sen"). */
  label: (id: string) => string;
  /** Halkanın gösterdiği risk (RR-U5: dönüşte atışın riski). */
  risk: number;
  /** Sahibin yerel nişanı (yalnız kendi ekranında); yoksa null. */
  aim: string | null;
  /** Avatar boyu (CSS uzunluğu). */
  size: string;
  mode?: (id: string) => SeatMode;
  onTap?: (id: string) => void;
  /** Son 5 sn (RR-U9): halka kenarı titrer. */
  urgent?: boolean;
  tv?: boolean;
}

/**
 * RR-U1 masa sahnesi: oyuncular oval masanın çevresinde, ortada tabanca (namlu sahibine, nişanda hedefe, atışta
 * vurulana döner; sahibin önüne kayar) ve tabancanın altında küçük risk halkası. Telefon ve TV aynı masayı çizer.
 */
export function Table(props: Props) {
  const seatOf = (id: string) => props.seats.find((s) => s.id === id);
  const shotLive = () => props.stage === "spin" || props.stage === "result";
  const last = () => props.pub.last;
  /** Namlunun baktığı oyuncu. */
  const facing = (): string | null => {
    const l = last();
    if (shotLive() && l) return l.target;
    if (props.stage === "lastWord" || props.stage === "over") return null;
    return props.aim ?? props.pub.holder;
  };
  /** Tabanca sahibinin önünde durur (el değiştirince kayar; RR-U7). */
  const gunAt = () => {
    const owner = shotLive() ? last()?.shooter : props.stage === "lastWord" ? undefined : props.pub.holder;
    const seat = owner ? seatOf(owner) : undefined;
    // Tabanca masanın ortasında, halkanın üstünde; sahibine doğru biraz kayar.
    const k = props.seats.length >= 7 ? 0.1 : 0.13;
    return seat ? { x: 50 + (seat.x - 50) * k, y: 36 + (seat.y - 50) * k } : { x: 50, y: 36 };
  };
  const top = ruletProp("tabanca-ust");
  /** Görsel açı: üstten tabancanın namlusu yukarı; yandan tabancanın namlusu sol-üste bakar (sağa dönükken aynalanır). */
  const gunTransform = () => {
    const id = facing();
    const deg = aimAngle(id ? seatOf(id) : undefined);
    if (top) return `rotate(${deg + 90}deg)`;
    const right = Math.cos((deg * Math.PI) / 180) > 0;
    return right ? `rotate(${deg + 20}deg) scaleX(-1)` : `rotate(${deg - 200}deg)`;
  };
  const fx = (id: string): "hit" | "safe" | undefined => {
    const l = last();
    if (props.stage !== "result" || !l || l.target !== id) return undefined;
    return l.exploded ? "hit" : "safe";
  };
  const boom = () => props.stage === "result" && last()?.exploded === true;

  return (
    <div
      class="rrt"
      data-tv={props.tv ? "1" : undefined}
      data-n={props.seats.length}
      data-stage={props.stage}
      data-boom={boom() ? String(last()?.seq ?? 0) : undefined}
    >
      <div class="rrt__felt" aria-hidden="true" />
      <Show when={props.stage !== "over"}>
        <div
          class="rrt__mid"
          data-danger={props.risk >= 56 ? "1" : undefined}
          data-urgent={props.urgent ? "1" : undefined}
        >
          <svg class="rrt__ring" viewBox="0 0 120 120" aria-hidden="true">
            <title>Risk</title>
            <circle class="rr__track" cx="60" cy="60" r="52" />
            <circle
              class="rr__arc"
              cx="60"
              cy="60"
              r="52"
              pathLength="100"
              stroke-dasharray={`${(riskFraction(props.risk) * 100).toFixed(1)} 100`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <Revolver class="rrt__drum" part="tambur" />
          <span class="rrt__pct">
            <Show when={props.stage !== "spin"} fallback={<span class="rrt__dots">…</span>}>
              %{props.risk}
            </Show>
          </span>
          <span class="sr-only">Patlama riski yüzde {props.risk}</span>
        </div>
        <Show when={props.stage !== "lastWord"}>
          <div class="rrt__gun" style={{ left: `${gunAt().x}%`, top: `${gunAt().y}%` }} aria-hidden="true">
            <img
              class="rrt__gunimg"
              src={top ?? "/assets/props/rus-ruleti/tabanca.webp"}
              alt=""
              draggable={false}
              style={{ transform: gunTransform() }}
            />
            <Show when={boom() && hasArt("namlu-atesi")}>
              <img class="rrt__muzzle" src={cxArtSrc("namlu-atesi")} alt="" />
            </Show>
          </div>
        </Show>
      </Show>
      <For each={props.seats}>
        {(s) => {
          const p = () => props.playerOf(s.id);
          const alive = () => props.pub.alive.includes(s.id);
          const holder = () =>
            props.stage !== "over" && props.stage !== "lastWord" && props.pub.holder === s.id && alive();
          const m = (): SeatMode => props.mode?.(s.id) ?? "off";
          const picked = () => props.aim === s.id;
          const off = () => p()?.connected === false;
          return (
            <button
              type="button"
              class="rrt__seat"
              style={{ left: `${s.x}%`, top: `${s.y}%`, "--av": props.size }}
              data-alive={alive() ? "1" : "0"}
              data-holder={holder() ? "1" : undefined}
              data-picked={picked() ? "1" : undefined}
              data-mode={m()}
              data-fx={fx(s.id)}
              data-off={off() ? "1" : undefined}
              disabled={m() !== "on"}
              aria-pressed={picked()}
              aria-label={`${props.label(s.id)}, ${alive() ? "hayatta" : "elendi"}${m() === "lock" ? ", az önce sana sıktı" : ""}${off() ? ", bağlı değil" : ""}`}
              onClick={() => props.onTap?.(s.id)}
            >
              <span class="rrt__av">
                <Avatar
                  index={p()?.avatar ?? 0}
                  size="var(--av)"
                  mood={alive() ? undefined : "out"}
                  connected={!off()}
                  ring={picked() ? "#FF3B5C" : holder() ? "var(--amber)" : undefined}
                />
                <Show when={!alive()}>
                  <svg class="rrt__x" viewBox="0 0 24 24" aria-hidden="true">
                    <title>Elendi</title>
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                </Show>
                <Show when={fx(s.id) === "hit"}>
                  <Show when={hasArt("cam-catlagi")} fallback={<i class="rrt__crack" aria-hidden="true" />}>
                    <img class="rrt__crackimg" src={cxArtSrc("cam-catlagi")} alt="" aria-hidden="true" />
                  </Show>
                  <span class="rrt__stamp" aria-hidden="true">
                    ELENDİ
                  </span>
                </Show>
                <Show when={fx(s.id) === "safe"}>
                  <span class="rrt__ok" aria-hidden="true">
                    ✓
                  </span>
                </Show>
                <Show when={m() === "lock"}>
                  <span class="rrt__lock" aria-hidden="true">
                    <LockIcon />
                  </span>
                </Show>
                <Show when={off() && alive()}>
                  <span class="rrt__plug" aria-hidden="true">
                    <PlugIcon />
                  </span>
                </Show>
                <Show when={picked()}>
                  <i class="rrt__sight" aria-hidden="true" />
                </Show>
              </span>
              <span class="rrt__name">{shortName(props.label(s.id))}</span>
              <Show when={m() === "lock"}>
                <span class="rrt__why">Az önce sana sıktı</span>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}
