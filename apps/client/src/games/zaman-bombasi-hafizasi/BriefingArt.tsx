import "./zaman-bombasi.css";

/** Anlatım ekranı görseli: panelde iki tuş sırayla yanar, sonra aynı sırayla basılır. */
export default function BriefingArt() {
  const pads = [
    { c: "#1fd470", d: "0s", e: "0s", idle: false },
    { c: "#ff3b5c", d: "0s", e: "0s", idle: true },
    { c: "#ffc23b", d: "0s", e: "0s", idle: true },
    { c: "#3b7bff", d: "0.7s", e: "0.4s", idle: false },
  ];
  return (
    <div class="zbart" aria-hidden="true">
      {pads.map((p) => (
        <i
          class={`zbart__pad${p.idle ? " zbart__pad--idle" : ""}`}
          style={{ "--p": p.c, "--d": p.d, "--e": p.e }}
        />
      ))}
    </div>
  );
}
