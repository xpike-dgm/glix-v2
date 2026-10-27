import type { AdminRoomPlayers } from "@glix/engine";
import { createSignal, For, onMount, Show } from "solid-js";
import { closeRoom, fetchRoomPlayers, kickPlayer } from "./api.js";
import { Confirm } from "./Confirm.js";
import { phaseLabel } from "./format.js";

type Step = { op: "close" } | { op: "kick"; id: string; nickname: string };

/**
 * Tek odanın oyuncuları (görünen adlar yalnız burada; açmak işlem kaydına `room_view` yazar), oyuncuyu atma ve odayı
 * kapatma. Her değiştirici işlem onay ister.
 */
export function RoomDrill(props: {
  code: string;
  onClose: () => void;
  onOtp: () => void;
  onChanged: () => void;
}) {
  const [room, setRoom] = createSignal<AdminRoomPlayers | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [step, setStep] = createSignal<Step | null>(null);
  const [gone, setGone] = createSignal(false);

  async function load(): Promise<void> {
    const r = await fetchRoomPlayers(props.code);
    if (r.kind === "otp") return props.onOtp();
    if (r.kind === "error") {
      setRoom(null);
      setGone(true);
      setError(r.message);
      return;
    }
    setError(null);
    setRoom(r.data);
  }
  onMount(() => void load());

  async function confirm(): Promise<void> {
    const s = step();
    if (!s || busy()) return;
    setBusy(true);
    const r = s.op === "close" ? await closeRoom(props.code) : await kickPlayer(props.code, s.id);
    setBusy(false);
    setStep(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    setDone(r.message);
    props.onChanged();
    if (s.op === "close") {
      setRoom(null);
      setGone(true);
      return;
    }
    await load();
  }

  const text = (s: Step): string =>
    s.op === "close"
      ? `${props.code} odası kapatılacak: herkese "Oda yönetici tarafından kapatıldı." gösterilir, süren maç hesap istatistiği yazılmadan biter.`
      : `"${s.nickname}" odadan atılacak ve bu odaya 10 dakika giremeyecek.`;

  return (
    <section class="adm-card adm-detail" aria-labelledby="adm-drill-h">
      <header class="adm-section__head">
        <h3 id="adm-drill-h" class="adm-h3">
          Oda <span class="mono">{props.code}</span>
        </h3>
        <button type="button" class="adm-btn adm-btn--ghost adm-btn--small" onClick={props.onClose}>
          Kapat
        </button>
      </header>
      <Show when={error()}>
        {(e) => (
          <p class="adm-banner adm-banner--bad" role="alert">
            {e()}
          </p>
        )}
      </Show>
      <Show when={done()}>
        {(d) => (
          <p class="adm-banner adm-banner--ok" role="status">
            {d()}
          </p>
        )}
      </Show>
      <Show
        when={room()}
        fallback={<Show when={!gone() && !error()}>{<p class="adm-muted">Yükleniyor...</p>}</Show>}
      >
        {(r) => (
          <>
            <p class="adm-muted">
              Aşama: {phaseLabel(r().phase)}. Görünen adlar yalnız bu ekranda gösterilir; açman işlem kaydına
              yazıldı.
            </p>
            <div class="adm-table-wrap">
              <table class="adm-table adm-stack">
                <thead>
                  <tr>
                    <th>Ad</th>
                    <th>Tür</th>
                    <th>Durum</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={r().players}>
                    {(p) => (
                      <tr>
                        <td data-label="Ad" class="adm-wrap">
                          {p.nickname}
                          <Show when={p.host}>
                            <small class="adm-muted"> · ev sahibi</small>
                          </Show>
                        </td>
                        <td data-label="Tür">
                          {p.account ? "Hesaplı" : "Misafir"}
                          {p.spectator ? " · izleyici" : ""}
                        </td>
                        <td data-label="Durum" data-level={p.connected ? "ok" : "warn"}>
                          {p.connected ? "Bağlı" : "Bağlantı yok"}
                        </td>
                        <td data-label="İşlem">
                          <button
                            type="button"
                            class="adm-btn adm-btn--danger adm-btn--small"
                            onClick={() => setStep({ op: "kick", id: p.id, nickname: p.nickname })}
                          >
                            Oyuncuyu at
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <div class="adm-inline">
              <button type="button" class="adm-btn adm-btn--ghost adm-btn--small" onClick={() => void load()}>
                Yenile
              </button>
              <button
                type="button"
                class="adm-btn adm-btn--danger adm-btn--small"
                onClick={() => setStep({ op: "close" })}
              >
                Odayı kapat
              </button>
            </div>
          </>
        )}
      </Show>
      <Show when={step()}>
        {(s) => (
          <Confirm
            text={text(s())}
            danger
            busy={busy()}
            onConfirm={() => void confirm()}
            onCancel={() => setStep(null)}
          />
        )}
      </Show>
    </section>
  );
}
