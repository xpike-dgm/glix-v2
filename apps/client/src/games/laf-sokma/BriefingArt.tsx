import "./laf.css";

/** Anlatım görseli: iki konuşma balonu karşı karşıya, ortada düello kıvılcımı. */
export default function BriefingArt() {
  return (
    <div class="lfart" aria-hidden="true">
      <i class="lfart__bubble lfart__bubble--a">
        <b />
      </i>
      <i class="lfart__vs" />
      <i class="lfart__bubble lfart__bubble--b">
        <b />
      </i>
    </div>
  );
}
