import { createEffect, createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { installMusic, setLobbyMusic } from "./fx/music.js";
import { consumeGoogleReturn, consumeMailReturn, refreshAccount } from "./net/account.js";
import { startNet } from "./net/client.js";
import { normalizeCode } from "./net/code.js";
import { collectRounds } from "./net/matchHistory.js";
import { setState, state } from "./net/store.js";
import { PackScreen } from "./pwa/PackScreen.js";
import {
  evaluate,
  initContentPack,
  notifyScreen,
  packScreenOpen,
  watchNetwork,
} from "./pwa/packController.js";
import { announceUpdateIfAny, isOnline } from "./pwa/pwa.js";
import { UpdateRequired } from "./pwa/UpdateRequired.js";
import { CLIENT_PROTOCOL_VERSION } from "./pwa/updatePolicy.js";
import { useUpdateFlow } from "./pwa/useUpdateFlow.js";
import { setScreenAwake } from "./pwa/wakeLock.js";
import { Briefing } from "./screens/Briefing.js";
import { Cards } from "./screens/Cards.js";
import { Countdown } from "./screens/Countdown.js";
import { Disclosure } from "./screens/Disclosure.js";
import { Final } from "./screens/Final.js";
import { ForgotPassword } from "./screens/ForgotPassword.js";
import { Friends } from "./screens/Friends.js";
import { GoogleUsername } from "./screens/GoogleUsername.js";
import { Home } from "./screens/Home.js";
import { InviteCard } from "./screens/InviteCard.js";
import { Join } from "./screens/Join.js";
import { Leaderboard } from "./screens/Leaderboard.js";
import { Lobby } from "./screens/Lobby.js";
import { Login } from "./screens/Login.js";
import { NewPassword } from "./screens/NewPassword.js";
import { NotFound } from "./screens/NotFound.js";
import { Playing } from "./screens/Playing.js";
import { Profile } from "./screens/Profile.js";
import { Reconnecting } from "./screens/Reconnecting.js";
import { Register } from "./screens/Register.js";
import { Results } from "./screens/Results.js";
import { selectScreen } from "./screens/route.js";
import { Settings } from "./screens/Settings.js";
import { dataSaver, setColorBlind, setTextSize, wifiOnly } from "./settings/settings.js";
import { installErrorReporting } from "./telemetry/errors.js";
import { preloadBriefing } from "./ui/briefingArt.js";
import { Curtain } from "./ui/Curtain.js";
import { Loading } from "./ui/Loading.js";
import { collectGallery } from "./ui/matchGallery.js";
import { preloadCards } from "./ui/preloadCards.js";
import { preloadMoods } from "./ui/preloadMoods.js";
import { preloadProps } from "./ui/props.js";
import { ReportSheet } from "./ui/ReportSheet.js";
import { SidePlayers } from "./ui/SidePlayers.js";
import { Toasts } from "./ui/Toast.js";
import { preloadWorld } from "./ui/world.js";

/**
 * Yalnız geliştirme: önizleme (mock) ekranı kurulunca `<html data-ready>` işaretlenir; `scripts/ui-check.mjs`
 * sabit bekleme yerine bunu bekler. Zamanlayıcı/rAF kullanılmaz (denetimde sahte saat olabilir).
 */
function devReady(started: Promise<unknown>): void {
  void started.finally(() => {
    // Yalnız geliştirme: `&stage=1` odada TV açıkmış gibi rozeti gösterir.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("stage") === "1")
      setState("snapshot", "stageCount", 1);
    // İki mikro görev: Solid'in senkron güncellemesi ve tembel bileşenlerin ilk çizimi bitsin.
    queueMicrotask(() => queueMicrotask(() => document.documentElement.setAttribute("data-ready", "1")));
  });
}

export function App() {
  const screen = createMemo(() =>
    selectScreen({ snapshot: state.snapshot, nav: state.nav, notFound: state.notFoundCode !== null }),
  );

  const update = useUpdateFlow(screen);
  /** Tablet/masaüstünde maç sürerken ikinci sütun (oyuncular/puan) açılır; genişlik sınırı CSS'te. */
  const twoCols = () => ["briefing", "countdown", "playing", "results", "cards"].includes(screen());

  // Maça girince odadaki oyuncuların ruh hâli görselleri önden yüklenir.
  createEffect(() => {
    const snap = state.snapshot;
    if (snap && snap.phase !== "lobby") preloadMoods(snap.players.map((p) => p.avatar));
  });

  // Karalama / Bozuk Telefon çizimleri (sunucunun herkese açık gönderdikleri) maç sonu galerisi için birikir.
  createEffect(() => collectGallery(state.snapshot));
  createEffect(() => collectRounds(state.snapshot));

  // Kartlı maç başlayınca çerçeveler ve kart sırtı önden indirilir.
  createEffect(() => {
    const snap = state.snapshot;
    if (snap && snap.phase !== "lobby" && snap.cardSettings?.enabled !== false) preloadCards();
  });

  // Lobiye girince lobi arka planı önden indirilir.
  createEffect(() => {
    if (state.snapshot?.phase === "lobby") preloadWorld("lobi");
  });

  // Anlatım başlarken o oyunun nesne görselleri önden indirilir.
  createEffect(() => {
    const m = state.snapshot?.match;
    if (!m) return;
    preloadProps(m.gameId);
    preloadWorld(m.gameId);
    preloadBriefing(m.gameId);
  });

  // Lobi müziği yalnız lobide çalar; maç başlayınca durur (kullanıcı jestinden önce hiç çalmaz).
  createEffect(() => setLobbyMusic(screen() === "lobby"));

  // Odadayken ekran uyanık kalır; ana ekranda bırakılır.
  createEffect(() => setScreenAwake(state.snapshot !== null));

  // İçerik indirme: ekran ve kısıtlar değişince durdurulur (maç sürerken) ya da sürdürülür.
  createEffect(() => notifyScreen(screen()));
  createEffect(() => {
    dataSaver();
    wifiOnly();
    isOnline();
    evaluate();
  });

  // Yalnız geliştirme: oyun parçası bekleme ekranını önizler.
  const [devLoading, setDevLoading] = createSignal(false);

  onMount(() => {
    installMusic();
    installErrorReporting();
    announceUpdateIfAny();
    const params = new URLSearchParams(window.location.search);
    const code = normalizeCode(params.get("oda") ?? "");
    if (code) setState({ nav: "join", joinCode: code });

    const mock = import.meta.env.DEV ? params.get("mock") : null;
    if (mock === "update-required") {
      setState("serverProtocol", CLIENT_PROTOCOL_VERSION + 1);
      devReady(Promise.resolve());
      return;
    }
    // Yalnız geliştirme: arayüz denetimi büyük yazıyı `&text=large` ile açar.
    if (import.meta.env.DEV && params.get("text") === "large") setTextSize("large");
    if (import.meta.env.DEV && params.get("cb") === "1") setColorBlind(true);
    if (mock?.startsWith("hazirlaniyor")) {
      devReady(import("./dev/mockHazirlaniyor.js").then((m) => void m.startPackMock(mock)));
      return;
    }
    if (mock === "loading") {
      setDevLoading(true);
      devReady(Promise.resolve());
      return;
    }
    if (mock) {
      if (mock.startsWith("kart-")) {
        devReady(import("./dev/mockKartlar.js").then((m) => void m.startKartMock(mock, params)));
      } else if (mock.startsWith("sonkisi-")) {
        devReady(import("./dev/mockSonKisi.js").then((m) => void m.startSonKisiMock(mock, params)));
      } else if (mock.startsWith("siralama") || mock.startsWith("rozet-")) {
        devReady(import("./dev/mockSiralama.js").then((m) => void m.startSiralamaMock(mock, params)));
      } else if (mock.startsWith("arkadas")) {
        devReady(import("./dev/mockArkadas.js").then((m) => void m.startArkadasMock(mock, params)));
      } else if (mock.startsWith("zehirli-")) {
        devReady(import("./dev/mockZehirli.js").then((m) => void m.startZehirliMock(mock, params)));
      } else if (mock.startsWith("rus-")) {
        devReady(import("./dev/mockRusRuleti.js").then((m) => void m.startRusRuletiMock(mock, params)));
      } else if (mock.startsWith("gizli-")) {
        devReady(import("./dev/mockGizliHirsiz.js").then((m) => void m.startGizliHirsizMock(mock, params)));
      } else if (mock.startsWith("kor-bomba")) {
        devReady(import("./dev/mockKorBomba.js").then((m) => void m.startKorBombaMock(mock, params)));
      } else if (mock.startsWith("asiri-yukleme")) {
        devReady(import("./dev/mockAsiri.js").then((m) => void m.startAsiriMock(mock, params)));
      } else if (mock.startsWith("kor-kronometre")) {
        devReady(import("./dev/mockKronometre.js").then((m) => void m.startKronometreMock(mock, params)));
      } else if (mock.startsWith("cagrisim")) {
        devReady(import("./dev/mockCagrisim.js").then((m) => void m.startCagrisimMock(mock, params)));
      } else if (mock.startsWith("zaman-")) {
        devReady(import("./dev/mockZamanBombasi.js").then((m) => void m.startZamanBombasiMock(mock, params)));
      } else if (mock.startsWith("kule-")) {
        devReady(import("./dev/mockKule.js").then((m) => void m.startKuleMock(mock, params)));
      } else if (mock.startsWith("capraz-")) {
        devReady(import("./dev/mockCapraz.js").then((m) => void m.startCaprazMock(mock, params)));
      } else if (mock.startsWith("bozuk-")) {
        devReady(import("./dev/mockBozuk.js").then((m) => void m.startBozukMock(mock, params)));
      } else if (mock.startsWith("kara-")) {
        devReady(import("./dev/mockBorsa.js").then((m) => void m.startBorsaMock(mock, params)));
      } else if (mock.startsWith("karalama-")) {
        devReady(import("./dev/mockKaralama.js").then((m) => void m.startKaralamaMock(mock, params)));
      } else if (mock.startsWith("acgozluluk-")) {
        devReady(import("./dev/mockAcgozluluk.js").then((m) => void m.startAcgozlulukMock(mock, params)));
      } else if (mock.startsWith("cizgi-")) {
        devReady(import("./dev/mockCizgi.js").then((m) => void m.startCizgiMock(mock, params)));
      } else if (mock.startsWith("alisveris-")) {
        devReady(import("./dev/mockAlisveris.js").then((m) => void m.startAlisverisMock(mock, params)));
      } else if (mock.startsWith("kareler-")) {
        devReady(import("./dev/mockKareler.js").then((m) => void m.startKarelerMock(mock, params)));
      } else if (mock.startsWith("ittifak-")) {
        devReady(import("./dev/mockIttifak.js").then((m) => void m.startIttifakMock(mock, params)));
      } else if (mock.startsWith("kontrol-")) {
        devReady(import("./dev/mockKontrol.js").then((m) => void m.startKontrolMock(mock, params)));
      } else if (mock.startsWith("kendim-")) {
        devReady(import("./dev/mockKendim.js").then((m) => void m.startKendimMock(mock, params)));
      } else if (mock.startsWith("yazi-")) {
        devReady(import("./dev/mockYazi.js").then((m) => void m.startYaziMock(mock, params)));
      } else if (mock.startsWith("sozluk-")) {
        devReady(import("./dev/mockSozluk.js").then((m) => void m.startSozlukMock(mock, params)));
      } else if (mock.startsWith("laf-")) {
        devReady(import("./dev/mockLaf.js").then((m) => void m.startLafMock(mock, params)));
      } else if (mock.startsWith("sizma-")) {
        devReady(import("./dev/mockSizma.js").then((m) => void m.startSizmaMock(mock, params)));
      } else if (mock.startsWith("rusvet-")) {
        devReady(import("./dev/mockRusvet.js").then((m) => void m.startRusvetMock(mock, params)));
      } else if (mock.startsWith("ortalama-")) {
        devReady(import("./dev/mockOrtalama.js").then((m) => void m.startOrtalamaMock(mock, params)));
      } else if (/^(landscape|briefing-ready|spectator-)/.test(mock)) {
        devReady(import("./dev/mockShell.js").then((m) => void m.startShellMock(mock, params)));
      } else {
        devReady(import("./dev/mock.js").then((m) => void m.startMock(mock, params)));
      }
      return;
    }
    watchNetwork();
    consumeGoogleReturn();
    consumeMailReturn();
    void refreshAccount();
    void initContentPack({ guest: code !== "" });
    onCleanup(startNet());
  });

  return (
    <div class="stage">
      <div class="shell2" data-cols={twoCols() ? "2" : undefined}>
        <div class="shell2__main">
          <Switch>
            <Match when={update() === "block-required"}>
              <UpdateRequired />
            </Match>
            <Match when={devLoading()}>
              <Loading />
            </Match>
            <Match when={screen() === "home"}>
              <Home />
            </Match>
            <Match when={screen() === "join"}>
              <Join />
            </Match>
            <Match when={screen() === "settings"}>
              <Settings />
            </Match>
            <Match when={screen() === "profile"}>
              <Profile />
            </Match>
            <Match when={screen() === "friends"}>
              <Friends />
            </Match>
            <Match when={screen() === "leaderboard"}>
              <Leaderboard />
            </Match>
            <Match when={screen() === "login"}>
              <Login />
            </Match>
            <Match when={screen() === "register"}>
              <Register />
            </Match>
            <Match when={screen() === "googleAd"}>
              <GoogleUsername />
            </Match>
            <Match when={screen() === "unuttum"}>
              <ForgotPassword />
            </Match>
            <Match when={screen() === "yeniSifre"}>
              <NewPassword />
            </Match>
            <Match when={screen() === "aydinlatma"}>
              <Disclosure />
            </Match>
            <Match when={screen() === "notfound"}>
              <NotFound />
            </Match>
            <Match when={state.snapshot}>
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
            </Match>
          </Switch>
        </div>
        <Show when={twoCols() ? state.snapshot : null}>{(snap) => <SidePlayers snap={snap()} />}</Show>
      </div>
      <Show when={packScreenOpen()}>
        <PackScreen />
      </Show>
      <Curtain screen={screen()} />
      <Reconnecting />
      <InviteCard />
      <Show when={state.snapshot}>
        <ReportSheet />
      </Show>
      <Toasts />
    </div>
  );
}
