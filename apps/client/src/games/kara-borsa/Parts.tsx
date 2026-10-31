// biome-ignore-all lint/a11y/noSvgWithoutTitle: çizimler dekoratif (aria-hidden)
import type { BorsaHintPair, PlayerInfo } from "@glix/engine";
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { CrownIcon } from "../../ui/Icons.js";
import { type BorsaBox, borsaArtExists, borsaArtSrc } from "./art.js";
import {
  type BorsaScreenView,
  hintText,
  type LedgerTile,
  ledgerTiles,
  revealOrder,
  shortName,
  signed,
} from "./view.js";

export const Coin = () => <span class="kb__coin" aria-hidden="true" />;

/**
 * Kutu. Kapalıyken tura göre sabit görsel; açılınca (`open`) kapak kalkar, içinden ışık çıkar. Açık hâlin görseli
 * (`<kutu>-acik.webp`) varsa o kullanılır; yoksa aynı kapalı görselin üst parçası kapak gibi kalkar (CSS).
 * Lanetli kutuda mor duman yayılır. `big`: Büyük Kutu (altın parıltı, büyük boy).
 */
export function Crate(props: { box: BorsaBox; open: boolean; cursed?: boolean; big?: boolean }) {
  const openArt = () => `${props.box}-acik`;
  const hasOpen = () => borsaArtExists(openArt());
  const closedSrc = () => (borsaArtExists(props.box) ? borsaArtSrc(props.box) : borsaArtSrc("kutu-antika"));
  return (
    <div
      class="kbc"
      data-open={props.open ? "1" : undefined}
      data-cursed={props.cursed ? "1" : undefined}
      data-big={props.big ? "1" : undefined}
      data-art={hasOpen() ? "1" : undefined}
      aria-hidden="true"
    >
      <span class="kbc__glow" />
      <span class="kbc__light" />
      <Show
        when={hasOpen()}
        fallback={
          <>
            <img
              class="kbc__img kbc__base"
              src={closedSrc()}
              alt=""
              draggable={false}
              width="384"
              height="384"
            />
            <img
              class="kbc__img kbc__lid"
              src={closedSrc()}
              alt=""
              draggable={false}
              width="384"
              height="384"
            />
          </>
        }
      >
        <img
          class="kbc__img kbc__closed"
          src={closedSrc()}
          alt=""
          draggable={false}
          width="384"
          height="384"
        />
        <img
          class="kbc__img kbc__opened"
          src={borsaArtSrc(openArt())}
          alt=""
          draggable={false}
          width="384"
          height="384"
        />
      </Show>
      <Show when={props.cursed && props.open}>
        <span class="kbc__smoke" />
      </Show>
    </div>
  );
}

/** Tokmak: görseli (`tokmak.webp`) varsa o, yoksa SVG çizim. */
export function Gavel() {
  return (
    <Show
      when={borsaArtExists("tokmak")}
      fallback={
        <svg class="kbg__svg" viewBox="0 0 170 130" aria-hidden="true">
          <ellipse cx="62" cy="118" rx="52" ry="9" class="kbg__shadow" />
          <rect x="18" y="100" width="88" height="16" rx="6" class="kbg__block" />
          <g class="kbg__head">
            <rect
              x="58"
              y="74"
              width="104"
              height="11"
              rx="5"
              class="kbg__handle"
              transform="rotate(-30 58 80)"
            />
            <rect x="26" y="62" width="66" height="34" rx="9" class="kbg__hammer" />
            <rect x="34" y="62" width="9" height="34" class="kbg__band" />
            <rect x="75" y="62" width="9" height="34" class="kbg__band" />
          </g>
        </svg>
      }
    >
      <img class="kbg__img" src={borsaArtSrc("tokmak")} alt="" aria-hidden="true" draggable={false} />
    </Show>
  );
}

