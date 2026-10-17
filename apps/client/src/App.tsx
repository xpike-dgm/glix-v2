import { createMemo, Match, onCleanup, onMount, Switch } from "solid-js";
import { startNet } from "./net/client.js";
import { normalizeCode } from "./net/code.js";
import { setState, state } from "./net/store.js";
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
import { Toasts } from "./ui/Toast.js";

export function App() {
  const screen = createMemo(() =>
    selectScreen({ snapshot: state.snapshot, nav: state.nav, notFound: state.notFoundCode !== null }),
  );

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const code = normalizeCode(params.get("oda") ?? "");
    if (code) setState({ nav: "join", joinCode: code });

    const mock = import.meta.env.DEV ? params.get("mock") : null;
    if (mock) {
      if (mock.startsWith("kor-bomba")) {
        void import("./dev/mockKorBomba.js").then((m) => m.startKorBombaMock(mock, params));
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
    </div>
  );
}
