import { createMemo, createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { hapticReady } from "../../fx/haptics.js";
import { toast } from "../../net/store.js";
import { clipFile, downloadCard, shareCard } from "../../share/shareFile.js";
import { Avatar } from "../../ui/Avatar.js";
import { GhostButton } from "../../ui/GhostButton.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import type { GameScreenProps } from "../registry.js";
import "../karalama-defteri/karalama.css";
import "./bozuk-telefon.css";
import { renderChainImage } from "./chainImage.js";
import { StepCard } from "./StepCard.js";
import { galleryPick } from "./story.js";
import { type ParsedRecap, parseBozukPublicView } from "./view.js";

/**
 * Oyun sonu açılışı (BT-U7): "Gecenin en komikleri" — her zincirin taçlı adımı yan yana. Karta dokununca zincirin
 * tamamı açılır; oradan "Zinciri kaydet" zinciri telefonda tek uzun PNG olarak çizer (paylaşım menüsü ya da indirme).
 */
export default function Reveal(props: GameScreenProps) {
  const recap = createMemo(() => parseBozukPublicView(props.match.publicView)?.recap ?? null);
  const person = (id: string) => props.players.find((p) => p.id === id);
  const [open, setOpen] = createSignal<number | null>(null);
  const [busy, setBusy] = createSignal(false);
  const current = () => {
    const i = open();
    return i === null ? null : (recap()?.[i] ?? null);
  };

  const save = async (r: ParsedRecap): Promise<void> => {
    if (busy()) return;
    setBusy(true);
    try {
      const blob = await renderChainImage(
        r,
        props.players.map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar })),
      );
      const file = clipFile(blob, `bozuk-telefon-zincir-${r.chain + 1}`, "png", "image/png");
      const nav = typeof navigator === "undefined" ? undefined : navigator;
      const out = await shareCard(nav, file);
      if (out === "unsupported") {
        downloadCard(file);
        toast("Zincir indirildi");
      }
      hapticReady();
    } catch {
      toast("Zincir kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Show when={recap()?.length ? recap() : null}>
      {(list) => (
        <section class="btg rise" aria-label="Gecenin en komikleri">
          <h2 class="btg__title">
            <span aria-hidden="true">👑</span> Gecenin en komikleri
          </h2>
          <ul class="btg__strip" data-scroll>
            <For each={list()}>
              {(r, k) => {
                const pick = () => galleryPick(r);
                const step = () => r.steps[pick()];
                const votes = () => r.tally[pick()] ?? 0;
                const author = () => person(step()?.author ?? "");
                return (
                  <li class="btg__item" style={{ "--i": k() }}>
                    <button
                      type="button"
                      class="btg__card"
                      data-crown={r.crowned.length > 0 ? "1" : undefined}
                      aria-label={`Zincir ${r.chain + 1}: aç ve kaydet`}
                      onClick={() => setOpen(k())}
                    >
                      <Show when={step()}>
                        {(s) => (
                          <StepCard
                            step={s()}
                            index={pick()}
                            variant="thumb"
                            crowned={r.crowned.length > 0}
                          />
                        )}
                      </Show>
                      <span class="btg__by">
                        <Show when={author()}>{(a) => <Avatar index={a().avatar} size={22} />}</Show>
                        <span>{votes() > 0 ? `😂 ${votes()}` : `Zincir ${r.chain + 1}`}</span>
                      </span>
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>
          <Show when={current()}>
            {(r) => (
              <Portal>
                <div
                  class="btz btz--chain kd bt"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Zincir ${r().chain + 1}`}
                >
                  <p class="btz__title">
                    Zincir {r().chain + 1} · {person(r().starter)?.nickname ?? ""} başlattı
                  </p>
                  <div class="btf btf--recap" data-scroll>
                    <For each={r().steps}>
                      {(s, i) => (
                        <div class="btf__item">
                          <StepCard
                            step={s}
                            index={i()}
                            author={person(s.author)}
                            crowned={r().crowned.includes(i())}
                            votes={r().tally[i()] ?? 0}
                            selfId={props.selfId}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="btz__actions">
                    <GhostButton size="small" class="btz__back" onClick={() => setOpen(null)}>
                      Kapat
                    </GhostButton>
                    <PrimaryButton instant busy={busy()} onClick={() => void save(r())}>
                      ZİNCİRİ KAYDET
                    </PrimaryButton>
                  </div>
                </div>
              </Portal>
            )}
          </Show>
        </section>
      )}
    </Show>
  );
}
