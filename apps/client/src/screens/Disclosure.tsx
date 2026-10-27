import { setState } from "../net/store.js";
import { BackIcon } from "../ui/Icons.js";
import { Screen } from "../ui/Screen.js";

/** Aydınlatma metni (yer tutucu; asıl metin H10'da gelir). */
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
        <p class="acct__text">
          Hesap açarken verdiğin kullanıcı adı, e-posta adresi ve şifren yalnızca hesabını yönetmek için
          saklanır. Şifren özetlenerek tutulur; kimseyle paylaşılmaz.
        </p>
        <p class="acct__text">
          Ayrıntılar: <a href="/gizlilik.html">Gizlilik Politikası</a> ve{" "}
          <a href="/kosullar.html">Kullanım Koşulları</a>.
        </p>
      </div>
    </Screen>
  );
}
