import { createMemo, Match, onCleanup, onMount, Switch } from "solid-js";
import { startNet } from "./net/client.js";
import { normalizeCode } from "./net/code.js";
import { setState, state } from "./net/store.js";
import { UpdateToast } from "./pwa/UpdateToast.js";
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
import { Toasts } from "./ui/Toast.js";

export function App() {
  const screen = createMemo(() =>
    selectScreen({ snapshot: state.snapshot, nav: state.nav, notFound: state.notFoundCode !== null }),
  );

  onMount(() => {
    installErrorReporting();
    const params = new URLSearchParams(window.location.search);
    const code = normalizeCode(params.get("oda") ?? "");
    if (code) setState({ nav: "join", joinCode: code });

    const mock = import.meta.env.DEV ? params.get("mock") : null;
    if (mock) {
      if (mock.startsWith("sonkisi-")) {
        void import("./dev/mockSonKisi.js").then((m) => m.startSonKisiMock(mock, params));
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
      } else if (mock.startsWith("karalama-")) {
        void import("./dev/mockKaralama.js").then((m) => m.startKaralamaMock(mock, params));
      } else if (mock.startsWith("acgozluluk-")) {
        void import("./dev/mockAcgozluluk.js").then((m) => m.startAcgozlulukMock(mock, params));
      } else if (mock.startsWith("cizgi-")) {
        void import("./dev/mockCizgi.js").then((m) => m.startCizgiMock(mock, params));
      } else if (mock.startsWith("ittifak-")) {
        void import("./dev/mockIttifak.js").then((m) => m.startIttifakMock(mock, params));
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
      <UpdateToast screen={screen()} />
    </div>
  );
}
