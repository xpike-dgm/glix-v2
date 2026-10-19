import "./yazi-yaz.css";

/** Anlatım görseli: ortada kilitli neon yazı panosu (MASUM) ve gizli kelimeli ikinci pano. */
export default function BriefingArt() {
  return (
    <div class="yyart" aria-hidden="true">
      <div class="yyart__sign">
        <span>MASUM</span>
      </div>
      <div class="yyart__sign yyart__sign--hot">
        <span>?????</span>
      </div>
      <div class="yyart__sign">
        <span>MASUM</span>
      </div>
    </div>
  );
}
