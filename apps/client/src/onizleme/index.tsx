/**
 * Önizleme sayfası (UM-U4, MG-6): Üretim Merkezi bir teslimin taslak dosyalarını ve katalog satırını gönderir; sayfa
 * onları oyunun GERÇEK bileşenleriyle (mağaza kartı, lobi, sonuç sıralaması, kürsü, final, kart eli, mağaza
 * vitrini) çizer. Protokol `protocol.ts`, sözleşme `docs/uretim/SOZLESME.md` bölüm 4.
 *
 * Kurallar: sayfa yalnız iframe içinde ve yalnız izinli kaynaktan gelen iletiyle çalışır; sunucu `frame-ancestors`
 * ile gömmeyi sınırlar. Hizmet çalışanı kaydedilmez, ağa (oyun sunucusuna) bağlanılmaz; taslak dosyalar yalnız
 * bellekte (`assetOverride.ts`) ve önizleme katmanında (`setPreviewItems`) tutulur.
 */
import {
  type CosmeticItem,
  type Cosmetics,
  cosmeticType,
  type PlayerInfo,
  setPreviewItems,
  shopCollections,
} from "@glix/engine";
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js";
import { render } from "solid-js/web";
import { resetCharacterCache } from "../character/kit.js";
import { useMockSender } from "../net/client.js";
import { freezeShop } from "../net/shop.js";
import { setState, state } from "../net/store.js";
import { Briefing } from "../screens/Briefing.js";
import { Cards } from "../screens/Cards.js";
import { Countdown } from "../screens/Countdown.js";
import { Final } from "../screens/Final.js";
import { Lobby } from "../screens/Lobby.js";
import { Playing } from "../screens/Playing.js";
import { Results } from "../screens/Results.js";
import { selectScreen } from "../screens/route.js";
import { Card, Shop } from "../screens/Shop.js";
import { applyRootSettings } from "../settings/settings.js";
import { hasOverrideUnder, setAssetOverrides } from "../ui/assetOverride.js";
import { Toasts } from "../ui/Toast.js";
import {
  originAllowed,
  PREVIEW_PROTOCOL_VERSION,
  type PreviewRequest,
  parsePreviewMessage,
  screenFits,
  URETIM_ORIGIN,
} from "./protocol.js";
import "../fonts.js";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/ui.css";
import "../styles/screens.css";
import "../styles/lobby.css";
import "../styles/game.css";
import "../styles/frame.css";
import "../styles/settings.css";
import "../styles/profile.css";
import "../styles/badges.css";
import "../styles/leaderboard.css";
import "../styles/colorblind.css";
import "../styles/cards.css";
import "../styles/result.css";
import "../styles/cosmetics.css";
import "../styles/effects.css";
import "../styles/shop.css";
import "../styles/quests.css";
import "../styles/character.css";

applyRootSettings();

const MOCK_ACCOUNT = { username: "cihad_01", email: "onizleme@glix.invalid" };

/** Üst pencerenin kaynağı (ileti göndermek için): canlıda sabit, yerelde gömenin kaynağı. */
function parentOrigin(): string | null {
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return URETIM_ORIGIN;
  const ancestors = window.location.ancestorOrigins;
  const fromAncestors = ancestors && ancestors.length > 0 ? ancestors[0] : undefined;
  let fromReferrer: string | undefined;
  try {
    fromReferrer = document.referrer ? new URL(document.referrer).origin : undefined;
  } catch {
    fromReferrer = undefined;
  }
  const o = fromAncestors ?? fromReferrer;
  return o && originAllowed(o, host) ? o : null;
}

function post(msg: Record<string, unknown>): void {
  const target = parentOrigin();
  if (target && window.parent !== window) window.parent.postMessage(msg, target);
}

/** Ürünün kuşanılmış hâli (türün `Cosmetics` anahtarıyla). */
function wearing(item: CosmeticItem): Cosmetics {
  const key = cosmeticType(item.type).key;
  return key ? ({ [key]: item.id } as Cosmetics) : {};
}

