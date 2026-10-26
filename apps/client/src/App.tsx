import { createEffect, createMemo, createSignal, Match, onCleanup, onMount, Switch } from "solid-js";
import { startNet } from "./net/client.js";
import { normalizeCode } from "./net/code.js";
import { setState, state } from "./net/store.js";
import { announceUpdateIfAny } from "./pwa/pwa.js";
import { UpdateRequired } from "./pwa/UpdateRequired.js";
import { CLIENT_PROTOCOL_VERSION } from "./pwa/updatePolicy.js";
import { useUpdateFlow } from "./pwa/useUpdateFlow.js";
import { setScreenAwake } from "./pwa/wakeLock.js";
import { Briefing } from "./screens/Briefing.js";
import { Countdown } from "./screens/Countdown.js";
import { Final } from "./screens/Final.js";
import { Home } from "./screens/Home.js";
import { Join } from "./screens/Join.js";
import { Lobby } from "./screens/Lobby.js";
import { NotFound } from "./screens/NotFound.js";
import { Playing } from "./screens/Playing.js";
import { Reconnecting } from "./screens/Reconnecting.js";
import { Results } from "./screens/Results.js";
import { selectScreen } from "./screens/route.js";
import { installErrorReporting } from "./telemetry/errors.js";
import { preloadBriefing } from "./ui/briefingArt.js";
import { Loading } from "./ui/Loading.js";
import { preloadMoods } from "./ui/preloadMoods.js";
import { preloadProps } from "./ui/props.js";
import { Toasts } from "./ui/Toast.js";
import { preloadWorld } from "./ui/world.js";

