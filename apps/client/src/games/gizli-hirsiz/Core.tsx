import "./gizli-hirsiz.css";

export type CoreState = "idle" | "marked" | "solo" | "multi" | "none";

interface Props {
  state: CoreState;
  /** Çekirdek kapağı açılış animasyonunu çalıştırır (yalnız sonuç açılışında). */
  opening?: boolean;
}

/** Karanlık "güvenlik çekirdeği": halkalar, altıgen kapak ve (yalnız kendi ekranında) parmak izi. */
export function Core(props: Props) {
  return (
    <svg
      class="ghcore"
      viewBox="0 0 200 200"
      data-state={props.state}
      data-opening={props.opening ? "1" : undefined}
      aria-hidden="true"
      role="presentation"
    >
      <title>Güvenlik çekirdeği</title>
      <circle class="ghcore__ring ghcore__ring--a" cx="100" cy="100" r="94" />
      <circle class="ghcore__ring ghcore__ring--b" cx="100" cy="100" r="78" />
      <g class="ghcore__ticks">
        <path d="M100 4v14M100 182v14M4 100h14M182 100h14" />
      </g>
      <polygon class="ghcore__hex" points="100,34 157,67 157,133 100,166 43,133 43,67" />
      <g class="ghcore__lid">
        <polygon class="ghcore__plate ghcore__plate--l" points="100,40 100,160 46,129 46,71" />
        <polygon class="ghcore__plate ghcore__plate--r" points="100,40 154,71 154,129 100,160" />
      </g>
      <circle class="ghcore__eye" cx="100" cy="100" r="12" />
      <g class="ghcore__print">
        <path d="M76 118c0-16 10-28 24-28s24 12 24 28" />
        <path d="M85 121c0-10 6-18 15-18s15 8 15 18" />
        <path d="M94 124c0-4 2-7 6-7s6 3 6 7" />
        <path d="M70 106c3-14 14-24 30-24s27 10 30 24" />
      </g>
    </svg>
  );
}
