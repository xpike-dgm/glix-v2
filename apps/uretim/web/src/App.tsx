/** Uygulama kökü: oturum denetimi ve yönlendirme. İnceleme odak modu kabuksuz, tam ekrandır. */
import { createMemo, type JSX, Match, onMount, Show, Switch } from "solid-js";
import { isAlanId } from "../../src/ortak/alanlar.js";
import { oturumKapaninca } from "./api.js";
import { Tostlar } from "./bilesenler.js";
import { alanBul, oturum, oturumYukle, setOturum, yolAdi } from "./durum.js";
import { Alan } from "./ekran/Alan.js";
import { Arsiv } from "./ekran/Arsiv.js";
import { Ayarlar } from "./ekran/Ayarlar.js";
import { Fikirler } from "./ekran/Fikirler.js";
import { Giris } from "./ekran/Giris.js";
import { Incele } from "./ekran/Incele.js";
import { Iste } from "./ekran/Iste.js";
import { Kabul } from "./ekran/Kabul.js";
import { Pano } from "./ekran/Pano.js";
import { Raporlar } from "./ekran/Raporlar.js";
import { TasarimAyrinti } from "./ekran/TasarimAyrinti.js";
import { Yukle } from "./ekran/Yukle.js";
import { canliBagla, Kabuk } from "./Kabuk.js";

function Yukleniyor(): JSX.Element {
  return (
    <div class="acilis" aria-busy="true">
      <span class="marka__simge marka__simge--buyuk" aria-hidden="true" />
    </div>
  );
}

export function App(): JSX.Element {
  canliBagla();
  onMount(() => {
    oturumKapaninca(() => setOturum((o) => (o ? { ...o, giris: false } : o)));
    void oturumYukle();
  });
  const alanId = createMemo(() => /^\/alan\/([a-z-]+)$/.exec(yolAdi())?.[1] ?? null);
  const baslik = (): string => {
    const y = yolAdi();
    const a = alanId();
    if (a) return alanBul(a)?.ad ?? "Alan";
    return (
      {
        "/": "Pano",
        "/iste": "İş iste",
        "/yukle": "Elle yükle",
        "/arsiv": "Arşiv",
        "/raporlar": "Raporlar",
        "/fikirler": "Fikirler",
        ...(/^\/fikir\/\d+$/.test(y) ? { [y]: "Fikir kartı" } : {}),
        "/kabul": "Kabul havuzu",
        "/ayarlar": "Ayarlar",
      }[y] ?? "Üretim Merkezi"
    );
  };
  return (
    <>
      <Show when={oturum()} fallback={<Yukleniyor />}>
        {(o) => (
          <Show when={o().giris} fallback={<Giris />}>
            <Switch
              fallback={
                <Kabuk baslik={yolAdi() === "/" ? "Üretim Merkezi" : baslik()}>
                  <Switch fallback={<Pano />}>
                    <Match when={alanId() && isAlanId(alanId()) && alanId()}>
                      {(a) => <Alan alan={a() as Parameters<typeof Alan>[0]["alan"]} />}
                    </Match>
                    <Match when={yolAdi() === "/iste"}>
                      <Iste />
                    </Match>
                    <Match when={yolAdi() === "/yukle"}>
                      <Yukle />
                    </Match>
                    <Match when={yolAdi() === "/arsiv"}>
                      <Arsiv />
                    </Match>
                    <Match when={yolAdi() === "/raporlar"}>
                      <Raporlar />
                    </Match>
                    <Match when={yolAdi() === "/fikirler"}>
                      <Fikirler />
                    </Match>
                    <Match when={/^\/fikir\/\d+$/.test(yolAdi())}>
                      <TasarimAyrinti />
                    </Match>
                    <Match when={yolAdi() === "/kabul"}>
                      <Kabul />
                    </Match>
                    <Match when={yolAdi() === "/ayarlar"}>
                      <Ayarlar />
                    </Match>
                  </Switch>
                </Kabuk>
              }
            >
              <Match when={yolAdi() === "/incele" || yolAdi().startsWith("/incele/")}>
                <Incele />
              </Match>
            </Switch>
          </Show>
        )}
      </Show>
      <Tostlar />
    </>
  );
}
