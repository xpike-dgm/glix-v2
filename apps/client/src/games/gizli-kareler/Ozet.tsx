import type { KarelerPublicView } from "@glix/engine";
import { createMemo, For } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import type { SonucEntry } from "./KareSonuc.js";
import { type SummaryRow, summaryRows } from "./view.js";

const S1: Record<SummaryRow["s1"], { mark: string; label: string }> = {
  solo: { mark: "✓", label: "tek kaldı" },
  clash: { mark: "✕", label: "çakıştı" },
  passive: { mark: "–", label: "seçmedi" },
};
const S2: Record<SummaryRow["s2"], { mark: string; label: string }> = {
  solo: { mark: "✓", label: "tek kaldı" },
  clash: { mark: "✕", label: "çakıştı" },
  haunted: { mark: "✕", label: "hayalete çarptı" },
  passive: { mark: "–", label: "seçmedi" },
  ghost: { mark: "👻", label: "hayalet" },
  none: { mark: "", label: "oynanmadı" },
};

/** GK-U9: oyun içi özet tablosu: 1. aşama · 2. aşama · ödül · toplam; toplamı en yüksek en üstte. */
export function Ozet(props: {
  v: KarelerPublicView;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
}) {
  const rows = createMemo(() =>
    summaryRows(
      props.v,
      props.entries.map((e) => e.id),
    ),
  );
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  return (
    <table class="kozet" data-n={rows().length}>
      <caption class="sr-only">Gizli Kareler özeti</caption>
      <thead>
        <tr>
          <th scope="col">Oyuncu</th>
          <th scope="col">1.</th>
          <th scope="col">2.</th>
          <th scope="col">
            <span aria-hidden="true">⭐</span>
            <span class="sr-only">Ödül</span>
          </th>
          <th scope="col">Toplam</th>
        </tr>
      </thead>
      <tbody>
        <For each={rows()}>
          {(r) => {
            const e = () => byId().get(r.id);
            return (
              <tr data-me={!props.spectator && r.id === props.selfId ? "1" : undefined}>
                <th scope="row" class="kozet__who">
                  <Avatar index={e()?.avatar ?? 0} size="24px" connected={e()?.connected ?? true} />
                  <span class="kozet__name">{e()?.nickname ?? "Oyuncu"}</span>
                </th>
                <td data-k={r.s1} title={S1[r.s1].label}>
                  <span aria-hidden="true">{S1[r.s1].mark}</span>
                  <span class="sr-only">{S1[r.s1].label}</span>
                </td>
                <td data-k={r.s2} title={S2[r.s2].label}>
                  <span aria-hidden="true">{S2[r.s2].mark}</span>
                  <span class="sr-only">{S2[r.s2].label}</span>
                </td>
                <td data-k={r.bonus ? "bonus" : undefined}>{r.bonus ? "⭐" : ""}</td>
                <td class="kozet__total">+{r.total}</td>
              </tr>
            );
          }}
        </For>
      </tbody>
    </table>
  );
}
