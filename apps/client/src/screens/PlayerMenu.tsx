import type { PlayerInfo } from "@glix/engine";
import { createEffect, createSignal, on, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { kick, transferHost } from "../net/client.js";
import { friendAction, friendsData, loadFriends } from "../net/friends.js";
import { openReport } from "../net/reportUi.js";
import { state, toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { ExitIcon, UserIcon } from "../ui/Icons.js";
import { FlagIcon, TransferIcon, UserPlusIcon } from "../ui/LobbyIcons.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { PlayerProfileSheet } from "./PlayerProfileSheet.js";
import { friendState } from "./playerMenuRules.js";

type Step = "menu" | "kick" | "transfer";

/**
 * Lobide başka bir oyuncuya dokununca açılan menü: avatar + ad başlığı, "Profilini gör" / "Arkadaş ekle",
 * ev sahibine "Ev sahipliğini devret" / "Odadan çıkar", en altta küçük "Bildir".
 * Hesap bilgisi yalnız `PlayerInfo.username` ile gelir (misafirde yok); arkadaşlık kararı sunucuda verilir.
 */
export function PlayerMenu(props: {
  open: boolean;
  onClose: () => void;
  target: PlayerInfo | null;
  /** Bakan kişi ev sahibi mi. */
  host: boolean;
  /** Hedef ev sahibi mi. */
  targetIsHost: boolean;
}) {
  const [step, setStep] = createSignal<Step>("menu");
  const [profileOpen, setProfileOpen] = createSignal(false);
  const [sentTo, setSentTo] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setStep("menu");
        if (state.account) void loadFriends();
      },
    ),
  );

  const username = (): string | null => props.target?.username ?? null;
  const fstate = () => friendState(state.account?.username ?? null, username(), friendsData(), sentTo());

  const addFriend = async (): Promise<void> => {
    const name = username();
    if (!name || busy()) return;
    hapticTap();
    setBusy(true);
    const r = await friendAction("request", name);
    setBusy(false);
    if (!r.ok) {
      toast(r.message, "error");
      return;
    }
    setSentTo(name);
    toast(
      r.result === "accepted" ? `${name} ile artık arkadaşsınız` : "Arkadaşlık isteği gönderildi",
      "success",
    );
  };

  const close = (): void => props.onClose();
  const title = (): string => {
    const n = props.target?.nickname ?? "";
    if (step() === "kick") return `${n} odadan çıkarılsın mı?`;
    if (step() === "transfer") return "Ev sahipliği devredilsin mi?";
    return n;
  };

  return (
    <>
      <BottomSheet
        open={props.open}
        onClose={close}
        title={title()}
        header={
          <Show when={step() === "menu" && props.target} fallback={<h2 class="sheet__title">{title()}</h2>}>
            {(t) => (
              <div class="pmenu__who">
                <Avatar index={t().avatar} size={52} connected={t().connected} />
                <div class="pmenu__text">
                  <span class="pmenu__name">{t().nickname}</span>
                  <Show when={props.targetIsHost || !t().connected}>
                    <span class="pmenu__tag">{props.targetIsHost ? "Ev sahibi" : "Bağlantısı koptu"}</span>
                  </Show>
                </div>
              </div>
            )}
          </Show>
        }
      >
        <Show when={step() === "menu"}>
          <div class="pmenu">
            <Show when={fstate() === "friend"}>
              <button
                type="button"
                class="prow"
                onClick={() => {
                  setProfileOpen(true);
                  close();
                }}
              >
                <UserIcon size={22} />
                <span class="prow__label">Profilini gör</span>
              </button>
            </Show>
            <Show when={fstate() === "can-add" || fstate() === "incoming"}>
              <button type="button" class="prow" disabled={busy()} onClick={() => void addFriend()}>
                <UserPlusIcon size={22} />
                <span class="prow__label">
                  {fstate() === "incoming" ? "İsteğini kabul et" : "Arkadaş ekle"}
                </span>
              </button>
            </Show>
            <Show when={fstate() === "sent"}>
              <div class="prow prow--static" role="status">
                <UserPlusIcon size={22} />
                <span class="prow__label">İstek gönderildi</span>
              </div>
            </Show>
            <Show when={props.host}>
              <button type="button" class="prow" onClick={() => setStep("transfer")}>
                <TransferIcon size={22} />
                <span class="prow__label">Ev sahipliğini devret</span>
              </button>
              <button type="button" class="prow prow--danger" onClick={() => setStep("kick")}>
                <ExitIcon size={22} />
                <span class="prow__label">Odadan çıkar</span>
              </button>
            </Show>
            <button
              type="button"
              class="prow prow--report"
              onClick={() => {
                const t = props.target;
                close();
                if (t) openReport(t.id);
              }}
            >
              <FlagIcon size={18} />
              <span class="prow__label">Bildir</span>
            </button>
          </div>
        </Show>
        <Show when={step() === "kick"}>
          <div class="sheet__actions">
            <PrimaryButton
              variant="danger"
              onClick={() => {
                const t = props.target;
                if (t) kick(t.id);
                close();
              }}
            >
              Çıkar
            </PrimaryButton>
            <GhostButton size="small" onClick={() => setStep("menu")}>
              Vazgeç
            </GhostButton>
          </div>
        </Show>
        <Show when={step() === "transfer"}>
          <p class="sheet__text">Yeni ev sahibi {props.target?.nickname ?? ""} olur; oyunu o başlatır.</p>
          <div class="sheet__actions">
            <PrimaryButton
              onClick={() => {
                const t = props.target;
                if (t) transferHost(t.id);
                close();
              }}
            >
              Devret
            </PrimaryButton>
            <GhostButton size="small" onClick={() => setStep("menu")}>
              Vazgeç
            </GhostButton>
          </div>
        </Show>
      </BottomSheet>

      <PlayerProfileSheet
        open={profileOpen()}
        onClose={() => setProfileOpen(false)}
        username={username()}
        avatar={props.target?.avatar ?? 0}
      />
    </>
  );
}
