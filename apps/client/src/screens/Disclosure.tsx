import { setState } from "../net/store.js";
import { BackIcon } from "../ui/Icons.js";
import { Screen } from "../ui/Screen.js";

/** Veri sorumlusu iletişim adresi (gizlilik.html ile aynı). */
const CONTACT = "xpikerider2@gmail.com";

/**
 * Aydınlatma metni özeti (KVKK m.10). Tam metin /gizlilik.html'dedir; ikisi birbirine uygun tutulur.
 * Kayıt ekranından açılır.
 */
export function Disclosure() {
  return (
    <Screen class="acct">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={() => setState("nav", "register")}>
          <BackIcon size={26} />
        </button>
        <span />
      </header>
      <div class="acct__body" data-scroll>
        <h1 class="display h-title rise" style={{ "--i": 0 }}>
          Aydınlatma metni
        </h1>
        <h2 class="acct__subhead">Verini kim işliyor?</h2>
        <p class="acct__text">
          GLIX, veri sorumlusu olarak kişisel verilerini 6698 sayılı KVKK kapsamında işler. İletişim:{" "}
          <a class="acct__link" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </p>
        <h2 class="acct__subhead">Hangi veriler, neden?</h2>
        <ul class="acct__list">
          <li>
            Kullanıcı adı ve e-posta: hesabını tanımak, girişi sağlamak, doğrulama ve şifre sıfırlama
            e-postaları göndermek için.
          </li>
          <li>
            Şifre: yalnız tek yönlü özet olarak saklanır; kimse göremez. Google ile girersen yalnız hesap
            kimliğin ve e-postan alınır.
          </li>
          <li>Maç sonuçların, istatistiklerin ve rozetlerin: profilini ve sıralamayı göstermek için.</li>
          <li>Glix bakiyen ve Glix hareketlerin: ne zaman ve neden kazandığını göstermek için.</li>
          <li>
            Arkadaşların, isteklerin ve engellediklerin: arkadaş özelliklerini çalıştırmak için. Yalnız kabul
            ettiğin arkadaşlar durumunu ve profil özetini görür.
          </li>
        </ul>
        <h2 class="acct__subhead">Ne kadar saklanır?</h2>
        <p class="acct__text">
          Hesap verilerin, hesabını silene kadar saklanır. Silme isteğinde hepsi hemen ve kalıcı olarak
          silinir. Sunucu günlüklerinde kullanıcı adı ya da e-posta tutulmaz. Verilerin satılmaz, reklam için
          kullanılmaz.
        </p>
        <h2 class="acct__subhead">Haklarını nasıl kullanırsın?</h2>
        <p class="acct__text">
          Verilerine erişme, düzeltme ve silme hakkın vardır. Hesap açtıktan sonra Ayarlar &gt; Hesap
          bölümünden "Verimi indir" ile verilerini alabilir, "Hesabımı sil" ile hesabını silebilirsin. Başka
          sorular için {CONTACT} adresine yazabilirsin.
        </p>
        <p class="acct__text">
          <a class="acct__link" href="/gizlilik.html">
            Gizlilik Politikası (tam metin)
          </a>
          <br />
          <a class="acct__link" href="/kosullar.html">
            Kullanım Koşulları
          </a>
        </p>
      </div>
    </Screen>
  );
}
