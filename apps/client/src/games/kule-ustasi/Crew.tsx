import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import { type KulePhase, type KuleScreenView, nextPlayer } from "./view.js";

interface Props {
  view: KuleScreenView | null;
  phase: KulePhase;
  players: GameScreenProps["players"];
  participants: readonly string[];
  selfId: string;
}

const fmtAward = (n: number): string => (n > 0 ? `+${n}` : "0");

/**
 * Oyuncu şeridi (KU-U7): avatar, usta puanı ve altında ★ kusursuz sayısı. Çıkanlar gri ve "çıktı" etiketli;
 * ıskalayanın avatarı çatlar. Sıradaki oyuncunun avatarında küçük "sıradaki" oku. Oyun bitince genel skora giden
 * +2 / +1 / 0 avatarın üstünde görünür.
 */
export function Crew(props: Props) {
  const strip = () => {
    const v = props.view;
    const ids = v ? v.order : props.participants;
    return ids
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  };
  const over = () => props.phase === "over";
  const next = () => {
    const v = props.view;
    return v && !over() ? nextPlayer(v) : null;
  };
  return (
    <footer class="kc" data-n={strip().length}>
      <For each={strip()}>
        {(p) => {
          const out = () => props.view?.eliminated.includes(p.id) ?? false;
          const isActive = () => !out() && props.view?.active === p.id && !over();
          const award = () => props.view?.awards?.[p.id];
          const stars = () => props.view?.perfects[p.id] ?? 0;
          return (
            <div
              class="kc__p"
              data-me={p.id === props.selfId ? "1" : undefined}
              data-active={isActive() ? "1" : undefined}
              data-out={out() ? "1" : undefined}
              data-next={next() === p.id ? "1" : undefined}
              data-award={award() !== undefined ? award() : undefined}
            >
              <span class="kc__av">
                <Avatar
                  index={p.avatar}
                  size="min(44px, calc((100vw - 40px - 42px) / 8))"
                  mood={out() ? "out" : undefined}
                  connected={p.connected}
                />
                <Show when={out()}>
                  <svg class="kc__crack" viewBox="0 0 40 40" aria-hidden="true">
                    <title>çatlak</title>
                    <path d="M21 2 L17 13 L24 19 L15 28 L19 38" />
                    <path d="M24 19 L33 22" />
                  </svg>
                  <span class="kc__tag">çıktı</span>
                </Show>
                <Show when={next() === p.id}>
                  <svg class="kc__next" viewBox="0 0 12 8" aria-hidden="true">
                    <path d="M6 0 L12 8 H0 Z" />
                  </svg>
                </Show>
                <Show when={award() !== undefined}>
                  <span class="kc__award">{fmtAward(award() ?? 0)}</span>
                </Show>
              </span>
              <span class="kc__usta">{props.view?.usta[p.id] ?? 0}</span>
              <span class="kc__stars" data-zero={stars() === 0 ? "1" : undefined}>
                ★{stars()}
              </span>
            </div>
          );
        }}
      </For>
    </footer>
  );
}
