import { createEffect, createSignal, For, on, Show } from "solid-js";
import { inviteFriend } from "../net/client.js";
import { friendsData, loadFriends } from "../net/friends.js";
import { inviteCandidates, statusText } from "../net/friendsRules.js";
import { toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { StatusDot } from "./Friends.js";

/** Aynı arkadaşa iki davet arasındaki bekleme (sunucudaki sınırla aynı). */
const RESEND_MS = 30_000;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Odadaki kişi sayısı; değişince (biri katıldı) liste tazelenir. */
  people: number;
}

/** Lobide "Arkadaş davet et": çevrimiçi ve odada olmayan arkadaşlar; dokununca davet gider. */
export function FriendInviteSheet(props: Props) {
  /** Davet gönderilen ve henüz yeniden gönderilemeyen kullanıcılar. */
  const [sent, setSent] = createSignal<ReadonlySet<string>>(new Set());

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) void loadFriends();
      },
    ),
  );
  createEffect(
    on(
      () => props.people,
      () => {
        if (props.open) void loadFriends();
      },
      { defer: true },
    ),
  );

  const list = () => inviteCandidates(friendsData()?.friends ?? []);

  const send = (username: string): void => {
    if (!inviteFriend(username)) {
      toast("Bağlantı yok, biraz sonra tekrar dene.", "error");
      return;
    }
    setSent((s) => new Set(s).add(username));
    setTimeout(() => {
      setSent((s) => {
        const next = new Set(s);
        next.delete(username);
        return next;
      });
    }, RESEND_MS);
  };

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Arkadaşını çağır">
      <Show
        when={list().length > 0}
        fallback={
          <p class="sheet__text" role="status">
            Şu an çevrimiçi arkadaşın yok. Oda kodunu paylaşarak da çağırabilirsin.
          </p>
        }
      >
        <ul class="set__card pf__list fr__invlist" data-scroll>
          <For each={list()}>
            {(f) => (
              <li class="fr__row">
                <Avatar index={avatarFromName(f.username)} size={36} />
                <span class="pf__text">
                  <span class="pf__name">{f.username}</span>
                  <span class="fr__status">
                    <StatusDot status={f.status} />
                    {statusText(f.status)}
                  </span>
                </span>
                <button
                  type="button"
                  class="fr__btn fr__btn--yes"
                  disabled={sent().has(f.username)}
                  aria-label={`${f.username} arkadaşını çağır`}
                  onClick={() => send(f.username)}
                >
                  {sent().has(f.username) ? "Gönderildi" : "Davet et"}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </BottomSheet>
  );
}
