import { createMemo, Show } from "solid-js";
import { shownAnnouncement } from "../net/siteRules.js";
import { dismissAnnouncement, serverNow, state } from "../net/store.js";
import { CloseIcon, InfoIcon } from "./Icons.js";

/**
 * Yönetici duyurusu ve otomatik bakım bandı (U16 A3). Ana sayfada tam, lobide küçük (`compact`).
 * Duyuru düz metindir (Solid metni kaçırır; HTML yorumlanmaz) ve cihazda kapatılabilir; bakım bandı kapatılamaz.
 */
export function SiteBanner(props: { compact?: boolean }) {
  const announcement = createMemo(() =>
    shownAnnouncement(state.site, serverNow(), state.dismissedAnnouncement),
  );
  const maintenanceText = () =>
    props.compact
      ? "Kısa bir bakım yapıyoruz: yeni oyun şimdilik başlamıyor."
      : "Kısa bir bakım yapıyoruz. Şimdilik yeni oda kurulamıyor, birazdan tekrar dene.";
  return (
    <Show when={state.site.maintenance || announcement()}>
      <div class="site-banners" data-compact={props.compact ? "1" : undefined}>
        <Show when={state.site.maintenance}>
          <p class="site-banner site-banner--bakim" role="status">
            <InfoIcon size={20} />
            <span class="site-banner__text">{maintenanceText()}</span>
          </p>
        </Show>
        <Show when={announcement()}>
          {(a) => (
            <p class="site-banner" data-kind={a().kind} role="status">
              <InfoIcon size={20} />
              <span class="site-banner__text">{a().text}</span>
              <button
                type="button"
                class="site-banner__x"
                aria-label="Duyuruyu kapat"
                onClick={() => dismissAnnouncement(a().id)}
              >
                <CloseIcon size={18} />
              </button>
            </p>
          )}
        </Show>
      </div>
    </Show>
  );
}
