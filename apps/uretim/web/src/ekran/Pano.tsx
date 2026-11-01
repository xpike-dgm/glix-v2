/** Pano (UM-U1): bugünün özeti, uyarılar, alan kartları (küçük önizlemelerle), istek kartları, kod istekleri. */
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js";
import { ALANLAR } from "../../../src/ortak/alanlar.js";
import { hazirNotMetni } from "../../../src/ortak/durum.js";
import type { AlanKarti, IstekKarti, KodIstegi, Kucuk } from "../../../src/ortak/tipler.js";
import { dosyaUrl, gonder } from "../api.js";
import { boyut, goreliZaman, gunBasligi, istanbulSaati, selam } from "../bicim.js";
import { AlanIsareti, Bos, Halka, Iskelet, IskeletKartlar } from "../bilesenler.js";
import { alanBul, alanRengi, git, hataTost, oturum, tost } from "../durum.js";
import { bekleyenToplam, panoVerisi, panoYenile, vurgu } from "../Kabuk.js";
import { Simge } from "../simgeler.js";

export function KucukOnizleme(p: { k: Kucuk | null; ad?: string }): JSX.Element {
  return (
    <div class="kucuk-onizleme" classList={{ "kucuk-onizleme--duz": p.k?.tur !== "gorsel" }}>
      <Switch fallback={<span class="cok-soluk kucuk">Önizleme yok</span>}>
        <Match when={p.k?.tur === "gorsel" && p.k}>
          {(k) => {
            const g = k() as Extract<Kucuk, { tur: "gorsel" }>;
            return (
              <img
                class="kucuk-onizleme__gorsel"
                src={dosyaUrl(g.ogeId, g.ozet)}
                alt={p.ad ?? ""}
                loading="lazy"
                decoding="async"
              />
            );
          }}
        </Match>
        <Match when={p.k?.tur === "dalga" && p.k}>
          {(k) => <MiniDalga dalga={(k() as Extract<Kucuk, { tur: "dalga" }>).dalga} />}
        </Match>
        <Match when={p.k?.tur === "satirlar" && p.k}>
          {(k) => (
            <ul class="kucuk-onizleme__satirlar">
              <For each={(k() as Extract<Kucuk, { tur: "satirlar" }>).satirlar}>
                {(s) => <li class="tasma">{s}</li>}
              </For>
            </ul>
          )}
        </Match>
        <Match when={p.k?.tur === "metin" && p.k}>
          {(k) => <p class="kucuk-onizleme__metin">{(k() as Extract<Kucuk, { tur: "metin" }>).metin}</p>}
        </Match>
      </Switch>
    </div>
  );
}

export function MiniDalga(p: { dalga: number[] }): JSX.Element {
  const n = (): number => Math.max(1, p.dalga.length);
  return (
    <svg class="mini-dalga" viewBox={`0 0 ${n() * 4} 40`} preserveAspectRatio="none" aria-hidden="true">
      <For each={p.dalga}>
        {(v, i) => (
          <rect
            x={i() * 4 + 0.5}
            y={20 - Math.max(1, v * 18)}
            width="2.5"
            height={Math.max(2, v * 36)}
            rx="1.2"
          />
        )}
      </For>
    </svg>
  );
}