export function App() {
  const screen = createMemo(() =>
    selectScreen({ snapshot: state.snapshot, nav: state.nav, notFound: state.notFoundCode !== null }),
  );

  const update = useUpdateFlow(screen);

  // Maça girince odadaki oyuncuların ruh hâli görselleri önden yüklenir.
  createEffect(() => {
    const snap = state.snapshot;
    if (snap && snap.phase !== "lobby") preloadMoods(snap.players.map((p) => p.avatar));
  });

  // Anlatım başlarken o oyunun nesne görselleri önden indirilir.
  createEffect(() => {
    const m = state.snapshot?.match;
    if (!m) return;
    preloadProps(m.gameId);
    preloadWorld(m.gameId);
    preloadBriefing(m.gameId);
  });

  // Odadayken ekran uyanık kalır; ana ekranda bırakılır.
  createEffect(() => setScreenAwake(state.snapshot !== null));

  // Yalnız geliştirme: oyun parçası bekleme ekranını önizler.
  const [devLoading, setDevLoading] = createSignal(false);

  onMount(() => {
    installErrorReporting();
    announceUpdateIfAny();
    const params = new URLSearchParams(window.location.search);
    const code = normalizeCode(params.get("oda") ?? "");
    if (code) setState({ nav: "join", joinCode: code });

    const mock = import.meta.env.DEV ? params.get("mock") : null;
    if (mock === "update-required") {
      setState("serverProtocol", CLIENT_PROTOCOL_VERSION + 1);
      return;
    }
    if (mock === "loading") {
      setDevLoading(true);
      return;
    }
    if (mock) {
      if (mock.startsWith("sonkisi-")) {
        void import("./dev/mockSonKisi.js").then((m) => m.startSonKisiMock(mock, params));
      } else if (mock.startsWith("zehirli-")) {
        void import("./dev/mockZehirli.js").then((m) => m.startZehirliMock(mock, params));
      } else if (mock.startsWith("rus-")) {
        void import("./dev/mockRusRuleti.js").then((m) => m.startRusRuletiMock(mock, params));
      } else if (mock.startsWith("gizli-")) {
        void import("./dev/mockGizliHirsiz.js").then((m) => m.startGizliHirsizMock(mock, params));
      } else if (mock.startsWith("kor-bomba")) {
        void import("./dev/mockKorBomba.js").then((m) => m.startKorBombaMock(mock, params));
      } else if (mock.startsWith("asiri-yukleme")) {
        void import("./dev/mockAsiri.js").then((m) => m.startAsiriMock(mock, params));
      } else if (mock.startsWith("kor-kronometre")) {
        void import("./dev/mockKronometre.js").then((m) => m.startKronometreMock(mock, params));
      } else if (mock.startsWith("cagrisim")) {
        void import("./dev/mockCagrisim.js").then((m) => m.startCagrisimMock(mock, params));
      } else if (mock.startsWith("zaman-")) {
        void import("./dev/mockZamanBombasi.js").then((m) => m.startZamanBombasiMock(mock, params));
      } else if (mock.startsWith("capraz-")) {
        void import("./dev/mockCapraz.js").then((m) => m.startCaprazMock(mock, params));
      } else if (mock.startsWith("bozuk-")) {
        void import("./dev/mockBozuk.js").then((m) => m.startBozukMock(mock, params));
      } else if (mock.startsWith("kara-")) {
        void import("./dev/mockBorsa.js").then((m) => m.startBorsaMock(mock, params));
      } else if (mock.startsWith("karalama-")) {
        void import("./dev/mockKaralama.js").then((m) => m.startKaralamaMock(mock, params));
      } else if (mock.startsWith("acgozluluk-")) {
        void import("./dev/mockAcgozluluk.js").then((m) => m.startAcgozlulukMock(mock, params));
      } else if (mock.startsWith("cizgi-")) {
        void import("./dev/mockCizgi.js").then((m) => m.startCizgiMock(mock, params));
      } else if (mock.startsWith("alisveris-")) {
        void import("./dev/mockAlisveris.js").then((m) => m.startAlisverisMock(mock, params));
      } else if (mock.startsWith("kareler-")) {
        void import("./dev/mockKareler.js").then((m) => m.startKarelerMock(mock, params));
      } else if (mock.startsWith("ittifak-")) {
        void import("./dev/mockIttifak.js").then((m) => m.startIttifakMock(mock, params));
      } else if (mock.startsWith("kontrol-")) {
        void import("./dev/mockKontrol.js").then((m) => m.startKontrolMock(mock, params));
      } else if (mock.startsWith("kendim-")) {
        void import("./dev/mockKendim.js").then((m) => m.startKendimMock(mock, params));
      } else if (mock.startsWith("yazi-")) {
        void import("./dev/mockYazi.js").then((m) => m.startYaziMock(mock, params));
      } else if (mock.startsWith("sozluk-")) {
        void import("./dev/mockSozluk.js").then((m) => m.startSozlukMock(mock, params));
      } else if (mock.startsWith("laf-")) {
        void import("./dev/mockLaf.js").then((m) => m.startLafMock(mock, params));
      } else if (mock.startsWith("sizma-")) {
        void import("./dev/mockSizma.js").then((m) => m.startSizmaMock(mock, params));
      } else if (mock.startsWith("rusvet-")) {
        void import("./dev/mockRusvet.js").then((m) => m.startRusvetMock(mock, params));
      } else if (mock.startsWith("ortalama-")) {
        void import("./dev/mockOrtalama.js").then((m) => m.startOrtalamaMock(mock, params));
      } else if (/^(landscape|briefing-ready|spectator-)/.test(mock)) {
        void import("./dev/mockShell.js").then((m) => m.startShellMock(mock, params));
      } else {
        void import("./dev/mock.js").then((m) => m.startMock(mock, params));
      }
      return;
    }
    onCleanup(startNet());
  });

  return (
    <div class="stage">
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
                      <Countdown match={match()} />
                    </Match>
                    <Match when={screen() === "playing"}>
                      <Playing snap={snap()} match={match()} />
                    </Match>
                    <Match when={screen() === "results"}>
                      <Results snap={snap()} match={match()} />
                    </Match>
                  </Switch>
                )}
              </Match>
            </Switch>
          )}
        </Match>
      </Switch>
      <Reconnecting />
      <Toasts />
    </div>
  );
}
