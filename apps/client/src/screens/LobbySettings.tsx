import type { JoinPolicy, RoomSnapshot } from "@glix/engine";
import { createSignal, For, Show } from "solid-js";
import { setGames, setJoinPolicy, setRandom } from "../net/client.js";
import { toast } from "../net/store.js";
import { CardSettingsBody } from "../ui/CardSettings.js";
import { BackIcon, CheckIcon, MinusIcon, PlusIcon } from "../ui/Icons.js";
import { Screen } from "../ui/Screen.js";
import { worldAllowed } from "../ui/world.js";
import { gameTag, inRandomPool, isGameDim, poolSizeOf, randomCountOf } from "./lobbyHints.js";

const JOIN_OPTIONS: readonly { policy: JoinPolicy; label: string }[] = [
  { policy: "izleyici", label: "İzleyici" },
  { policy: "kapali", label: "Kapalı" },
];

/** Oyun kartı görseli; yüklenemezse (ya da veri tasarrufunda) boş çerçeve kalır. */
export function GameThumb(props: { id: string; eager?: boolean }) {
  const [ok, setOk] = createSignal(worldAllowed());
  return (
    <Show when={ok()}>
      <span class="gcard__art" aria-hidden="true">
        <img
          src={`/assets/cards/${props.id}.webp`}
          alt=""
          loading={props.eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          width="800"
          height="450"
          onError={() => setOk(false)}
        />
      </span>
    </Show>
  );
}

/**
 * Lobi ayarları ekranı (tam ekran, geri düğmeli): Oyunlar, Kartlar, Oyun sırasında katılım.
 * Ev sahibi değiştirir; misafirler aynı ekranı salt okunur görür. Değişiklikler anında sunucuya gider.
 */
export function LobbySettings(props: { snap: RoomSnapshot; host: boolean; onBack: () => void }) {
  const snap = () => props.snap;
  const sel = () => snap().selection;
  const connected = () => snap().players.filter((p) => p.connected).length;
  const pool = () => poolSizeOf(snap().catalog);
  const randomCount = () => randomCountOf(sel(), pool());
  const selected = () => snap().catalog.filter((g) => snap().gameIds.includes(g.id));
  const eligible = () =>
    snap().catalog.filter((g) => g.minPlayers <= connected() && connected() <= g.maxPlayers);
  /** Gerçekten az kişiyle ilgili değil, kalabalığa göre uygun oyun azsa uyarı (tek başınayken susar). */
  const tooFewEligible = () => connected() >= 2 && eligible().filter(inRandomPool).length < randomCount();
  const lastCount = { n: 5 };

  const chooseRandom = (): void => {
    if (!props.host || sel().mode === "random") return;
    setRandom(Math.min(lastCount.n, pool()));
  };
  const chooseManual = (): void => {
    if (!props.host || sel().mode === "manual") return;
    lastCount.n = randomCount();
    const fit = eligible()
      .filter(inRandomPool)
      .map((g) => g.id);
    const first = snap().catalog[0]?.id;
    setGames(fit.length > 0 ? fit : first ? [first] : []);
  };
  const step = (delta: number): void => {
    if (!props.host) return;
    const next = Math.min(pool(), Math.max(1, randomCount() + delta));
    if (next === randomCount()) return;
    lastCount.n = next;
    setRandom(next);
  };
  const toggleGame = (id: string): void => {
    if (!props.host) return;
    const ids = snap().gameIds;
    if (ids.includes(id)) {
      if (ids.length === 1) {
        toast("En az bir oyun seçili olmalı");
        return;
      }
      setGames(ids.filter((x) => x !== id));
    } else {
      setGames([...ids, id]);
    }
  };
  const choosePolicy = (policy: JoinPolicy): void => {
    if (!props.host || snap().joinPolicy === policy) return;
    setJoinPolicy(policy);
  };

  return (
    <Screen class="set lset">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={props.onBack}>
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">Lobi ayarları</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body" data-scroll>
        <Show when={!props.host}>
          <p class="lset__note">Ayarları yalnızca oda sahibi değiştirebilir.</p>
        </Show>

        <section class="lset__sec" aria-labelledby="lset-games">
          <h2 class="lset__head" id="lset-games">
            Oyunlar
          </h2>
          <div class="seg">
            <button
              type="button"
              class="seg__opt"
              aria-pressed={sel().mode === "random"}
              data-on={sel().mode === "random" ? "1" : undefined}
              disabled={!props.host}
              onClick={chooseRandom}
            >
              Rastgele
            </button>
            <button
              type="button"
              class="seg__opt"
              aria-pressed={sel().mode === "manual"}
              data-on={sel().mode === "manual" ? "1" : undefined}
              disabled={!props.host}
              onClick={chooseManual}
            >
              Ben seçeyim
            </button>
          </div>
          <Show when={sel().mode === "random"}>
            <div class="rnd">
              <div class="rnd__step">
                <Show when={props.host}>
                  <button
                    type="button"
                    class="rnd__btn"
                    aria-label="Oyun sayısını azalt"
                    disabled={randomCount() <= 1}
                    onClick={() => step(-1)}
                  >
                    <MinusIcon size={26} />
                  </button>
                </Show>
                <span class="rnd__num" aria-live="polite">
                  {randomCount()}
                </span>
                <Show when={props.host}>
                  <button
                    type="button"
                    class="rnd__btn"
                    aria-label="Oyun sayısını artır"
                    disabled={randomCount() >= pool()}
                    onClick={() => step(1)}
                  >
                    <PlusIcon size={26} />
                  </button>
                </Show>
              </div>
              <p class="rnd__hint">Başlarken oyuncu sayısına uygun {randomCount()} oyun seçilir</p>
              <Show when={tooFewEligible()}>
                <p class="rnd__hint rnd__hint--warn">
                  Şu an {eligible().length === 0 ? "uygun oyun yok" : `${eligible().length} oyun uygun`}
                </p>
              </Show>
            </div>
          </Show>
          <Show when={sel().mode === "manual"}>
            <p class="lset__sub">{selected().length} oyun seçili</p>
            <div class="lset__games">
              <For each={snap().catalog}>
                {(g) => {
                  const on = () => snap().gameIds.includes(g.id);
                  return (
                    <button
                      type="button"
                      class="gcard"
                      classList={{ "gcard--dim": isGameDim(g, connected()) }}
                      data-on={on() ? "1" : undefined}
                      disabled={!props.host}
                      aria-pressed={on()}
                      onClick={() => toggleGame(g.id)}
                    >
                      <GameThumb id={g.id} />
                      <span class="gcard__text">
                        <span class="gcard__name">{g.name}</span>
                        <span class="gcard__tag">{gameTag(g, connected())}</span>
                      </span>
                      <span class="gcard__check">
                        <Show when={on()}>
                          <CheckIcon size={16} />
                        </Show>
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </section>

        <section class="lset__sec" aria-labelledby="lset-cards">
          <h2 class="lset__head" id="lset-cards">
            Kartlar
          </h2>
          <CardSettingsBody settings={snap().cardSettings} host={props.host} fold />
        </section>

        <section class="lset__sec" aria-labelledby="lset-join">
          <h2 class="lset__head" id="lset-join">
            Oyun sırasında katılım
          </h2>
          <div class="seg">
            <For each={JOIN_OPTIONS}>
              {(o) => (
                <button
                  type="button"
                  class="seg__opt"
                  aria-pressed={snap().joinPolicy === o.policy}
                  data-on={snap().joinPolicy === o.policy ? "1" : undefined}
                  disabled={!props.host}
                  onClick={() => choosePolicy(o.policy)}
                >
                  {o.label}
                </button>
              )}
            </For>
          </div>
          <p class="lset__sub">
            {snap().joinPolicy === "izleyici"
              ? "Maç sürerken gelen kişi izleyici olarak girer; maç bitince oyuncu olur."
              : "Maç sürerken gelen kimse odaya giremez."}
          </p>
        </section>
      </div>
    </Screen>
  );
}
