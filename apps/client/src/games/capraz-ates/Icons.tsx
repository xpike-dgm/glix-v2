import { Match, Switch } from "solid-js";
import type { Outcome } from "./view.js";

/** Kalkan simgesi (siper). */
export function ShieldIcon(props: { size?: number }) {
  return (
    <svg
      class="cx__ico"
      viewBox="0 0 16 16"
      width={props.size ?? 14}
      height={props.size ?? 14}
      aria-hidden="true"
    >
      <path
        d="M8 1.5l5.5 2v4.2c0 3.2-2.3 5.6-5.5 6.8C4.8 13.3 2.5 10.9 2.5 7.7V3.5z"
        fill="currentColor"
        fill-opacity="0.25"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** Mermi simgesi (hazır olanlar). */
export function BulletIcon(props: { size?: number }) {
  return (
    <svg
      class="cx__ico"
      viewBox="0 0 16 16"
      width={props.size ?? 14}
      height={props.size ?? 14}
      aria-hidden="true"
    >
      <path d="M6 6.2C6 3.6 7 1.8 8 1s2 2.6 2 5.2V12H6z" fill="currentColor" />
      <rect x="5.4" y="12.6" width="5.2" height="2.4" rx="0.6" fill="currentColor" fill-opacity="0.7" />
    </svg>
  );
}

/** Kilit simgesi (ateşe hazır: nişangâh kilitlendi). */
export function LockIcon(props: { size?: number }) {
  return (
    <svg
      class="cx__ico"
      viewBox="0 0 16 16"
      width={props.size ?? 14}
      height={props.size ?? 14}
      aria-hidden="true"
    >
      <rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor" />
      <path
        d="M5.2 7V5.2a2.8 2.8 0 015.6 0V7"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
  );
}

/** Tur sonucunun küçük simgesi (puan rozetinde). */
export function OutcomeIcon(props: { outcome: Outcome }) {
  return (
    <Switch>
      <Match when={props.outcome === "cover"}>
        <ShieldIcon size={12} />
      </Match>
      <Match when={props.outcome === "clash"}>
        <svg class="cx__ico" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path
            d="M8 1l1.6 4.4L14 4l-2.6 3.8L15 10l-4.4.4L11 15 8 11.6 5 15l.4-4.6L1 10l3.6-2.2L2 4l4.4 1.4z"
            fill="currentColor"
          />
        </svg>
      </Match>
      <Match when={props.outcome === "hit"}>
        <svg class="cx__ico" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path
            d="M8 1v5l-3 2 4 2-2 5M8 6l4-2M9 10l4 1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </Match>
      <Match when={props.outcome === "free"}>
        <svg class="cx__ico" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M8 1.5l2 4.3 4.6.5-3.4 3.1 1 4.6L8 11.6 3.8 14l1-4.6L1.4 6.3 6 5.8z" fill="currentColor" />
        </svg>
      </Match>
    </Switch>
  );
}

/** Kilit nişangâhı: portrenin çevresinde ince halka ve dört çentik (yüzü örtmez). */
export function ReticleRing() {
  return (
    <svg class="cx__rring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" class="cx__rring-orbit" />
      <g class="cx__rring-ticks">
        <path d="M50 1v11M50 88v11M1 50h11M88 50h11" />
        <path d="M22 9a46 46 0 0 0-13 13M78 9a46 46 0 0 1 13 13M22 91a46 46 0 0 1-13-13M78 91a46 46 0 0 0 13-13" />
      </g>
    </svg>
  );
}
