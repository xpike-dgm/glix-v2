import { CARDS, type CardId, type MatchSnapshot, type RoomSnapshot } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap, unlockAudio } from "../fx/sound.js";
import { discardCard, pickCard } from "../net/client.js";
import { createServerNow } from "../net/time.js";
import { Avatar } from "../ui/Avatar.js";
import { CardBack, CardFace, GemMark } from "../ui/CardFace.js";
import { Clock } from "../ui/Clock.js";
import { picksLeftText, RARITY_LABEL, ROOMY_QUERY } from "../ui/cards.js";
import { CheckIcon, EyeIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { cardBackOf } from "../ui/shopArt.js";
import { createMediaQuery } from "../ui/viewport.js";
import { WorldBackdrop } from "../ui/WorldBackdrop.js";
import { playersOnly } from "./ranking.js";

/**
 * Kart seçimi (docs/KURALLAR.md K2, K3): 25 sn, gizli 3 (ya da 4) seçenek, dokununca seç. El doluyken iyi kart seçilirse
 * aynı süre içinde "hangisini atacaksın" adımı gelir. İzleyiciler ve kartı olmayanlar herkese açık "kart seçiyor" ekranını görür.
 */
export function Cards(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const mine = () => props.match.mine ?? null;
  const myBack = () => cardBackOf(props.snap.players.find((p) => p.id === props.snap.selfId)?.cosmetics);
  const pick = () => mine()?.pick ?? null;
  const crew = createMemo(() =>
    playersOnly(props.snap.players).filter((p) => props.match.participants.includes(p.id)),
  );
  const done = () => props.match.cards?.phase?.done ?? [];
  const silenced = () => props.match.cards?.phase?.silenced ?? [];
  const win = () => ({
    startedAt: props.match.phaseStartedAt,
    endsAt: props.match.phaseEndsAt ?? props.match.phaseStartedAt,
    urgency: true,
  });
  // Dokununca anında geri bildirim; sunucu seçimi onaylayana dek aynı seçenek bir daha gönderilmez.
  const [sent, setSent] = createSignal<number[]>([]);
  createEffect(
    on(
      () => pick()?.taken.length ?? 0,
      () => setSent([]),
    ),
  );
  const direct = createMediaQuery(ROOMY_QUERY);
  // İncelenen kart (dokunuldu, henüz onaylanmadı). Seçim adımı ya da kart sayısı değişince sıfırlanır.
  const [look, setLook] = createSignal<number | null>(null);
  createEffect(
    on(
      () => [state(), pick()?.taken.length ?? 0],
      () => setLook(null),
    ),
  );
  const choose = (i: number): void => {
    if (sent().includes(i)) return;
    unlockAudio();
    tap();
    hapticTap();
    setSent((s) => [...s, i]);
    pickCard(i);
  };
  const drop = (index: number | null): void => {
    unlockAudio();
    tap();
    hapticTap();
    discardCard(index);
  };
  const state = (): "watch" | "silent" | "discard" | "wait" | "pick" => {
    const p = pick();
    if (!p) return "watch";
    if (p.silenced) return "silent";
    if (p.held) return "discard";
    if (p.done) return "wait";
    return "pick";
  };
  const left = () => {
    const p = pick();
    return p ? picksLeftText(p.total, p.got.length) : "";
  };

  return (
    <>
      <WorldBackdrop gameId="lobi" />
      <Screen class="kcards">
        <header class="kc-head">
          <div class="kc-head__row">
            <LeaveButton />
            <div class="kc-head__clock">
              <Clock tension={false} win={win()} now={now} />
            </div>
            <SoundToggle />
          </div>
          <h1 class="display kc-title" aria-live="polite">
            <Show when={state() === "pick"}>{left()}</Show>
            <Show when={state() === "discard"}>Elin dolu</Show>
            <Show when={state() === "wait"}>Seçtin</Show>
            <Show when={state() === "silent"}>Bu turu kaçırdın</Show>
            <Show when={state() === "watch"}>Oyuncular kart seçiyor</Show>
          </h1>
        </header>

        <div class="kc-body" data-state={state()}>
          <Show when={state() === "pick"}>
            <Deal
              items={(pick()?.options ?? []).map((card, i) => ({
                key: i,
                id: card,
                taken: pick()?.taken.includes(i) === true,
                busy: sent().includes(i),
              }))}
              direct={direct()}
              blind={pick()?.blind === true}
              look={look()}
              back={myBack()}
              hint="Bir karta dokun"
              actLabel="Bu kartı seç"
              onLook={setLook}
              onAct={choose}
            />
          </Show>

          <Show when={state() === "discard"}>
            <Deal
              items={[
                ...(mine()?.hand ?? []).map((id, i) => ({ key: i, id, taken: false, busy: false })),
                ...(pick()?.held ? [{ key: HELD, id: pick()?.held ?? null, taken: false, busy: false }] : []),
              ]}
              direct={direct()}
              blind={false}
              look={look()}
              intro="Elin dolu. Yeni kartı almak için birini at."
              hint="Atacağın karta dokun"
              actLabel="Bu kartı at"
              newKey={HELD}
              onLook={setLook}
              onAct={(key) => drop(key === HELD ? null : key)}
            />
          </Show>

          <Show when={state() === "wait" || state() === "silent"}>
            <div class="kc-wait">
              <Show when={state() === "wait" && (pick()?.got.length ?? 0) > 0}>
                <div class="kc-deal kc-deal--got" data-mode={direct() ? "direct" : "show"}>
                  <div class="kc-deal__cards" data-n={pick()?.got.length ?? 1}>
                    <For each={pick()?.got ?? []}>{(id) => <CardFace id={id as CardId} layout="tile" />}</For>
                  </div>
                </div>
              </Show>
              <div class="kc-wait__text">
                <Show when={state() === "silent"}>
                  <p class="kc-note">Sessizlik yüzünden bu turda kart seçemezsin.</p>
                </Show>
                <Show when={state() === "wait"}>
                  <p class="kc-note kc-note--ok">
                    <CheckIcon size={18} /> Seçimin alındı
                  </p>
                </Show>
                <p class="kc-note">Diğerleri bekleniyor…</p>
              </div>
            </div>
          </Show>

          <Show when={state() === "watch"}>
            <div class="kc-wait">
              <p class="kc-note">
                <EyeIcon size={18} /> Herkes gizlice kart seçiyor. Kartlar oyun başında açıklanır.
              </p>
            </div>
          </Show>
        </div>

        <footer class="kc-foot">
          <div class="strip kc-strip" style={{ "--n": crew().length }}>
            <For each={crew()}>
              {(p) => (
                <span class="kc-who" data-done={done().includes(p.id) ? "1" : undefined}>
                  <Avatar
                    index={p.avatar}
                    size="var(--strip-av, 44px)"
                    connected={p.connected}
                    ready={done().includes(p.id)}
                    ring={done().includes(p.id) ? "#B6FF3B" : undefined}
                    class={done().includes(p.id) || silenced().includes(p.id) ? "" : "av--wait"}
                  />
                  <span class="sr-only">
                    {p.nickname}
                    {done().includes(p.id) ? " seçti" : " seçiyor"}
                  </span>
                </span>
              )}
            </For>
          </div>
          <Show when={(mine()?.hand.length ?? 0) > 0 && state() !== "discard"}>
            <div class="kc-hand">
              <span class="overline">Elin</span>
              <For each={mine()?.hand ?? []}>{(id) => <CardFace id={id} layout="mini" />}</For>
            </div>
          </Show>
        </footer>
      </Screen>
    </>
  );
}

/** Değiştirme adımında yeni kartın anahtarı (eldekiler 0, 1 …). */
const HELD = -1;

interface DealItem {
  key: number;
  /** null: kapalı kart (Kör Seçim). */
  id: CardId | null;
  /** Kumarbaz: önceden alınmış seçenek. */
  taken: boolean;
  /** Dokunuldu, sunucu onayı bekleniyor. */
  busy: boolean;
}

/**
 * Kartların kendi tasarımıyla (çerçeve + çizim + ad) yan yana gösterildiği seçim alanı; kartların çevresinde kutu yok.
 * - direct (büyük yatay ekran): açıklama kartın panelinde, tek dokunuş seçer.
 * - değilse: dokunmak kartı İNCELER (kalkar, parlar, diğerleri solar); açıklama ve "Bu kartı seç" altta / yanda çıkar.
 *   Aynı karta yeniden dokunmak da onaylar. Onaylanmadan hiçbir şey seçilmez. Kör Seçim'de incelenecek bir şey yoktur: dokunuş seçer.
 */
function Deal(props: {
  items: DealItem[];
  direct: boolean;
  blind: boolean;
  look: number | null;
  intro?: string;
  hint: string;
  actLabel: string;
  newKey?: number;
  /** Kendi kart arkası görseli (kuşanılan ya da klasik). */
  back?: string;
  onLook: (key: number | null) => void;
  onAct: (key: number) => void;
}) {
  const inspect = () => !props.direct && !props.blind;
  const mode = () => (props.direct ? "direct" : "inspect");
  const looked = () => props.items.find((it) => it.key === props.look && !it.taken) ?? null;
  const touch = (key: number): void => {
    if (!inspect() || props.look === key) {
      props.onAct(key);
      return;
    }
    tap();
    hapticTap();
    props.onLook(key);
  };
  return (
    <div class="kc-deal" data-mode={mode()} data-blind={props.blind ? "1" : undefined}>
      <Show when={props.intro && props.direct}>
        <p class="kc-note">{props.intro}</p>
      </Show>
      <div class="kc-deal__stage">
        <div class="kc-deal__cards" data-n={props.items.length} data-look={looked() ? "1" : undefined}>
          <For each={props.items}>
            {(it) => (
              <Show
                when={!it.taken}
                fallback={
                  <div class="kc-slot">
                    <CheckIcon size={20} />
                    <span>Aldın</span>
                  </div>
                }
              >
                <div
                  class="kc-deal__slot"
                  data-r={it.id ? CARDS[it.id].rarity : undefined}
                  data-on={it.busy || props.look === it.key ? "1" : undefined}
                >
                  <Show
                    when={it.id}
                    fallback={
                      <CardBack
                        src={props.back}
                        layout="tile"
                        label={`Kapalı kart ${it.key + 1}`}
                        disabled={it.busy}
                        onClick={() => touch(it.key)}
                      />
                    }
                  >
                    {(id) => (
                      <CardFace
                        id={id()}
                        layout="tile"
                        disabled={it.busy}
                        on={it.busy || props.look === it.key}
                        badge={it.key === props.newKey ? "Yeni" : undefined}
                        onClick={() => touch(it.key)}
                      />
                    )}
                  </Show>
                </div>
              </Show>
            )}
          </For>
        </div>
      </div>
      <Show when={!props.direct}>
        <div class="kc-info" aria-live="polite">
          <Show
            when={props.blind}
            fallback={
              <Show
                when={looked()?.id}
                fallback={
                  <>
                    <Show when={props.intro}>
                      <p class="kc-info__intro">{props.intro}</p>
                    </Show>
                    <p class="kc-info__hint">{props.hint}</p>
                  </>
                }
              >
                {(id) => (
                  <CardInfo id={id()} label={props.actLabel} onAct={() => props.onAct(props.look ?? 0)} />
                )}
              </Show>
            }
          >
            <p class="kc-info__hint">Kör Seçim: kartlar ters geldi, görmeden seçiyorsun. Bir karta dokun.</p>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/** İncelenen kartın açıklaması: ad, nadirlik (elmas + yazı), etiketler, metin ve onay düğmesi. */
function CardInfo(props: { id: CardId; label: string; onAct: () => void }) {
  const def = () => CARDS[props.id];
  return (
    <div class="kc-info__card" data-r={def().rarity}>
      <h2 class="kc-info__name">{def().name}</h2>
      <p class="kc-info__meta">
        <GemMark rarity={def().rarity} />
        <span class="kc-info__rar">{RARITY_LABEL[def().rarity]}</span>
        <Show when={def().attack}>
          <span class="kc-card__tag" data-k="attack">
            Saldırı
          </span>
        </Show>
        <Show when={def().hidden}>
          <span class="kc-card__tag" data-k="hidden">
            Gizli
          </span>
        </Show>
      </p>
      <p class="kc-info__text">{def().text}</p>
      <Show when={def().hidden}>
        <p class="kc-info__why">Oynayınca rakipler görmez</p>
      </Show>
      <PrimaryButton onClick={props.onAct}>{props.label}</PrimaryButton>
    </div>
  );
}