/** Mühürlü zarf (CSS): üstünde teklifin ya da "GEÇTİM", mum mühür. */
export function Envelope(props: { amount: number | null; size?: "big" | "mini"; label?: string }) {
  const passed = () => props.amount === 0;
  return (
    <div
      class="kbe"
      data-size={props.size ?? "big"}
      data-pass={passed() ? "1" : undefined}
      data-empty={props.amount === null ? "1" : undefined}
      aria-hidden={props.size === "mini" ? "true" : undefined}
    >
      <span class="kbe__flap" />
      <Show when={props.size !== "mini"}>
        <span class="kbe__text">
          <Show when={!passed()} fallback={<b class="kbe__pass">GEÇTİM</b>}>
            <small>{props.label ?? "Teklifin"}</small>
            <b>{props.amount}</b>
          </Show>
        </span>
      </Show>
      <span class="kbe__seal" />
    </div>
  );
}

/** Sana özel ipucu kartı: ana ipucu büyük, ek ipucu altında küçük. Her ekranda aynı genişlik. */
export function HintCard(props: { hint: BorsaHintPair | null }) {
  return (
    <div class="kb__hint">
      <span class="kb__hintlabel">Sana özel ipucu</span>
      <span class="kb__hinttext">{props.hint ? hintText(props.hint.main) : "…"}</span>
      <Show when={props.hint}>{(h) => <span class="kb__hintextra">{hintText(h().extra)}</span>}</Show>
    </div>
  );
}

/**
 * Oyuncu şeridi (KB-U4): avatar, kısa ad ve tek anlamlı sayı. `coins`: teklif sırasında jeton; `profit`: kâr.
 * Kârda öndekinin avatarında küçük taç. 6+ oyuncuda iki satır (ör. 4 + 4).
 */
export function CrewStrip(props: {
  crew: PlayerInfo[];
  selfId: string;
  mode: "coins" | "profit";
  values: Record<string, number>;
  leaders: readonly string[];
  /** Teklif verenler (zarf işareti); verilmezse işaret yok. */
  sealed?: readonly string[] | undefined;
}) {
  const cols = () => {
    const n = props.crew.length;
    return n <= 5 ? n : Math.ceil(n / 2);
  };
  return (
    <section class="kb__strip" aria-label={props.mode === "coins" ? "Jetonlar" : "Kâr"}>
      <span class="kb__striplabel">{props.mode === "coins" ? "Jetonlar" : "Kâr"}</span>
      <ul class="kb__crew" style={{ "--cols": String(cols()) }}>
        <For each={props.crew}>
          {(p) => {
            const v = () => props.values[p.id] ?? 0;
            const crowned = () => props.leaders.includes(p.id);
            return (
              <li data-me={p.id === props.selfId ? "1" : undefined}>
                <span class="kb__crewav">
                  <Avatar index={p.avatar} size="var(--kb-av)" connected={p.connected} />
                  <Show when={props.sealed?.includes(p.id)}>
                    <span class="kb__sealmark" title="Teklif verdi">
                      <Envelope amount={null} size="mini" />
                    </span>
                  </Show>
                  <Show when={crowned()}>
                    <span class="kb__crown" title="En çok kâr">
                      <CrownIcon size={14} />
                    </span>
                  </Show>
                </span>
                <span class="kb__crewname">{p.id === props.selfId ? "Sen" : shortName(p.nickname)}</span>
                <span
                  class="kb__bal"
                  data-sign={
                    props.mode === "profit" ? (v() > 0 ? "up" : v() < 0 ? "down" : "zero") : undefined
                  }
                >
                  <Show when={props.mode === "coins"}>
                    <Coin />
                  </Show>
                  {props.mode === "coins" ? v() : signed(v())}
                </span>
              </li>
            );
          }}
        </For>
      </ul>
    </section>
  );
}

/**
 * Pazar defteri (KB-U5): her tur bir kutucuk. Açılmış turda değer ve alanın avatarı (lanetli kırmızı), sıradaki
 * tur yanıp söner, gelecek turlar boş. Açılmış kutucuğa dokununca o turun teklif dökümü açılır; dokununca kapanır.
 * `big`: izleyici ve jetonu biten oyuncu için büyük hâl (alanın adı ve fiyatı da yazar).
 */
