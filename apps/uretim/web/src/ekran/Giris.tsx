/** Giriş (UM-G1): e-posta → 6 haneli kod → güvenilir cihaz seçimi. */
import { createSignal, type JSX, onCleanup, Show } from "solid-js";
import { gonder } from "../api.js";
import { oturumYukle } from "../durum.js";
import { Simge } from "../simgeler.js";

export function Giris(): JSX.Element {
  const [adim, setAdim] = createSignal<"eposta" | "kod">("eposta");
  const [eposta, setEposta] = createSignal("");
  const [kod, setKod] = createSignal("");
  const [guven, setGuven] = createSignal(true);
  const [hata, setHata] = createSignal("");
  const [bekle, setBekle] = createSignal(false);
  const [kalan, setKalan] = createSignal(0);
  let sayac: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => clearInterval(sayac));
  const geriSay = (): void => {
    setKalan(60);
    clearInterval(sayac);
    sayac = setInterval(() => {
      if (kalan() <= 1) clearInterval(sayac);
      setKalan((k) => Math.max(0, k - 1));
    }, 1000);
  };
  const kodIste = async (e?: Event): Promise<void> => {
    e?.preventDefault();
    setHata("");
    setBekle(true);
    try {
      await gonder("giris/kod", { eposta: eposta().trim() });
      setAdim("kod");
      geriSay();
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Kod gönderilemedi.");
    } finally {
      setBekle(false);
    }
  };
  const dogrula = async (e?: Event): Promise<void> => {
    e?.preventDefault();
    if (kod().length !== 6) return;
    setHata("");
    setBekle(true);
    try {
      await gonder("giris/dogrula", { eposta: eposta().trim(), kod: kod(), guvenilir: guven() });
      await oturumYukle();
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Giriş yapılamadı.");
      setKod("");
    } finally {
      setBekle(false);
    }
  };
  return (
    <div class="giris">
      <div class="giris__kart">
        <div class="marka marka--buyuk">
          <span class="marka__simge" aria-hidden="true">
            <Simge ad="katman" boyut={22} />
          </span>
        </div>
        <h1>Üretim Merkezi</h1>
        <p class="soluk">
          {adim() === "eposta"
            ? "Devam etmek için e-postanı yaz; sana tek kullanımlık bir kod gönderelim."
            : `${eposta()} adresine gelen 6 haneli kodu yaz.`}
        </p>
        <Show
          when={adim() === "kod"}
          fallback={
            <form class="yigin" onSubmit={kodIste}>
              <label class="alan-giris">
                <span>E-posta</span>
                <input
                  class="girdi"
                  type="email"
                  autocomplete="email"
                  inputmode="email"
                  required
                  value={eposta()}
                  onInput={(e) => setEposta(e.currentTarget.value)}
                  placeholder="ad@ornek.com"
                />
              </label>
              <button
                type="submit"
                class="dg dg--birincil dg--b dg--tam"
                disabled={bekle() || !eposta().includes("@")}
              >
                {bekle() ? "Gönderiliyor…" : "Kod gönder"}
              </button>
            </form>
          }
        >
          <form class="yigin" onSubmit={dogrula}>
            <label class="alan-giris">
              <span>Giriş kodu</span>
              <input
                class="girdi girdi--kod"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                pattern="\d{6}"
                value={kod()}
                onInput={(e) => {
                  const v = e.currentTarget.value.replace(/\D/g, "").slice(0, 6);
                  setKod(v);
                  e.currentTarget.value = v;
                  if (v.length === 6) void dogrula();
                }}
                placeholder="••••••"
                aria-describedby="kod-not"
              />
            </label>
            <label class="satir onay-satiri">
              <input
                type="checkbox"
                class="onay-kutusu"
                checked={guven()}
                onChange={(e) => setGuven(e.currentTarget.checked)}
              />
              <span>
                Bu cihaza güven <span class="cok-soluk">(30 gün açık kalır)</span>
              </span>
            </label>
            <button
              type="submit"
              class="dg dg--birincil dg--b dg--tam"
              disabled={bekle() || kod().length !== 6}
            >
              {bekle() ? "Kontrol ediliyor…" : "Giriş yap"}
            </button>
            <div class="satir satir--ara kucuk" id="kod-not">
              <button
                type="button"
                class="dg dg--hayalet dg--k"
                onClick={() => {
                  setAdim("eposta");
                  setKod("");
                  setHata("");
                }}
              >
                <Simge ad="onceki" /> E-postayı değiştir
              </button>
              <button
                type="button"
                class="dg dg--hayalet dg--k"
                disabled={kalan() > 0 || bekle()}
                onClick={() => void kodIste()}
              >
                {kalan() > 0 ? `Yeni kod ${kalan()} sn` : "Yeni kod gönder"}
              </button>
            </div>
          </form>
        </Show>
        <Show when={hata()}>
          <div class="serit serit--kirmizi" role="alert">
            <Simge ad="uyari" />
            <span>{hata()}</span>
          </div>
        </Show>
        <p class="cok-soluk kucuk giris__dip">Kod 10 dakika geçerlidir. Yalnız tanımlı hesaplar girebilir.</p>
      </div>
    </div>
  );
}
