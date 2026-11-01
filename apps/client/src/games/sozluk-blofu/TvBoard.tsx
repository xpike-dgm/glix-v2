import { createSignal, For, onCleanup, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { type CrewMember, clockLevel, type SozlukScreenView } from "./view.js";

interface Props {
  view: SozlukScreenView;
  crew: CrewMember[];
  now: () => number;
}

/**
 * TV düzeni (SB-U12). Yazma: ortada büyük kelime plakası ve tür, çevresinde oyuncuların tüy kalemleri; gönderenin kalemi
 * mühürlenir ("4/6"). Seçme: bütün kartlar iki sütunda büyük numaralarla (masa birlikte okur), Tamam diyenlerin
 * avatarları köşede. Hiçbir aşamada "senin yazdığın", kart sahibi ya da kimin neyi seçtiği açılıştan önce yoktur:
 * yalnız ortak görünüm kullanılır.
 */
export function TvBoard(props: Props) {
  const v = () => props.view;
  const endsAt = () => (v().phase === "pick" ? v().pickEndsAt : v().writeEndsAt);
  const read = () => Math.max(0, Math.ceil((endsAt() - props.now()) / 1000));
  const [secs, setSecs] = createSignal(read());
  const timer = setInterval(() => setSecs(read()), 250);
  onCleanup(() => clearInterval(timer));
  const cards = () => v().cards ?? [];
  return (
    <div class="sbtv" data-phase={v().phase}>
      <div class="sbtv__top">
        <div class="sbtv__term">
          <span class="sbtv__word">{v().word}</span>
          <Show when={v().wordType}>{(t) => <em class="sbtv__type">{t()}</em>}</Show>
        </div>
        <span class="sbtv__secs" data-level={clockLevel(secs())} role="timer">
          {secs()}
        </span>
      </div>
      <Show
        when={v().phase === "pick"}
        fallback={
          <div class="sbtv__quills">
            <For each={props.crew}>
              {(m) => {
                const done = () => v().ready.includes(m.id);
                return (
                  <div class="sbtv__quill" data-done={done() ? "1" : undefined}>
                    <Avatar index={m.avatar} size={72} connected={m.connected} />
                    <span class="sbtv__name">{m.nickname}</span>
                    <span class="sbtv__pen" aria-hidden="true">
                      {done() ? "✓" : "✎"}
                    </span>
                  </div>
                );
              }}
            </For>
            <span class="sbtv__count">
              {v().ready.length}/{props.crew.length} tanım geldi
            </span>
          </div>
        }
      >
        <ul class="sbtv__cards" data-many={cards().length > 6 ? "1" : undefined}>
          <For each={cards()}>
            {(c, i) => (
              <li class="sbtv__card">
                <span class="sbtv__no">{i() + 1}</span>
                <span class="sbtv__text">{c.text}</span>
              </li>
            )}
          </For>
        </ul>
        <div class="sbtv__locked">
          <For each={props.crew.filter((m) => v().ready.includes(m.id))}>
            {(m) => <Avatar index={m.avatar} size={40} connected={m.connected} ready />}
          </For>
          <span>
            {v().ready.length}/{props.crew.length} hazır
          </span>
        </div>
      </Show>
    </div>
  );
}