const [view, setView] = createSignal<{ req: PreviewRequest; key: number } | null>(null);
const [note, setNote] = createSignal<string | null>(null);
let seq = 0;

/** Lobi/sonuç/final gibi oda ekranları: oyunun ekran seçicisiyle (App ile aynı kural). */
function RoomScreens() {
  const screen = () => selectScreen({ snapshot: state.snapshot, nav: "home", notFound: false });
  return (
    <Show when={state.snapshot}>
      {(snap) => (
        <Switch>
          <Match when={screen() === "lobby"}>
            <Lobby snap={snap()} />
          </Match>
          <Match when={screen() === "final"}>
            <Final snap={snap()} />
          </Match>
          <Match when={snap().match}>
            {(match) => (
              <Switch>
                <Match when={screen() === "briefing"}>
                  <Briefing snap={snap()} match={match()} />
                </Match>
                <Match when={screen() === "countdown"}>
                  <Countdown snap={snap()} match={match()} />
                </Match>
                <Match when={screen() === "playing"}>
                  <Playing snap={snap()} match={match()} />
                </Match>
                <Match when={screen() === "results"}>
                  <Results snap={snap()} match={match()} />
                </Match>
                <Match when={screen() === "cards"}>
                  <Cards snap={snap()} match={match()} />
                </Match>
              </Switch>
            )}
          </Match>
        </Switch>
      )}
    </Show>
  );
}

function ShopCards(props: { items: CosmeticItem[] }) {
  const s = () => ({ balance: 1250, owned: [], equipped: {}, clockOffset: 0 });
  return (
    <div class="set shop onz-kart">
      <div class="shop-grid">
        <For each={props.items}>{(it) => <Card item={it} s={s()} now={Date.now()} onOpen={() => {}} />}</For>
      </div>
    </div>
  );
}

function Shell(props: { children: JSX.Element }) {
  return (
    <div class="stage">
      <div class="shell2">
        <div class="shell2__main">{props.children}</div>
      </div>
      <Toasts />
    </div>
  );
}

function Preview() {
  return (
    <Show
      when={view()}
      keyed
      fallback={
        <Shell>
          <p class="onz-not" role="status">
            {note() ?? "Önizleme bekleniyor…"}
          </p>
        </Shell>
      }
    >
      {(v) => (
        <Shell>
          <Switch fallback={<RoomScreens />}>
            <Match when={v.req.ekran === "magaza-kart"}>
              <ShopCards items={v.req.items} />
            </Match>
            <Match when={v.req.ekran === "koleksiyon"}>
              <Shop />
            </Match>
            <Match when={v.req.ekran === "ses-ani"}>
              <p class="onz-not" role="status">
                Bu oyun anı için ses haritası henüz yok.
              </p>
            </Match>
          </Switch>
        </Shell>
      )}
    </Show>
  );
}

