/** İnce lazer nişangâhı: halka, dört çentik, orta nokta. Renk `currentColor`. */
export function Sight() {
  return (
    <svg class="ca__sight-svg" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="1.6" />
      <path
        d="M50 4v22M50 74v22M4 50h22M74 50h22"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="50" cy="50" r="2.4" fill="currentColor" />
    </svg>
  );
}
