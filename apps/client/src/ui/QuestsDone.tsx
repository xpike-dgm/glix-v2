import { Show } from "solid-js";
import { questDoneText } from "../net/questRules.js";
import { questsDone } from "../net/quests.js";
import { CoinIcon } from "./Icons.js";

/** Final ekranında görev tamamlandığında küçük satır ("Görev tamamlandı: +50 Glix"). Mesaj yoksa hiçbir şey çizilmez. */
export function QuestsDone() {
  return (
    <Show when={questsDone()}>
      {(info) => (
        <section class="qst-done rise" style={{ "--i": 5 }} role="status" aria-label="Görev tamamlandı">
          <p class="qst-done__main">
            <CoinIcon size={16} />
            {questDoneText(info())}
          </p>
          <p class="qst-done__sub">
            {info()
              .quests.map((q) => q.text)
              .join(" · ")}
          </p>
        </section>
      )}
    </Show>
  );
}
