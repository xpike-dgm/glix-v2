/** Neon tabanca (yandan). `currentColor` ile boyanır. */
export function Revolver(props: { class?: string }) {
  return (
    <svg
      class={`rrgun ${props.class ?? ""}`}
      viewBox="0 0 120 76"
      fill="none"
      stroke="currentColor"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      role="presentation"
    >
      <title>Tabanca</title>
      <path d="M10 22h74l10 6h14v14H86l-8-4H10z" fill="rgba(5,8,26,.7)" />
      <circle cx="62" cy="34" r="15" fill="rgba(5,8,26,.9)" />
      <circle cx="62" cy="34" r="3" fill="currentColor" stroke="none" />
      <circle cx="62" cy="25" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="71" cy="34" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="53" cy="34" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="62" cy="43" r="2.4" fill="currentColor" stroke="none" />
      <path d="M78 46l-8 22q-1 4 4 4h10q5 0 6-4l5-26" fill="rgba(5,8,26,.7)" />
      <path d="M96 44q-8 10-18 6" />
    </svg>
  );
}