/** Ekranın verisini kurar; hata varsa Türkçe neden. */
async function prepare(req: PreviewRequest): Promise<string | null> {
  const item = req.items[0];
  if (item && !screenFits(req.ekran, item.type))
    return `"${cosmeticType(item.type).name}" türü bu ekranda gösterilmez.`;
  setAssetOverrides(req.files);
  if (hasOverrideUnder("/assets/karakter/")) resetCharacterCache();
  setPreviewItems(req.items);
  setState({ account: MOCK_ACCOUNT, snapshot: null });
  const { startMock } = await import("../dev/mock.js");
  const self = (c: Cosmetics): Record<string, PlayerInfo["cosmetics"]> => ({ p0: c });
  switch (req.ekran) {
    case "magaza-kart":
      return null;
    case "koleksiyon": {
      if (!item) return "Ürün yok.";
      const coll = shopCollections(Date.now()).find((c) => c.name === item.koleksiyon);
      if (!coll) return "Koleksiyon şeridi için aynı koleksiyondan en az iki satıştaki ürün gerekir.";
      freezeShop({ balance: 1250, owned: [], equipped: {}, clockOffset: 0 });
      setState({ nav: "shop" });
      return null;
    }
    case "avatar-lobi":
    case "giris":
      if (!item) return "Ürün yok.";
      startMock("lobby", new URLSearchParams("n=5&cos=1"), { cosmetics: self(wearing(item)) });
      return null;
    case "skor-seridi":
      if (!item) return "Ürün yok.";
      startMock("results", new URLSearchParams("n=5&cos=1"), { cosmetics: self(wearing(item)) });
      return null;
    case "kursu":
    case "zafer":
      if (!item) return "Ürün yok.";
      startMock("final", new URLSearchParams("n=5&kars=1"), { cosmetics: self(wearing(item)) });
      return null;
    case "kart-arkasi": {
      if (!item) return "Ürün yok.";
      const { startKartMock } = await import("../dev/mockKartlar.js");
      // Kör seçim: kartlar sırtı dönük dağıtılır (oyuncunun kart arkası görünür).
      startKartMock("kart-secim-kor", new URLSearchParams("n=5"));
      const snap = state.snapshot;
      if (snap)
        setState(
          "snapshot",
          "players",
          snap.players.map((p) =>
            p.id === snap.selfId ? { ...p, cosmetics: { ...p.cosmetics, cardBack: item.id } } : p,
          ),
        );
      return null;
    }
    case "ses-ani":
      return null;
    case "oyun-ani": {
      const { startDevMock } = await import("../dev/mockDispatch.js");
      const name = `${req.oyun ?? ""}-${req.an ?? ""}`;
      await startDevMock(name, new URLSearchParams("n=5"));
      return state.snapshot ? null : "Bu oyun anı için önizleme henüz yok.";
    }
  }
}

/** Çizim bitince (görseller yüklenince, en çok ~3 sn) boyutu bildirir. */
async function reportDrawn(key: number): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const imgs = [...document.querySelectorAll("img")];
  await Promise.race([
    Promise.all(
      imgs.map((i) =>
        i.complete
          ? Promise.resolve()
          : new Promise<void>((r) => i.addEventListener("load", () => r(), { once: true })),
      ),
    ),
    new Promise<void>((r) => setTimeout(r, 3000)),
  ]);
  if (key !== seq) return;
  const root = document.documentElement;
  post({ tur: "cizildi", boyut: { w: root.scrollWidth, h: root.scrollHeight } });
}

async function onMessage(e: MessageEvent): Promise<void> {
  if (e.source !== window.parent || !originAllowed(e.origin, window.location.hostname)) return;
  const parsed = parsePreviewMessage(e.data);
  if (!parsed.ok) {
    post({ tur: "hata", neden: parsed.neden });
    return;
  }
  const key = ++seq;
  setView(null);
  let neden: string | null;
  try {
    neden = await prepare(parsed.req);
  } catch {
    neden = "Ekran hazırlanamadı.";
  }
  if (key !== seq) return;
  if (neden) {
    setNote(neden);
    post({ tur: "hata", neden });
    return;
  }
  if (parsed.req.ekran === "ses-ani") {
    setView({ req: parsed.req, key });
    post({ tur: "hata", neden: "Ses olay haritası henüz yok." });
    return;
  }
  setView({ req: parsed.req, key });
  void reportDrawn(key);
}

const root = document.getElementById("root");
if (root) {
  if (window.parent === window) {
    // Doğrudan açılış: yalnız Üretim Merkezi içinde çalışır.
    setNote("Bu sayfa yalnız Üretim Merkezi içinde açılır.");
  } else {
    useMockSender(() => {});
    window.addEventListener("message", (e) => void onMessage(e));
  }
  render(() => <Preview />, root);
  if (window.parent !== window) post({ tur: "hazir", surum: PREVIEW_PROTOCOL_VERSION });
}
