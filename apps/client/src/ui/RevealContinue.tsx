import { type MatchReveal, type MatchSnapshot, REVEAL_CONTINUE_ARM_MS } from "@glix/engine";
import { Show } from "solid-js";
import { sendRevealContinue } from "../net/client.js";
import { useShell } from "./shell.js";
import { TamamBar } from "./TamamBar.js";

interface Props {
  match: MatchSnapshot;
  selfId: string;
  /** Sunucu saati (ms). */
  now: () => number;
  /** İzleyici: düğme yok, yalnız "n/m hazır" sayacı. */
  spectator?: boolean | undefined;
}

/**
 * Oyun içi sonuç ekranının ortak "Devam et" şeridi (docs/ERKEN-BITIS.md "Oyun içi sonuç ekranı"). Yalnız sunucu
 * oyunun son açılışını bildirdiyse (`match.reveal`) görünür. Bağlı katılımcıların hepsi basınca oyun biter; kimin
 * bastığı avatarlarla gösterilir. Düğme açılışın ilk `REVEAL_CONTINUE_ARM_MS`'inde pasiftir (yanlışlıkla geçilmesin);
 * basmak açılış animasyonunu kesmez. Her oyun bunu kendi sonuç ekranının altına koyar.
 */
export function RevealContinue(props: Props) {
  const shell = useShell();
  const online = () =>
    shell
      .crew()
      .filter((p) => p.connected)
      .map((p) => p.id);
  const reveal = (): MatchReveal | null | undefined => props.match.reveal ?? devReveal(online());
  return (
    <Show when={online().length > 0 ? reveal() : null}>
      {(r) => (
        <div class="rdevam">
          <TamamBar
            label="Devam et"
            locked={r().continueIds.includes(props.selfId)}
            ready={r().continueIds.filter((id) => online().includes(id)).length}
            total={online().length}
            crewIds={online()}
            readyIds={r().continueIds}
            disabled={props.now() < r().startedAt + REVEAL_CONTINUE_ARM_MS}
            spectator={props.spectator === true}
            onLock={() => sendRevealContinue(props.match.round)}
          />
        </div>
      )}
    </Show>
  );
}

/**
 * Yalnız geliştirme önizlemesi (`?mock=…&sonuc=1`): sahte ekranlarda sonuç ekranı şeridini göstermek için uydurma
 * açılış (diğer katılımcıların yarısı basmış). Üretim derlemesinde `import.meta.env.DEV` false olduğundan atılır.
 */
function devReveal(online: readonly string[]): MatchReveal | null {
  if (!import.meta.env.DEV || typeof location === "undefined") return null;
  if (new URLSearchParams(location.search).get("sonuc") !== "1") return null;
  const others = online.slice(1);
  return { startedAt: 0, endsAt: 60_000, continueIds: others.slice(0, Math.ceil(others.length / 2)) };
}
