import type { AdminLive } from "@glix/engine";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { fetchLive } from "./api.js";
import { Spark } from "./charts.js";
import {
  fmtDateTime,
  fmtDuration,
  fmtInt,
  fmtNum,
  fmtRate,
  type Level,
  level,
  phaseLabel,
} from "./format.js";
import { RoomDrill } from "./RoomDrill.js";

/** Canlı durum 5 sn'de bir yenilenir; sekme gizliyken beklenir. */
export const LIVE_REFRESH_MS = 5000;
const HISTORY = 60;
/** Docker sınırı: 512 MB bellek, 2 çekirdek (deploy/docker-compose.yml). */
const MEM_LIMIT_MB = 512;

function Tile(props: { label: string; value: string; sub?: string; level?: Level; spark?: number[] }) {
  return (
    <div class="adm-tile" data-level={props.level ?? "ok"}>
      <span class="adm-tile__label">{props.label}</span>
      <strong class="adm-tile__value">{props.value}</strong>
      <Show when={props.sub}>
        <span class="adm-tile__sub">{props.sub}</span>
      </Show>
      <Show when={props.spark}>{(s) => <Spark values={s()} label={`${props.label} son değerler`} />}</Show>
    </div>
  );
}

export function LivePanel(props: { onOtp: () => void }) {
  const [data, setData] = createSignal<AdminLive | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [updatedAt, setUpdatedAt] = createSignal(0);
  /** Oyuncu listesi açık oda (görünen adlar yalnız bu ayrıntıda). */
  const [drill, setDrill] = createSignal<string | null>(null);
  const [hist, setHist] = createSignal<{ players: number[]; rss: number[]; cpu: number[] }>({
    players: [],
    rss: [],
    cpu: [],
  });

  let busy = false;
  async function refresh(): Promise<void> {
    if (busy) return;
    busy = true;
    const r = await fetchLive();
    busy = false;
    if (r.kind === "otp") {
      props.onOtp();
      return;
    }
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    setData(r.data);
    setUpdatedAt(Date.now());
    setHist((h) => ({
      players: [...h.players, r.data.players].slice(-HISTORY),
      rss: [...h.rss, r.data.memory.rssMb].slice(-HISTORY),
      cpu: [...h.cpu, r.data.cpuPercent].slice(-HISTORY),
    }));
  }

  onMount(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, LIVE_REFRESH_MS);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <section class="adm-section" aria-labelledby="adm-live-h">
      <header class="adm-section__head">
        <h2 id="adm-live-h">Canlı durum</h2>
        <span class="adm-muted" aria-live="polite">
          {updatedAt()
            ? `Son güncelleme ${fmtDateTime(updatedAt())} · 5 sn'de bir yenilenir`
            : "Yükleniyor..."}
        </span>
      </header>
      <Show when={error()}>
        {(e) => (
          <p class="adm-banner adm-banner--bad" role="alert">
            {e()}
          </p>
        )}
      </Show>
      <Show when={data()}>
        {(d) => (
          <>
            <Show when={d().draining}>
              <p class="adm-banner adm-banner--warn">
                Sunucu boşaltılıyor: yeni oda ve katılım kabul edilmiyor.
              </p>
            </Show>
            <div class="adm-tiles">
              <Tile label="Açık oda" value={fmtInt(d().rooms)} />
              <Tile label="Oyuncu" value={fmtInt(d().players)} spark={hist().players} />
              <Tile label="Süren maç" value={fmtInt(d().activeMatches)} />
              <Tile label="Sahne (TV)" value={fmtInt(d().stages)} />
              <Tile
                label="Bağlı soket"
                value={fmtInt(d().sockets.total)}
                sub={`${fmtInt(d().sockets.guests)} misafir · ${fmtInt(d().sockets.accounts)} hesaplı`}
              />
              <Tile
                label="Bellek (RSS)"
                value={`${fmtInt(d().memory.rssMb)} MB`}
                sub={`yığın ${fmtInt(d().memory.heapUsedMb)} / ${fmtInt(d().memory.heapTotalMb)} MB`}
                level={level(d().memory.rssMb / MEM_LIMIT_MB, 0.7, 0.9)}
                spark={hist().rss}
              />
              <Tile
                label="İşlemci"
                value={`%${fmtNum(d().cpuPercent)}`}
                sub="tek çekirdek = %100"
                level={level(d().cpuPercent, 100, 180)}
                spark={hist().cpu}
              />
              <Tile
                label="Olay döngüsü gecikmesi"
                value={`${fmtNum(d().eventLoopLagMsP95, 1)} ms`}
                sub="p95"
                level={level(d().eventLoopLagMsP95, 50, 200)}
              />
              <Tile
                label="Tick süresi"
                value={`${fmtNum(d().tickMsP95, 2)} ms`}
                sub="p95, son 600 tick"
                level={level(d().tickMsP95, 20, 60)}
              />
              <Tile label="Giden veri" value={fmtRate(d().bytesOutPerSec)} sub="son 10 sn ortalaması" />
              <Tile
                label="Çalışma süresi"
                value={fmtDuration(d().uptimeSec)}
                sub={`başlangıç ${fmtDateTime(d().startedAt)}`}
              />
              <Tile label="Sürüm" value={d().version} sub={`revizyon ${d().revision.slice(0, 12)}`} />
            </div>

            <h3 class="adm-h3">Açık odalar</h3>
            <Show when={d().roomList.length > 0} fallback={<p class="adm-muted">Şu an açık oda yok.</p>}>
              <div class="adm-table-wrap">
                <table class="adm-table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Aşama</th>
                      <th class="num">Oyuncu</th>
                      <th class="num">İzleyici</th>
                      <th class="num">Sahne</th>
                      <th>Oyun</th>
                      <th class="num">Yaş</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={d().roomList}>
                      {(r) => (
                        <tr>
                          <td class="mono">{r.code}</td>
                          <td>{phaseLabel(r.phase)}</td>
                          <td class="num">
                            {r.players}
                            <Show when={r.connected < r.players + r.spectators}>
                              <small class="adm-muted"> ({r.connected} bağlı)</small>
                            </Show>
                          </td>
                          <td class="num">{r.spectators}</td>
                          <td class="num">{r.stages}</td>
                          <td>{r.gameId ?? "—"}</td>
                          <td class="num">{fmtDuration(r.ageSec)}</td>
                          <td>
                            <button
                              type="button"
                              class="adm-btn adm-btn--ghost adm-btn--small"
                              aria-label={`${r.code} odasının oyuncuları ve işlemleri`}
                              onClick={() => setDrill(r.code)}
                            >
                              Oyuncular
                            </button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <Show when={d().rooms > d().roomList.length}>
                <p class="adm-muted">
                  En yeni {d().roomList.length} oda gösteriliyor (toplam {fmtInt(d().rooms)}).
                </p>
              </Show>
            </Show>
            <Show when={drill()} keyed>
              {(code) => (
                <RoomDrill
                  code={code}
                  onClose={() => setDrill(null)}
                  onOtp={props.onOtp}
                  onChanged={() => void refresh()}
                />
              )}
            </Show>
            <p class="adm-muted adm-note">
              Oyuncu adı ve oyun durumu tabloda gösterilmez; adlar yalnız "Oyuncular" ayrıntısında görünür ve
              her açış işlem kaydına yazılır.
            </p>
          </>
        )}
      </Show>
    </section>
  );
}