function AlanKartiGorunumu(p: { k: AlanKarti; simdi: number }): JSX.Element {
  const a = alanBul(p.k.alan);
  return (
    <a
      class="kart alan-karti"
      classList={{ "alan-karti--yeni": vurgu().has(p.k.alan) }}
      data-alan={p.k.alan}
      href={`/alan/${p.k.alan}`}
      style={{ "--alan-renk": alanRengi(p.k.alan) }}
      onClick={(e) => {
        e.preventDefault();
        git(`/alan/${p.k.alan}`);
      }}
    >
      <div class="alan-karti__bas">
        <AlanIsareti alan={p.k.alan} />
        <Show when={p.k.bekleyen > 0} fallback={<span class="cok-soluk kucuk">Bekleyen yok</span>}>
          <span class="sayac" classList={{ vurgu: vurgu().has(p.k.alan) }}>
            {p.k.bekleyen}
          </span>
        </Show>
      </div>
      <Show
        when={p.k.son}
        fallback={
          <div class="kucuk-onizleme kucuk-onizleme--duz">
            <span class="cok-soluk kucuk">Henüz teslim yok</span>
          </div>
        }
      >
        {(s) => <KucukOnizleme k={s().kucuk} ad={s().ad} />}
      </Show>
      <div class="alan-karti__ayak">
        <Halka
          oran={p.k.onayOrani7g}
          boyut={34}
          renk={alanRengi(p.k.alan)}
          etiket={
            p.k.onayOrani7g === null
              ? "Son 7 günde karar yok"
              : `Son 7 gün onay oranı %${Math.round(p.k.onayOrani7g * 100)}`
          }
        />
        <div class="esnek">
          <div class="tasma alan-karti__son">{p.k.son?.ad ?? a?.ornekIs ?? ""}</div>
          <div class="cok-soluk kucuk">
            {p.k.sonTeslim ? goreliZaman(p.k.sonTeslim, p.simdi) : "Teslim bekleniyor"}
            <Show when={p.k.geriDonen24s > 0}> · {p.k.geriDonen24s} geri döndü</Show>
          </div>
        </div>
      </div>
    </a>
  );
}

function IstekSatiri(p: { k: IstekKarti }): JSX.Element {
  const [bekle, setBekle] = createSignal(false);
  const karar = async (onay: boolean): Promise<void> => {
    setBekle(true);
    try {
      await gonder(`istek/${p.k.id}/karar`, { onay });
      tost(onay ? `İş açıldı: ${alanBul(p.k.istenenAlan)?.ad}` : "İstek reddedildi");
      void panoYenile();
    } catch (e) {
      hataTost(e);
    } finally {
      setBekle(false);
    }
  };
  const kendi = p.k.acanAlan === p.k.istenenAlan;
  return (
    <li class="istek">
      <div class="istek__yol">
        <AlanIsareti alan={p.k.acanAlan} />
        <Show when={!kendi} fallback={<span class="etiket">İş önerisi</span>}>
          <Simge ad="sonraki" boyut={14} class="cok-soluk" />
          <AlanIsareti alan={p.k.istenenAlan} />
        </Show>
      </div>
      <p class="istek__ne">{p.k.ne}</p>
      <p class="soluk kucuk">{p.k.neden}</p>
      <div class="satir">
        <button
          type="button"
          class="dg dg--k dg--birincil"
          disabled={bekle()}
          onClick={() => void karar(true)}
        >
          {kendi ? "İş yap" : "Onayla"}
        </button>
        <button
          type="button"
          class="dg dg--k dg--hayalet"
          disabled={bekle()}
          onClick={() => void karar(false)}
        >
          Reddet
        </button>
        <Show when={p.k.sonTarih}>
          <span class="cok-soluk kucuk">Son tarih {p.k.sonTarih}</span>
        </Show>
      </div>
    </li>
  );
}

function KodSatiri(p: { k: KodIstegi }): JSX.Element {
  const durum = async (d: "onaylandi" | "reddedildi"): Promise<void> => {
    try {
      await gonder(`kod-istegi/${p.k.id}/durum`, { durum: d });
      tost(d === "onaylandi" ? "Yöneticinin iş listesine eklendi" : "Kod isteği reddedildi");
      void panoYenile();
    } catch (e) {
      hataTost(e);
    }
  };
  return (
    <li class="istek">
      <div class="istek__yol">
        <AlanIsareti alan={p.k.alan} />
        <span class="etiket">
          <Simge ad="kod" boyut={12} /> Kod isteği
        </span>
      </div>
      <p class="istek__ne">{p.k.baslik}</p>
      <p class="soluk kucuk">{p.k.gerekce}</p>
      <Show when={p.k.etki}>
        <p class="cok-soluk kucuk">Etki: {p.k.etki}</p>
      </Show>
      <div class="satir">
        <button type="button" class="dg dg--k dg--birincil" onClick={() => void durum("onaylandi")}>
          Yöneticiye ver
        </button>
        <button type="button" class="dg dg--k dg--hayalet" onClick={() => void durum("reddedildi")}>
          Reddet
        </button>
      </div>
    </li>
  );
}

