import { createSignal, For, onCleanup, Show } from "solid-js";
import { hapticReady } from "../../fx/haptics.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import type { AckLike } from "../../ui/optimistic.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { createWordDraft } from "../../ui/wordDraft.js";
import { hasWord } from "../../ui/wordInput.js";
import { RoleCard } from "./RoleCard.js";
import { RolePeek } from "./RolePeek.js";
import { SecretBoard } from "./SecretBoard.js";
import { dingSound } from "./sounds.js";
import { TopicCard } from "./TopicCard.js";
import { YY_PLAN } from "./timeline.js";
import { isInnocentText, type YaziYazScreenView } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";

interface Props {
  view: YaziYazScreenView;
  crew: Crew[];
  now: () => number;
  spectator: boolean;
}

/** Avatar altındaki kısa ad: en çok 7 harf (uzunsa 6 harf + "…"); ad ortadan kırpılmaz, kutudan taşmaz. */
export const shortName = (name: string): string => {
  const ch = Array.from(name);
  return ch.length > 7 ? `${ch.slice(0, 6).join("")}…` : name;
};

/** Bu cihazda rol kartı çevrilmiş oyunlar (oyunun başlangıç anıyla); ekran yeniden kurulunca kart tekrar sorulmaz. */
const seenRounds = new Set<number>();

/**
 * Yazma sahnesi: yazan ve masumun ekranı birebir aynı görünür. Rol kartı bir kez basılı tutulana kadar pano kapalıdır
 * (YY-U2); pano gizlidir (YY-U1); kimin Tamam dediği görünmez, yalnız sayı (YY-M6).
 */
export function Yazma(props: Props) {
  const draft = createWordDraft({
    server: () => props.view.myText ?? "",
    send: (text) => {
      sendAction({ kind: "write", text });
    },
    allowEmpty: false,
  });
  const [nudge, setNudge] = createSignal("");
  const [seen, setSeen] = createSignal(
    props.view.locked || props.view.myText !== null || seenRounds.has(props.view.startedAt),
  );
  const markSeen = (): void => {
    seenRounds.add(props.view.startedAt);
    setSeen(true);
  };
  const locked = () => props.view.locked;
  const secs = () => Math.max(0, Math.ceil((props.view.writeEndsAt - props.now()) / 1000));
  const [left, setLeft] = createSignal(secs());
  const timer = setInterval(() => setLeft(secs()), 250);
  onCleanup(() => clearInterval(timer));

  const lock = (): AckLike => {
    if (props.spectator || locked() || !seen()) return false;
    const text = draft.text();
    if (props.view.role === "innocent" && hasWord(text) && text !== "MASUM") {
      setNudge("Yalnız MASUM yazabilirsin");
      return false;
    }
    if (props.view.role === "writer") {
      if (!hasWord(text)) {
        setNudge("Önce kelimeni yaz");
        return false;
      }
      if (isInnocentText(text)) {
        setNudge("Yazansın, MASUM yazamazsın");
        return false;
      }
    }
    draft.flush();
    dingSound();
    hapticReady();
    return sendActionAck({ kind: "lock" });
  };

  return (
    <>
      <div class="yy__head yy__head--write">
        <span class="overline">Gizli yazı</span>
        <span class="yy__title">{props.spectator ? "Herkes yazıyor" : "Kelimeni yaz"}</span>
      </div>

      <div class="yy__mid">
        <TopicCard topic={props.view.topic} />
        <div class="yy__count" data-warn={left() <= YY_PLAN.writeWarnSec ? "1" : undefined} role="timer">
          <span class="yy__count-num">{left()}</span>
          <span class="yy__count-unit">sn</span>
        </div>
        <Show
          when={!props.spectator && props.view.role !== null}
          fallback={
            <div class="yy__sign yy__sign--idle" aria-hidden="true">
              <span>· · ·</span>
            </div>
          }
        >
          <Show
            when={seen()}
            fallback={
              <RoleCard
                role={props.view.role ?? "innocent"}
                hasTopic={props.view.topic !== null}
                onSeen={markSeen}
              />
            }
          >
            <SecretBoard
              variant="sign"
              label="Yazın"
              placeholder="Yaz…"
              value={props.view.myText ?? ""}
              locked={locked()}
              onInput={(raw) => {
                setNudge("");
                return draft.input(raw);
              }}
              onEnter={lock}
            />
            <p class="yy__nudge" data-on={nudge() ? "1" : undefined} role="status">
              {nudge() || (locked() ? "Görmek için panoya basılı tut" : "")}
            </p>
            <RolePeek role={props.view.role} hasTopic={props.view.topic !== null} />
          </Show>
        </Show>
      </div>

      <div class="yy__crewbox">
        <ul class="yy__crew" aria-label="Oyuncular">
          <For each={props.crew}>
            {(p) => (
              <li class="yy__p">
                <Avatar index={p.avatar} size="var(--yy-crew)" connected={p.connected} />
                <span class="yy__p-name">{shortName(p.nickname)}</span>
              </li>
            )}
          </For>
        </ul>
      </div>

      <TamamBar
        dots={false}
        doneLabel="Gönderildi"
        locked={locked()}
        ready={props.view.readyCount}
        readyIds={[]}
        total={props.crew.length}
        disabled={!seen()}
        spectator={props.spectator}
        onLock={lock}
      />
    </>
  );
}
