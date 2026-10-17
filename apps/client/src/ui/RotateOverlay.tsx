// biome-ignore-all lint/a11y/noSvgWithoutTitle: çizim dekoratif (aria-hidden); anlamı yanındaki metin taşır
import { LeaveButton } from "./LeaveButton.js";
import { SoundToggle } from "./SoundToggle.js";

/**
 * Yatay oyun dikey telefonda: tam ekran "Telefonunu yan çevir". Atlama yolu yok; yalnız çık ve ses düğmeleri
 * (üst köşelerde) çalışır. Çizim: dikey duran telefon yatay yatar; ekranındaki masa yatay çizilidir,
 * döndükçe dik durur. Hareket azaltılmışsa telefon baştan yatay ve durağan.
 */
export function RotateOverlay(props: { gameName: string }) {
  return (
    <div class="rot" role="alert">
      <div class="rot__top">
        <LeaveButton />
        <SoundToggle />
      </div>
      <div class="rot__body">
        <div class="rot__art" aria-hidden="true">
          <span class="rot__glow" />
          <svg class="rot__arc" viewBox="0 0 200 200" width="200" height="200">
            <defs>
              <linearGradient id="rotarc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#2EF2FF" />
                <stop offset="1" stop-color="#FF2BD6" />
              </linearGradient>
            </defs>
            <path
              d="M40 62A76 76 0 0 1 152 40"
              fill="none"
              stroke="url(#rotarc)"
              stroke-width="6"
              stroke-linecap="round"
            />
            <path
              d="M140 22l16 18-22 8"
              fill="none"
              stroke="#FF2BD6"
              stroke-width="6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg class="rot__phone" viewBox="0 0 80 140" width="80" height="140">
            <rect
              x="3"
              y="3"
              width="74"
              height="134"
              rx="14"
              fill="#0A1030"
              stroke="#2EF2FF"
              stroke-width="4"
            />
            <rect x="30" y="9" width="20" height="4" rx="2" fill="#2EF2FF" opacity="0.5" />
            <g transform="translate(40 76) rotate(-90)">
              <rect x="-52" y="-30" width="104" height="60" rx="6" fill="#050818" />
              <ellipse cx="0" cy="0" rx="34" ry="17" fill="#12286b" stroke="#2EF2FF" stroke-width="2" />
              <circle cx="0" cy="-26" r="5.5" fill="#FF2BD6" />
              <circle cx="-44" cy="0" r="5.5" fill="#FFC23B" />
              <circle cx="44" cy="0" r="5.5" fill="#B6FF3B" />
              <circle cx="0" cy="26" r="5.5" fill="#2EF2FF" />
            </g>
          </svg>
        </div>
        <h2 class="display rot__title">Telefonunu yan çevir</h2>
        <p class="lead rot__text">{props.gameName} yatay oynanır.</p>
      </div>
    </div>
  );
}