export function Pano(): JSX.Element {
  const simdi = Date.now();
  const [gonderiyor, setGonderiyor] = createSignal(false);
  const paketHazirla = async (): Promise<void> => {
    setGonderiyor(true);
    try {
      const r = await gonder<{ paket: { klasor: string; ogeSayisi: number } }>("paket");
      tost(`Paket hazırlandı: ${r.paket.ogeSayisi} öğe. Yöneticiye "onaylananları ekle" demen yeterli.`, {
        sure: 6000,
      });
      void panoYenile();
    } catch (e) {
      hataTost(e);
    } finally {
      setGonderiyor(false);
    }
  };
  const oneriKarar = async (alan: string, hazir: string, ekle: boolean): Promise<void> => {
    try {
      await gonder(`alan/${alan}/talimat-oneri`, { hazir, ekle });
      tost(ekle ? "Talimata eklendi; yapay zekâ bir sonraki turda okuyacak" : "Öneri kapatıldı");
      void panoYenile();
    } catch (e) {
      hataTost(e);
    }
  };
  const ad = (): string => oturum()?.gorunenAd ?? "";
  return (
    <div class="sayfa pano">
      <header class="sayfa__bas">
        <div>
          <p class="cok-soluk kucuk">{gunBasligi(simdi)}</p>
          <h1>
            {selam(istanbulSaati(simdi))}
            <Show when={ad()}>, {ad()}</Show>
          </h1>
        </div>
        <button
          type="button"
          class="dg dg--birincil dg--b pano__basla"
          disabled={bekleyenToplam() === 0}
          onClick={() => git("/incele")}
        >
          <Simge ad="incele" />
          {bekleyenToplam() > 0 ? `İncelemeye başla · ${bekleyenToplam()}` : "Bekleyen yok"}
        </button>
      </header>

      <Show
        when={panoVerisi()}
        fallback={
          <div class="yigin yigin--genis">
            <div class="ozet-seridi">
              <For each={[1, 2, 3, 4]}>
                {() => (
                  <div class="kart kart--ic">
                    <Iskelet g="50%" y="12px" />
                    <Iskelet g="30%" y="28px" />
                  </div>
                )}
              </For>
            </div>
            <div class="alan-izgara">
              <IskeletKartlar adet={6} />
            </div>
          </div>
        }
      >
        {(v) => (
          <div class="pano__duzen">
            <div class="yigin yigin--genis pano__ana">
              <section class="ozet-seridi" aria-label="Bugünün özeti">
                <div class="ozet">
                  <span class="ozet__sayi">{bekleyenToplam()}</span>
                  <span class="ozet__ad">karar bekliyor</span>
                </div>
                <div class="ozet">
                  <span class="ozet__sayi">{v().bugun.gelen}</span>
                  <span class="ozet__ad">son 24 saatte geldi</span>
                </div>
                <div class="ozet">
                  <span class="ozet__sayi ozet__sayi--gecti">{v().bugun.onaylanan}</span>
                  <span class="ozet__ad">onaylandı</span>
                </div>
                <div class="ozet">
                  <span class="ozet__sayi">{v().geriDonen24s}</span>
                  <span class="ozet__ad">kendiliğinden geri döndü</span>
                </div>
              </section>

              <Show when={v().uyarilar.length}>
                <section class="yigin" aria-label="Uyarılar">
                  <For each={v().uyarilar}>
                    {(u) => (
                      <div
                        class={`serit serit--${u.seviye}`}
                        role={u.seviye === "kirmizi" ? "alert" : undefined}
                      >
                        <Simge ad="uyari" />
                        <span class="esnek">{u.metin}</span>
                        <Show when={u.alan}>
                          <button
                            type="button"
                            class="dg dg--k dg--hayalet"
                            onClick={() => git(`/alan/${u.alan}`)}
                          >
                            Aç
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                </section>
              </Show>

              <Show when={v().havuz.toplam > 0}>
                <section class="kart havuz-seridi">
                  <div class="havuz-seridi__simge">
                    <Simge ad="paket" />
                  </div>
                  <div class="esnek">
                    <h2>
                      <a
                        href="/kabul"
                        onClick={(e) => {
                          e.preventDefault();
                          git("/kabul");
                        }}
                      >
                        Kabul havuzu: {v().havuz.toplam} öğe
                      </a>
                    </h2>
                    <p class="soluk kucuk">
                      <Show when={v().havuz.paketlenecek > 0}>
                        {v().havuz.paketlenecek} öğe yöneticiye gönderilmeye hazır.{" "}
                      </Show>
                      <Show when={v().havuz.tekTik > 0}>
                        {v().havuz.tekTik} öğe tek tıkla oyuna aktarılabilir.
                      </Show>
                    </p>
                  </div>
                  <Show when={v().havuz.paketlenecek > 0}>
                    <button
                      type="button"
                      class="dg dg--birincil"
                      disabled={gonderiyor()}
                      onClick={() => void paketHazirla()}
                    >
                      {gonderiyor() ? "Hazırlanıyor…" : "Yöneticiye gönder"}
                    </button>
                  </Show>
                </section>
              </Show>

              <section class="yigin">
                <div class="satir satir--ara">
                  <h2>Alanlar</h2>
                  <span class="cok-soluk kucuk">Halka: son 7 günün onay oranı</span>
                </div>
                <div class="alan-izgara">
                  <For each={ALANLAR}>
                    {(a) => {
                      const k = (): AlanKarti | undefined => v().alanlar.find((x) => x.alan === a.id);
                      return <Show when={k()}>{(kk) => <AlanKartiGorunumu k={kk()} simdi={simdi} />}</Show>;
                    }}
                  </For>
                </div>
              </section>
            </div>

            <aside class="yigin yigin--genis pano__yan">
              <section class="kart">
                <div class="kart__bas">
                  <h2>İstek kartları</h2>
                  <Show when={v().istekKartlari.length}>
                    <span class="sayac sayac--sessiz">{v().istekKartlari.length}</span>
                  </Show>
                </div>
                <Show
                  when={v().istekKartlari.length}
                  fallback={
                    <Bos simge="istek" baslik="Onay bekleyen istek yok">
                      Alanlar birbirinden bir şey isteyince burada görürsün; sen onaylamadan iş açılmaz.
                    </Bos>
                  }
                >
                  <ul class="istekler">
                    <For each={v().istekKartlari}>{(k) => <IstekSatiri k={k} />}</For>
                  </ul>
                </Show>
              </section>
              <section class="kart">
                <div class="kart__bas">
                  <h2>Kod istekleri</h2>
                  <Show when={v().kodIstekleri.length}>
                    <span class="sayac sayac--sessiz">{v().kodIstekleri.length}</span>
                  </Show>
                </div>
                <Show
                  when={v().kodIstekleri.length}
                  fallback={
                    <Bos simge="kod" baslik="Kod isteği yok">
                      Veriyle yapılamayan bir şey gerektiğinde yapay zekâlar gerekçeli istek açar.
                    </Bos>
                  }
                >
                  <ul class="istekler">
                    <For each={v().kodIstekleri}>{(k) => <KodSatiri k={k} />}</For>
                  </ul>
                </Show>
              </section>
              <Show when={v().talimatOnerileri.length}>
                <section class="kart">
                  <div class="kart__bas">
                    <h2>Talimat önerileri</h2>
                  </div>
                  <ul class="istekler">
                    <For each={v().talimatOnerileri}>
                      {(o) => (
                        <li class="istek">
                          <AlanIsareti alan={o.alan} />
                          <p class="istek__ne">
                            Bu alanda {o.sayi} kez “{hazirNotMetni(o.hazir)}” notu verildi. Talimata eklensin
                            mi?
                          </p>
                          <div class="satir">
                            <button
                              type="button"
                              class="dg dg--k dg--birincil"
                              onClick={() => void oneriKarar(o.alan, o.hazir, true)}
                            >
                              Talimata ekle
                            </button>
                            <button
                              type="button"
                              class="dg dg--k dg--hayalet"
                              onClick={() => void oneriKarar(o.alan, o.hazir, false)}
                            >
                              Gerek yok
                            </button>
                          </div>
                        </li>
                      )}
                    </For>
                  </ul>
                </section>
              </Show>
              <p class="cok-soluk kucuk pano__kota">
                Depo: {boyut(v().kota.kullanilan)} / {boyut(v().kota.sinir)}
                <br />
                {v().ai.acik
                  ? `Yardımcı model: bugün ${v().ai.bugun}/${v().ai.sinir} istek`
                  : "Yardımcı model kapalı; istemler kalıptan hazırlanır"}
              </p>
            </aside>
          </div>
        )}
      </Show>
    </div>
  );
}
