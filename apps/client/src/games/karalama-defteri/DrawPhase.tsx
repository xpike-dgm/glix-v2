import type { PlayerInfo } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticPress } from "../../fx/haptics.js";
import { toast } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { DrawBoard } from "./DrawBoard.js";
import { DrawingCanvas } from "./DrawingCanvas.js";
import { Header } from "./Header.js";
import * as sfx from "./sounds.js";
import { type KaralamaScreenView, wallName } from "./view.js";
import { WordIntroCard } from "./WordCard.js";

interface Props {
  view: KaralamaScreenView;
  players: PlayerInfo[];
  selfId: string;
  now: () => number;
}

/** Tuval köşesindeki kalan saniye (KD-U2): son 10 sn amber, son 5 sn kırmızı (tik kabuk saatinden gelir). */
function CornerClock(props: { endsAt: number; now: () => number }) {
  const secs = () => Math.max(0, Math.ceil((props.endsAt - props.now()) / 1000));
  return (
    <span
      class="kd__corner"
      data-tone={secs() <= 5 ? "red" : secs() <= 10 ? "amber" : undefined}
      role="timer"
      aria-label={`${secs()} saniye kaldı`}
    >
      {secs()}
    </span>
  );
}

/**
 * Çizim aşaması: önce tam ekran gizli kelime kartı (KD-U1), sonra çizim tahtası (köşede süre, altta mürekkep; KD-U2,
 * KD-U8). İlk 3 sn tuvalde "Yazı yok, yalnız çizim" notu (KD-U14). "Bitti" deyince sergi bekleme ekranı (KD-U3).
 */
export function DrawPhase(props: Props) {
  const [seen, setSeen] = createSignal(false);
  // Kart yalnız çizime başlamadan önce açılır (yeniden bağlanan, çizmiş oyuncu doğrudan tahtaya döner).
  const [intro, setIntro] = createSignal(
    props.view.word !== null && !props.view.drawDone && props.view.strokes.length === 0,
  );
  const [note, setNote] = createSignal(true);
  const hideNote = setTimeout(() => setNote(false), 3_000);
  onCleanup(() => clearTimeout(hideNote));
  let warned = false;
  const onInk = (kind: "start" | "move" | "end", erase: boolean): void => {
    if (kind === "start" && !seen() && !warned) {
      warned = true;
      hapticPress([20, 40, 20]);
      toast("Önce kelimene bak");
    }
    if (kind === "move") (erase ? sfx.eraser : sfx.pencil)();
  };
  const onTool = (kind: "undo" | "clear" | "lock"): void => {
    if (kind === "undo") sfx.undoFis();
    else if (kind === "clear") sfx.crumple();
    else sfx.bookClose();
  };
  return (
    <Show
      when={!props.view.drawDone}
      fallback={<HangWait view={props.view} players={props.players} selfId={props.selfId} now={props.now} />}
    >
      <DrawBoard
        strokes={props.view.strokes}
        endsAt={props.view.drawEndsAt}
        done={props.view.drawDone}
        readyCount={props.view.drawDoneIds.length}
        total={props.view.players.length}
        header={<Header view={props.view} now={props.now} onSeen={() => setSeen(true)} />}
        now={props.now}
        ergonomic
        onInk={onInk}
        onTool={onTool}
        overlay={
          <>
            <CornerClock endsAt={props.view.drawEndsAt} now={props.now} />
            <Show when={note()}>
              <span class="kd__nowrite">Yazı yok, yalnız çizim</span>
            </Show>
          </>
        }
      />
      <Show when={intro() && props.view.word}>
        {(w) => (
          <WordIntroCard
            word={w()}
            near={props.view.near}
            onSeen={() => setSeen(true)}
            onDone={() => setIntro(false)}
          />
        )}
      </Show>
    </Show>
  );
}

/**
 * KD-U3 "Sergiye asıldı": kendi çizimin çerçeveye girip duvara asılır; diğerlerinin çerçeveleri örtülü durur, bitiren
 * her oyuncunun çerçevesi örtüsünü kapatır (içerik görünmez). Sıra oylamadaki duvarla aynı (katılım sırası).
 */
export function HangWait(props: Props) {
  const crew = createMemo(() =>
    props.view.players
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is PlayerInfo => p !== undefined),
  );
  const mine = createMemo(() => {
    const strokes = props.view.strokes;
    const last = strokes.at(-1);
    return { strokes, key: `${strokes.length}:${last?.length ?? 0}:${last?.[2] ?? 0}` };
  });
  onMount(() => sfx.pin());
  const done = () => props.view.drawDoneIds.length;
  return (
    <>
      <Header view={props.view} now={props.now} title="Sergiye asıldı" />
      <div class="kd__hang" style={{ "--n": crew().length }}>
        <For each={crew()}>
          {(p) => {
            const me = () => p.id === props.selfId;
            const ready = () => props.view.drawDoneIds.includes(p.id);
            return (
              <div
                class="kd__hangcell"
                data-me={me() ? "1" : undefined}
                data-ready={ready() ? "1" : undefined}
              >
                <div class="kd__hangframe">
                  <Show when={me()} fallback={<span class="kd__veil" aria-hidden="true" />}>
                    <DrawingCanvas strokes={mine().strokes} version={mine().key} />
                  </Show>
                </div>
                <span class="kd__hangname">
                  <Avatar index={p.avatar} size={22} connected={p.connected} ready={ready()} />
                  {me() ? "Sen" : wallName(p.nickname)}
                </span>
              </div>
            );
          }}
        </For>
      </div>
      <p class="kd__hint" role="status">
        Sergiye asıldı · {done()}/{crew().length}
      </p>
    </>
  );
}
