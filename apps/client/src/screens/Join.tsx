import { createSignal } from "solid-js";
import { joinRoom } from "../net/client.js";
import { isCompleteCode } from "../net/code.js";
import { goHome, setNickname, setState, state } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { CodeInput } from "../ui/CodeInput.js";
import { BackIcon } from "../ui/Icons.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { NicknameSheet } from "./NicknameSheet.js";

export function Join() {
  const [nickOpen, setNickOpen] = createSignal(false);
  const [localShake, setLocalShake] = createSignal(0);

  const go = (name: string): void => {
    if (isCompleteCode(state.joinCode)) joinRoom(state.joinCode, name);
  };
  const submit = (): void => {
    if (!isCompleteCode(state.joinCode)) {
      setLocalShake((n) => n + 1);
      return;
    }
    if (!state.nickname) {
      setNickOpen(true);
      return;
    }
    go(state.nickname);
  };

  return (
    <Screen>
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={goHome}>
          <BackIcon size={26} />
        </button>
        <button type="button" class="chip" onClick={() => setNickOpen(true)}>
          <Avatar index={avatarFromName(state.nickname || "?")} size={32} />
          <span class="chip__name">{state.nickname || "Takma ad"}</span>
        </button>
      </header>

      <div class="join__body">
        <h1 class="display h-title rise" style={{ "--i": 0 }}>
          Oda kodu
        </h1>
        <p class="lead rise" style={{ "--i": 1 }}>
          Arkadaşının ekranındaki 5 harfli kodu gir.
        </p>
        <div class="join__code rise" style={{ "--i": 2 }}>
          <CodeInput
            value={state.joinCode}
            onChange={(v) => setState("joinCode", v)}
            onSubmit={submit}
            shake={localShake() + state.joinShake}
            autofocus
          />
        </div>
      </div>

      <div class="bottom-actions">
        <PrimaryButton
          onClick={submit}
          busy={state.busy}
          disabled={!isCompleteCode(state.joinCode)}
          reason={isCompleteCode(state.joinCode) ? undefined : "5 harfli kodu gir"}
        >
          Katıl
        </PrimaryButton>
      </div>

      <NicknameSheet
        open={nickOpen()}
        initial={state.nickname}
        onClose={() => setNickOpen(false)}
        onDone={(name) => {
          setNickname(name);
          setNickOpen(false);
          go(name);
        }}
      />
    </Screen>
  );
}
