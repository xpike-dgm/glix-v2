import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { HintLine, TopicCard } from "./TopicCard.js";
import { YY_PLAN } from "./timeline.js";
import { ringPosition, type YaziYazScreenView } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";

interface Props {
  view: YaziYazScreenView;
  crew: Crew[];
  now: () => number;
}

const TITLE = {
  write: "Herkes yazıyor",
  talk: "Yazanlar kim?",
  guess: "Tahmin ediyorlar",
  reveal: "",
} as const;
const OVER = { write: "Gizli yazı", talk: "Sözlü tartışma", guess: "Tahmin zamanı", reveal: "" } as const;

/**
 * TV düzeni (YY-U7): solda konu kartı, büyük saat ve (tartışmadan itibaren) harf ipucu; sağda oyuncu halkası. Yazmada
 * kimin Tamam dediği görünmez (YY-M6), yalnız sayı; tartışma ve tahminde hazır olanlar işaretlenir.
 */
export function TvBoard(props: Props) {
  const v = () => props.view;
  const endsAt = () =>
    v().stage === "write" ? v().writeEndsAt : v().stage === "talk" ? v().talkEndsAt : v().guessEndsAt;
  const secs = () => Math.max(0, Math.ceil((endsAt() - props.now()) / 1000));
  const [left, setLeft] = createSignal(secs());
  const timer = setInterval(() => setLeft(secs()), 250);
  onCleanup(() => clearInterval(timer));
  const pos = createMemo(() => props.crew.map((_, i) => ringPosition(i, props.crew.length, 40)));
  const warn = () =>
    left() > 0 && left() <= (v().stage === "talk" ? YY_PLAN.talkWarnSec : YY_PLAN.writeWarnSec);
  const showReady = () => v().stage !== "write";
  return (
    <div class="yytvb">
      <div class="yytvb__side">
        <span class="overline">{OVER[v().stage]}</span>
        <span class="yytvb__title">{TITLE[v().stage]}</span>
        <TopicCard topic={v().topic} />
        <div class="yytvb__clock" data-warn={warn() ? "1" : undefined} role="timer">
          <span class="yytvb__num">{left()}</span>
          <span class="yytvb__unit">saniye</span>
        </div>
        <Show when={v().stage !== "write"}>
          <HintLine topic={null} letters={v().letters} />
        </Show>
        <span class="yytvb__ready">
          {v().readyCount}/{props.crew.length} hazır
        </span>
      </div>
      <div class="yytvb__ring" data-warn={v().stage === "talk" && warn() ? "1" : undefined}>
        <For each={props.crew}>
          {(m, i) => (
            <div
              class="yytvb__node"
              style={{ left: `${pos()[i()]?.x ?? 50}%`, top: `${pos()[i()]?.y ?? 50}%` }}
            >
              <span class="yy__pulse">
                <Avatar
                  index={m.avatar}
                  size={104}
                  connected={m.connected}
                  ready={showReady() && v().ready.includes(m.id)}
                />
              </span>
              <span class="yytvb__name">{m.nickname}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
