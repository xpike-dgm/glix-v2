import { itemsOfType } from "@glix/engine";
import { For } from "solid-js";
import { render } from "solid-js/web";
import { Avatar } from "../ui/Avatar.js";
import { PlayerName } from "../ui/Cosmetic.js";

/**
 * Yalnız geliştirme: `?mock=efektler` bütün ad efektlerini ve çerçeveleri oyunun gerçek bileşenleriyle tek sayfada
 * çizer. Efekt tarifleri (MG-4) değişince görünümün aynı kaldığı bu sayfanın ekran görüntüleri karşılaştırılarak
 * denetlenir (`scripts/efekt-karsilastir.mjs`). Hareket azaltma `&motion=reduce` ile açılır.
 */
export function startEfektlerMock(): void {
  const host = document.createElement("div");
  host.className = "efekt-tablo";
  host.setAttribute(
    "style",
    "position:fixed;inset:0;z-index:50;overflow:auto;background:#05081a;padding:16px;display:flex;flex-direction:column;gap:18px",
  );
  document.body.append(host);
  const names = itemsOfType("ad-efekti");
  const frames = itemsOfType("cerceve");
  render(
    () => (
      <>
        <div data-efekt="adlar" style={{ display: "grid", gap: "10px", "justify-items": "start" }}>
          <For each={names}>
            {(it) => (
              <div style={{ display: "flex", gap: "24px", "align-items": "baseline" }}>
                <span style={{ "font-size": "18px", "font-weight": "600", color: "#e8ecff" }}>
                  <PlayerName name="Cihad Değimli" cosmetics={{ nameFx: it.id }} />
                </span>
                <span class="display" style={{ "font-size": "30px", "font-weight": "800", color: "#e8ecff" }}>
                  <PlayerName name="GLIX Usta" cosmetics={{ nameFx: it.id }} />
                </span>
              </div>
            )}
          </For>
        </div>
        <div
          data-efekt="cerceveler"
          style={{
            display: "grid",
            "grid-template-columns": "repeat(4, 120px)",
            gap: "34px 18px",
            padding: "24px",
          }}
        >
          <For each={frames}>
            {(it, i) => (
              <div style={{ display: "grid", "place-items": "center", height: "120px" }}>
                <Avatar index={i() % 8} size={80} frame={it.id} />
              </div>
            )}
          </For>
        </div>
      </>
    ),
    host,
  );
}
