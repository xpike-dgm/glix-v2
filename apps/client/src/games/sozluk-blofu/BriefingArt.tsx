// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import "./sozluk.css";

/** Anlatım görseli: dönen sözlük küresi ve çevresinde mühürlü tanım kartları; biri mürekkep damlatır. */
export default function BriefingArt() {
  return (
    <div class="sbart" aria-hidden="true">
      <i class="sbart__orb">
        <b>?</b>
      </i>
      <i class="sbart__card" style={{ "--a": "-38deg" }} />
      <i class="sbart__card" style={{ "--a": "0deg" }} data-ink="1" />
      <i class="sbart__card" style={{ "--a": "38deg" }} />
    </div>
  );
}
