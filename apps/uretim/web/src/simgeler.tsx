/** Simge seti: 24×24, 1.75 çizgi, yuvarlak uçlu; tek renk (currentColor). Dış kaynak yok. */
import type { JSX } from "solid-js";

const P: Record<string, string> = {
  pano: "M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z",
  incele:
    "M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z",
  yukle: "M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15",
  arsiv: "M3.5 5.5h17v4h-17zM5 9.5v9A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-9M10 13h4",
  rapor: "M4 20V10M10 20V4M16 20v-7M21 20H3",
  ayar: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5",
  ara: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.6-4.6",
  kapat: "M6 6l12 12M18 6 6 18",
  onay: "M4.5 12.5l5 5 10-11",
  ret: "M7 7l10 10M17 7 7 17",
  duzeltme: "M15.5 4.5l4 4L9 19H5v-4zM13.5 6.5l4 4",
  sonraki: "M5 12h14M13 6l6 6-6 6",
  onceki: "M19 12H5M11 6l-6 6 6 6",
  geri: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  oynat: "M7 4.5v15l12.5-7.5z",
  durdur: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  adim: "M6 5v14l9-7zM18 5v14",
  ses: "M4 9.5h3.5L12 5v14l-4.5-4.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  bilgi: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5v.5",
  uyari: "M12 4 2.8 19.5h18.4zM12 10v4.5M12 17v.3",
  kalkan: "M12 3 4.5 6v6c0 4.2 3.1 7.6 7.5 9 4.4-1.4 7.5-4.8 7.5-9V6z",
  anahtar: "M14.5 9.5a4 4 0 1 0-1.2 2.8L20 19v-2.5h-2v-2h-2l-2.1-2.1",
  terminal: "M4 5h16v14H4zM7.5 9.5l3 2.5-3 2.5M12.5 15h4",
  dosya: "M6 3h8l4 4v14H6zM14 3v4h4",
  gorsel: "M4 5h16v14H4zM4 16l5-5 4 4 2.5-2.5L20 17M15.5 9.5a1.2 1.2 0 1 0 0-.01",
  liste: "M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5",
  kart: "M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5zM9 8h6M9 11.5h6",
  metin: "M5 6h14M5 10h14M5 14h9M5 18h6",
  muzik: "M9 18V5.5l11-2V16M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z",
  kopyala: "M9 9h11v11H9zM5 15H4V4h11v1",
  dis: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  menu: "M5 12h.01M12 12h.01M19 12h.01",
  arti: "M12 5v14M5 12h14",
  sil: "M4.5 7h15M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  gunes:
    "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  ay: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  cikis: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  zil: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5h4",
  paket: "M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10",
  pirilti:
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  tamam: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.8 2.8L16.5 9.5",
  saat: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  simsek: "M13 3 5 13.5h6L10 21l8-10.5h-6z",
  dama: "M4 4h8v8H4zM12 12h8v8h-8z",
  katman: "M12 4 3 9l9 5 9-5zM3 14l9 5 9-5",
  baglanti:
    "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  kod: "M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5",
  istek: "M4 6h16v10H8l-4 4zM8 10h8M8 13h5",
  sohbet: "M4 5h16v11H9l-5 4zM8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01",
  klavye: "M3 6h18v12H3zM6.5 9.5h.01M9.5 9.5h.01M12.5 9.5h.01M15.5 9.5h.01M8 14.5h8",
  yukari: "M12 19V5M6 11l6-6 6 6",
  filtre: "M4 5h16l-6 7.5V19l-4 1.5v-8z",
  tekrar: "M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5",
};

export type SimgeAdi = keyof typeof P;

export function Simge(p: {
  ad: SimgeAdi;
  boyut?: number;
  class?: string;
  style?: JSX.CSSProperties;
}): JSX.Element {
  return (
    <svg
      class={p.class}
      style={p.style}
      width={p.boyut ?? 20}
      height={p.boyut ?? 20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={P[p.ad]} />
    </svg>
  );
}