export function Ledger(props: { view: BorsaScreenView; crew: PlayerInfo[]; selfId: string; big?: boolean }) {
  // Açılış sırasında bu turun sonucu defterde görünmez (değeri ele vermesin): defter yalnız teklifte çizilir.
  const tiles = createMemo(() => ledgerTiles(props.view));
  const [open, setOpen] = createSignal<number | null>(null);
  const person = (id: string | null) => props.crew.find((p) => p.id === id);
  const name = (id: string) => (id === props.selfId ? "Sen" : (person(id)?.nickname ?? "?"));
  const detail = () => {
    const i = open();
    const h = i === null ? undefined : props.view.history[i];
    return i === null || !h ? null : { i, h };
  };
  return (
    <div class="kbl" data-big={props.big ? "1" : undefined}>
      <ol class="kbl__row" aria-label="Pazar defteri">
        <For each={tiles()}>
          {(t: LedgerTile) => (
            <li>
              <button
                type="button"
                class="kbl__tile"
                data-state={t.state}
                data-cursed={t.value !== null && t.value < 0 ? "1" : undefined}
                data-big={t.big ? "1" : undefined}
                data-open={open() === t.round ? "1" : undefined}
                disabled={t.state !== "done"}
                aria-label={
                  t.state === "done"
                    ? `Tur ${t.round + 1}: değer ${t.value}${t.winner ? `, ${name(t.winner)} aldı` : ", kimse almadı"}`
                    : `Tur ${t.round + 1}`
                }
                onClick={() => setOpen((o) => (o === t.round ? null : t.round))}
              >
                <Show when={t.state !== "done" || t.big}>
                  <span class="kbl__n">{t.big ? "×2" : `T${t.round + 1}`}</span>
                </Show>
                <Show
                  when={t.state === "done"}
                  fallback={<span class="kbl__q">{t.state === "current" ? "?" : ""}</span>}
                >
                  <span class="kbl__val">{signed(t.value ?? 0).replace("+", "")}</span>
                  <Show when={person(t.winner)} fallback={<span class="kbl__none">—</span>}>
                    {(p) => (
                      <span class="kbl__who">
                        <Avatar index={p().avatar} size="var(--kbl-av)" />
                        <Show when={props.big}>
                          <span class="kbl__whoname">
                            <Coin />
                            {t.price}
                          </span>
                        </Show>
                      </span>
                    )}
                  </Show>
                </Show>
              </button>
            </li>
          )}
        </For>
      </ol>
      <Show when={detail()}>
        {(d) => (
          <button type="button" class="kbl__card" onClick={() => setOpen(null)} aria-label="Dökümü kapat">
            <span class="kbl__cardhead">
              Tur {d().i + 1} · {d().h.value < 0 ? "Lanetli" : "Değer"}{" "}
              <b data-cursed={d().h.value < 0 ? "1" : undefined}>{signed(d().h.value).replace("+", "")}</b>
            </span>
            <span class="kbl__cardlist">
              <For each={revealOrder(d().h, props.view.players).reverse()}>
                {(r) => (
                  <span class="kbl__cardrow" data-win={d().h.winner === r.id ? "1" : undefined}>
                    <span class="kbl__cardname">{name(r.id)}</span>
                    <b>{r.amount === 0 ? "geçti" : r.amount}</b>
                    <Show when={d().h.winner === r.id}>
                      <CbState kind="star" size={12} />
                    </Show>
                  </span>
                )}
              </For>
            </span>
          </button>
        )}
      </Show>
    </div>
  );
}

/** Son tur bandı: "BÜYÜK KUTU · DEĞERİ İKİ KAT". */
export const BigBand = (props: { children?: JSX.Element }) => (
  <p class="kb__band" role="status">
    {props.children ?? (
      <>
        <b>BÜYÜK KUTU</b> · DEĞERİ İKİ KAT
      </>
    )}
  </p>
);
