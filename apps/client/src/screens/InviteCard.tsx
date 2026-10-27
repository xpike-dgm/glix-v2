import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import { joinRoom, leaveRoom } from "../net/client.js";
import { dismissInvite, invites } from "../net/friends.js";
import { leavesCurrentRoom, liveInvites, remainingText } from "../net/friendsRules.js";
import { ownName, serverNow, state } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { GhostButton } from "../ui/GhostButton.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";

/**
 * Gelen arkadaş daveti kartı: kapatılana ya da süresi (10 dk) dolana dek ekranda kalır.
 * Başka bir odadaysan "Katıl" önce uyarır: katılmak şu anki odadan ayrılmak demektir.
 */
export function InviteCard() {
  const [now, setNow] = createSignal(serverNow());
  const [confirming, setConfirming] = createSignal(false);

  // Süre sayacı yalnız davet varken işler.
  createEffect(
    on(
      () => invites().length > 0,
      (any) => {
        if (!any) return;
        setNow(serverNow());
        const timer = setInterval(() => setNow(serverNow()), 1000);
        onCleanup(() => clearInterval(timer));
      },
    ),
  );

  const live = () => liveInvites(invites(), now());
  const top = createMemo(() => live()[0] ?? null);
  // Kart değişince onay adımı sıfırlanır.
  createEffect(on(top, () => setConfirming(false)));

  const nickname = (): string => ownName() || "Oyuncu";
  const currentCode = (): string | null => state.snapshot?.code ?? null;

  const accept = (): void => {
    const inv = top();
    if (!inv) return;
    if (currentCode() === inv.roomCode) {
      dismissInvite(inv);
      return;
    }
    if (leavesCurrentRoom(currentCode(), inv) && !confirming()) {
      setConfirming(true);
      return;
    }
    dismissInvite(inv);
    if (state.snapshot) leaveRoom();
    joinRoom(inv.roomCode, nickname());
  };

  return (
    <Show when={top()}>
      {(inv) => (
        <section class="invc" role="alert" aria-label="Oda daveti">
          <div class="invc__head">
            <Avatar index={avatarFromName(inv().from)} size={40} />
            <div class="invc__text">
              <p class="invc__title">{inv().from} seni odaya çağırıyor</p>
              <p class="invc__meta">
                Oda {inv().roomCode} · {remainingText(inv().expiresAt, now())}
                <Show when={live().length > 1}> · {live().length - 1} davet daha</Show>
              </p>
            </div>
          </div>
          <Show when={confirming()}>
            <p class="invc__warn">Şu anki odandan ayrılıp bu odaya katılacaksın.</p>
          </Show>
          <div class="invc__actions" data-confirm={confirming() ? "1" : undefined}>
            <div class="invc__primary">
              <PrimaryButton onClick={accept} busy={state.busy}>
                {confirming() ? "Ayrıl ve katıl" : "Katıl"}
              </PrimaryButton>
            </div>
            <GhostButton
              size="small"
              onClick={() => (confirming() ? setConfirming(false) : dismissInvite(inv()))}
            >
              {confirming() ? "Vazgeç" : "Kapat"}
            </GhostButton>
          </div>
        </section>
      )}
    </Show>
  );
}
