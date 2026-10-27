import { For, Show } from "solid-js";
import { Avatar } from "./Avatar.js";
import { CbState } from "./CbState.js";
import { type AckLike, createOptimistic, toAck } from "./optimistic.js";
import { PrimaryButton } from "./PrimaryButton.js";
import { useShell } from "./shell.js";

interface Props {
  /** Bu oyuncu kilitledi mi. */
  locked: boolean;
  /** Kilitleyen sayısı ve kilitleyebilecek toplam kişi. */
  ready: number;
  total: number;
  /** Hazır olanların kimlikleri; verilirse sayacın altında avatar noktaları çıkar. */
  readyIds?: readonly string[];
  /** Seçim yokken pasif. */
  disabled?: boolean;
  /** İzleyici: yalnız hazır sayacı görünür. */
  spectator?: boolean;
  /** Düğme yazısı (varsayılan "Tamam"). */
  label?: string;
  /** Kilitlenince düğmede görünen yazı. */
  doneLabel?: string;
  /** Basınca düğme hemen "Hazırsın"a döner; dönen yanıt reddedilirse geri alınır. */
  /** `false`: yerelde reddedildi; `sendActionAck` sözü: reddedilirse kilit geri açılır. */
  onLock: () => AckLike;
}

/** "Tamam" ile seçimi kesinleştirme: büyük düğme, kilitlenince "Diğerleri bekleniyor · 3/5 hazır". */
export function TamamBar(props: Props) {
  const [sent, setSent] = createOptimistic<boolean>(() => props.locked);
  const locked = () => props.locked || sent();
  // Kendi kilidin sunucu sayımına girene dek sayaç yerelde bir artar.
  const ready = () => (!props.locked && sent() ? Math.min(props.total, props.ready + 1) : props.ready);
  const count = () => `${ready()}/${props.total} hazır`;
  const shell = useShell();
  // Noktalar yalnız sayaçla aynı kişi kümesini gösterebiliyorsa çizilir.
  const dots = () => {
    const ids = props.readyIds;
    const crew = shell.crew();
    if (!ids || crew.length === 0 || crew.length !== props.total) return [];
    return crew.map((p) => ({ id: p.id, avatar: p.avatar, on: ids.includes(p.id) }));
  };
  const lock = (): void => {
    if (locked()) return;
    const result = props.onLock();
    // Oyun yerelde reddettiyse (ör. eksik seçim) kilitli görünmez.
    if (result === false) return;
    setSent(true, () => toAck(result));
  };

  return (
    <div class="tamam">
      <Show when={!props.spectator} fallback={<p class="tamam__count">{count()}</p>}>
        <Show
          when={locked()}
          fallback={
            <PrimaryButton
              instant
              disabled={props.disabled === true}
              onClick={lock}
              class={(props.label ?? "Tamam").length > 10 ? "pbtn--long" : ""}
            >
              {props.label ?? "Tamam"}
            </PrimaryButton>
          }
        >
          <PrimaryButton variant="done" disabled>
            {props.doneLabel ?? "Hazırsın"}
          </PrimaryButton>
          <p class="tamam__count" role="status">
            Diğerleri bekleniyor · {count()}
          </p>
        </Show>
        <Show when={!locked()}>
          <p class="tamam__count" data-quiet="1">
            {props.total > 0 ? count() : ""}
          </p>
        </Show>
      </Show>
      <Show when={dots().length > 0}>
        <ul class="tamam__dots" aria-hidden="true">
          <For each={dots()}>
            {(d) => (
              <li class="tamam__dot" data-on={d.on ? "1" : undefined}>
                {/* Kilitlemeyen düşünür (nokta balonu), kilitleyen sevinir. */}
                <Avatar
                  index={d.avatar}
                  size={20}
                  mood={d.on ? "happy" : "idle"}
                  live={d.on ? undefined : "think"}
                  ring={d.on ? "#B6FF3B" : undefined}
                />
                <Show when={d.on}>
                  <CbState kind="ok" size={10} class="tamam__cb" />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
