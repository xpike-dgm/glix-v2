import "./kule.css";

/** Anlatım ekranı görseli: üç blokluk kule, üstünde kayan blok (saf CSS; görsel dosyası gerekmez). */
export default function BriefingArt() {
  const blocks = [
    { l: 18, w: 64, c: "#8b5cff" },
    { l: 26, w: 50, c: "#2ef2ff" },
    { l: 31, w: 38, c: "#ff2bd6" },
  ];
  return (
    <div class="kuleart" aria-hidden="true">
      <i class="kuleart__slider" />
      {blocks.map((b, i) => (
        <i
          class="kuleart__blk"
          style={{ left: `${b.l}%`, width: `${b.w}%`, bottom: `${8 + i * 17}%`, "--c": b.c }}
        />
      ))}
    </div>
  );
}
