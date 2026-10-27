import { ROOM_CODE_LENGTH } from "@glix/engine";
import { createEffect, createSignal, on, onMount, Show } from "solid-js";
import { joinStage } from "../net/client.js";
import { isCompleteCode, normalizeCode } from "../net/code.js";
import { state } from "../net/store.js";
import { Mascot } from "../ui/Mascot.js";

/**
 * `/tv` açılış ekranı: büyük kod kutusu. Uzaktan kumandayla kullanılır: kutu hep odaktadır, Tamam/Enter bağlar,
 * ekran klavyesi ya da kumandanın rakam/harf tuşları yazar.
 */
export function TvEntry() {
  let input: HTMLInputElement | undefined;
  const [code, setCode] = createSignal(state.joinCode);
  const [shake, setShake] = createSignal(0);
  const complete = () => isCompleteCode(code());
  const submit = (): void => {
    if (!complete()) {
      setShake((n) => n + 1);
      input?.focus();
      return;
    }
    joinStage(code());
  };
  onMount(() => setTimeout(() => input?.focus(), 200));
  createEffect(
    on(
      () => state.notFoundCode,
      (c) => {
        if (c) {
          setShake((n) => n + 1);
          input?.focus();
          input?.select();
        }
      },
      { defer: true },
    ),
  );
  return (
    <main class="tv__entry">
      <Mascot pose="merhaba" size={220} />
      <p class="tv__overline">TV ekranı</p>
      <h1 class="tv__title">Oda kodunu gir</h1>
      <label class="tv__codefield" data-shake={shake() % 2 === 1 ? "a" : shake() > 0 ? "b" : undefined}>
        <span class="sr-only">Oda kodu</span>
        <input
          ref={input}
          class="tv__codeinput"
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck={false}
          maxlength={ROOM_CODE_LENGTH * 3}
          placeholder="• • • • •"
          value={code()}
          onInput={(e) => {
            const v = normalizeCode(e.currentTarget.value);
            e.currentTarget.value = v;
            setCode(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          onBlur={() => setTimeout(() => input?.focus(), 150)}
        />
      </label>
      <Show
        when={state.notFoundCode}
        fallback={
          <p class="tv__hint">Telefonda oda kurunca ekranda 5 harfli bir kod çıkar. Onu buraya yaz.</p>
        }
      >
        {(c) => (
          <p class="tv__hint tv__hint--bad" role="alert">
            {c() !== "?" ? `${c()} kodlu oda yok ya da kapanmış.` : "Bu kodla bir oda bulunamadı."} Kodu
            kontrol et.
          </p>
        )}
      </Show>
      <button type="button" class="tv__btn" disabled={state.busy} onClick={submit}>
        {state.busy ? "Bağlanıyor…" : "Ekranı aç"}
      </button>
    </main>
  );
}
