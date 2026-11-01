import "./sozluk.css";

/**
 * Anlatım görseli (SB-U16): 4 saniyelik döngü. ŞAKUL plakası → üç kart iner → birine iki avatar uçar (kandırdı),
 * biri "SÖZLÜKTE" mührüyle damgalanır (gerçek anlam). Hareket azaltmada son kare durur.
 */
export default function BriefingArt() {
  return (
    <div class="sbart" aria-hidden="true">
      <span class="sbart__word">
        ŞAKUL <em>isim</em>
      </span>
      <span class="sbart__cards">
        <i class="sbart__card" style={{ "--n": 0 }} />
        <i class="sbart__card" style={{ "--n": 1 }} data-fooled="1">
          <b class="sbart__dot" style={{ "--d": 0 }} />
          <b class="sbart__dot" style={{ "--d": 1 }} data-alt="1" />
        </i>
        <i class="sbart__card" style={{ "--n": 2 }} data-real="1">
          <b class="sbart__seal" />
        </i>
      </span>
    </div>
  );
}
