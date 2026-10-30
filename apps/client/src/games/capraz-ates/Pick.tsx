import type { CaprazAtesRoundReveal, PlayerInfo } from "@glix/engine";
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import type { AckLike } from "../../ui/optimistic.js";
import { pressable } from "../../ui/press.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { MiniRing } from "./Arena.js";
import { Duel } from "./Fx.js";
import { BulletIcon, LockIcon, ReticleRing, ShieldIcon } from "./Icons.js";
import { Sight } from "./Sight.js";
import { badgesOf, gridColumns, RING, ringAvatar, ringPosition } from "./view.js";

const LOCK_RED = "#FF3B5C";

interface Props {
  /** Bütün katılımcılar (katılım sırasıyla). */
  crew: readonly PlayerInfo[];
  selfId: string;
  spectator: boolean;
  round: 1 | 2;
  /** Tur 2'de tur 1'in sonucu (herkese açık). */
  first: CaprazAtesRoundReveal | undefined;
  mine: string | null;
  cover: boolean;
  locked: boolean;
  closed: boolean;
  lockedIds: readonly string[];
  onPick: (id: string) => void;
  onCover: () => void;
  onLock: () => AckLike;
  onOpenRing: () => void;
  /** Düello anı (son 5 sn): null yok, "" yalnız karartma, "3" | "2" | "1". */
  duel: string | null;
}

interface Geo {
  /** Hedef portresinin merkezi ve boyu (sarmalayıcıya göre px). */
  tx: number;
  ty: number;
  size: number;
  /** Kendi avatarının merkezi (lazer başlangıcı); izleyicide yok. */
  sx: number | null;
  sy: number | null;
}

/** Hedef seçimi: portre ızgarası (izleyicide büyük halka), kayan nişangâh, lazer, siper ve "ATEŞE HAZIR". */
export function Pick(props: Props) {
  const others = () => props.crew.filter((p) => p.id !== props.selfId);
  const self = () => props.crew.find((p) => p.id === props.selfId);
  const target = () => (props.mine === null ? null : (props.crew.find((p) => p.id === props.mine) ?? null));
  const ready = (id: string) => props.lockedIds.includes(id);
  const busy = () => props.spectator || props.closed || props.locked;

  let wrap: HTMLDivElement | undefined;
  let selfEl: HTMLSpanElement | undefined;
  const cells = new Map<string, HTMLElement>();
  const [geo, setGeo] = createSignal<Geo | null>(null);
  const measure = (): void => {
    const id = props.mine;
    const el = id === null || props.cover ? undefined : cells.get(id);
    if (!wrap || !el) {
      setGeo(null);
      return;
    }
    const w = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const s = selfEl?.getBoundingClientRect();
    setGeo({
      tx: r.left - w.left + r.width / 2,
      ty: r.top - w.top + r.height / 2,
      size: r.width,
      sx: s ? s.left - w.left + s.width / 2 : null,
      sy: s ? s.top - w.top + s.height / 2 : null,
    });
  };
  let raf = 0;
  const schedule = (): void => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(measure);
  };
  onMount(() => {
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    onCleanup(() => ro.disconnect());
  });
  onCleanup(() => cancelAnimationFrame(raf));
  // Hedef değişince nişangâh yeni portreye kayar ve yeniden "kilitlenir" (yakınlaşma animasyonu tekrar oynar).
  const [zoomKey, setZoomKey] = createSignal(false);
  createEffect(
    on(
      () => [props.mine, props.cover] as const,
      () => {
        setZoomKey((k) => !k);
        schedule();
      },
    ),
  );

  const gridVars = () => {
    const n = others().length;
    const tall = gridColumns(n);
    const wide = gridColumns(n, true);
    return {
      "--cols-tall": tall,
      "--rows-tall": Math.ceil(n / tall),
      "--cols-wide": wide,
      "--rows-wide": Math.ceil(n / wide),
    };
  };

  const hint = () => {
    if (props.spectator) return "Hedefler süre bitince açılır";
    if (props.closed) return "Hedefler açılıyor…";
    if (props.locked) return props.cover ? "Kalkanın hazır" : "Nişan kilitli, ateşe hazırsın";
    if (props.cover) return "Siperdesin; istersen yine nişan alabilirsin";
    if (props.mine !== null) return "Değiştirebilir ya da ateşe hazır olabilirsin";
    return props.round === 2 ? "İntikam mı, siper mi?" : "Birini hedefle ya da siper al";
  };

  return (
    <div
      class="cx__pick"
      ref={wrap}
      data-cover={props.cover && !props.spectator ? "1" : undefined}
      data-round={props.round}
      data-crowd={others().length >= 6 ? "1" : undefined}
    >
      {/* Lazer: yalnız kendi ekranında, kendi avatarından hedefe. Portrelerin arkasından geçer. */}
      <Show when={!props.spectator && geo()}>
        {(g) => (
          <Show when={g().sx !== null}>
            <svg class="cx__laser" aria-hidden="true">
              <line
                class="cx__laser-line"
                x1={g().sx ?? 0}
                y1={g().sy ?? 0}
                x2={g().tx}
                y2={g().ty}
                data-locked={props.locked ? "1" : undefined}
              />
            </svg>
          </Show>
        )}
      </Show>

      <div class="cx__head" data-ring={props.round === 2 && props.first ? "1" : undefined}>
        <Show when={props.round === 2 && props.first}>
          {(first) => (
            <>
              <button
                type="button"
                class="cx__mini"
                aria-label="Tur 1'de kim kimi vurdu"
                onClick={() => props.onOpenRing()}
              >
                <MiniRing crew={props.crew} reveal={first()} />
                <span class="cx__mini-tag">Tur 1</span>
              </button>
            </>
          )}
        </Show>
        <span class="overline">
          Tur {props.round}/2 ·{" "}
          {props.spectator ? "Gizli nişan" : props.round === 2 ? "İntikam" : "Gizli hedefin"}
        </span>
        <Show
          when={!props.spectator && (target() || props.cover)}
          fallback={<span class="cx__title">{props.spectator ? "Herkes nişanda" : "Kimi vuracaksın?"}</span>}
        >
          <Show
            when={!props.cover && target()}
            fallback={<span class="cx__title cx__title--cover">Siperdesin</span>}
          >
            {(p) => (
              <span class="cx__title cx__title--locked" style={{ "--tc": look(p().avatar).color }}>
                {p().nickname}
              </span>
            )}
          </Show>
        </Show>
      </div>

      <div class="cx__stage">
        <Show when={!props.spectator} fallback={<WatchRing crew={props.crew} ready={ready} />}>
          <div class="cx__grid" style={gridVars()} data-badges={props.round === 2 ? "1" : undefined}>
            <For each={others()}>
              {(p, i) => {
                const aimed = () => !props.cover && props.mine === p.id;
                const press = pressable(() => {
                  if (p.connected) props.onPick(p.id);
                });
                const b = () => badgesOf(props.first, props.selfId, p.id);
                onCleanup(() => cells.delete(p.id));
                return (
                  <div
                    class="cx__slot"
                    data-locked={aimed() ? "1" : undefined}
                    data-off={p.connected ? undefined : "1"}
                    data-idle={busy() ? "1" : undefined}
                    style={{
                      "--dur": `${7.5 + ((i() * 1.3) % 4)}s`,
                      "--delay": `${-((i() * 1.7) % 6)}s`,
                      "--flip": i() % 2 === 0 ? 1 : -1,
                    }}
                  >
                    <button
                      type="button"
                      class="cx__cell"
                      data-locked={aimed() ? "1" : undefined}
                      data-off={p.connected ? undefined : "1"}
                      disabled={busy() || !p.connected}
                      aria-pressed={aimed()}
                      aria-label={`${p.nickname} hedef al`}
                      onPointerDown={press.onPointerDown}
                      onClick={press.onClick}
                    >
                      <span class="cx__portrait" ref={(el) => cells.set(p.id, el)}>
                        <Avatar
                          index={p.avatar}
                          size="var(--cx-av)"
                          connected={p.connected}
                          ring={aimed() ? LOCK_RED : undefined}
                          ready={ready(p.id)}
                        />
                      </span>
                      <span class="cx__name">{p.nickname}</span>
                    </button>
                    <span class="cx__sightbox" aria-hidden="true">
                      <span class="cx__sight">
                        <Sight />
                      </span>
                    </span>
                    <Show when={props.round === 2}>
                      <span class="cx__badges">
                        <Show when={b().shotYou && b().youShot}>
                          <span class="cx__badge" data-k="both">
                            karşılıklı
                          </span>
                        </Show>
                        <Show when={b().shotYou && !b().youShot}>
                          <span class="cx__badge" data-k="shot">
                            seni vurdu
                          </span>
                        </Show>
                        <Show when={b().youShot && !b().shotYou}>
                          <span class="cx__badge" data-k="you">
                            vurdun
                          </span>
                        </Show>
                        <Show when={b().cover}>
                          <span class="cx__badge" data-k="cover" title="Tur 1'de siperdeydi">
                            <ShieldIcon size={12} />
                          </span>
                        </Show>
                      </span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Düello karartması ızgaranın üstünde, alttaki düğmelerin altında kalır (okunur kalırlar). */}
      <Show when={props.duel !== null}>
        <Duel label={props.duel ?? ""} />
      </Show>

      {/* Kayan nişangâh: seçilen portreye kayarak kilitlenir; kırmızı lazer noktası titrer. */}
      <Show when={!props.spectator}>
        <div
          class="cx__reticle"
          aria-hidden="true"
          data-on={geo() ? "1" : undefined}
          data-locked={props.locked ? "1" : undefined}
          style={{
            transform: `translate(${geo()?.tx ?? 0}px, ${geo()?.ty ?? 0}px)`,
            "--rs": `${Math.round((geo()?.size ?? 80) * 1.22)}px`,
          }}
        >
          <span class="cx__reticle-in" data-k={zoomKey() ? "a" : "b"}>
            <ReticleRing />
            <i class="cx__dot" />
            <span class="cx__reticle-lock">
              <LockIcon size={18} />
            </span>
          </span>
        </div>
      </Show>

      <Show when={!props.spectator}>
        <div class="cx__deck">
          <Show when={self()}>
            {(me) => (
              <span class="cx__me" ref={selfEl}>
                <Avatar index={me().avatar} size={44} />
                <i class="cx__gun" aria-hidden="true" />
              </span>
            )}
          </Show>
          <button
            type="button"
            class="cx__cover-btn"
            aria-pressed={props.cover}
            disabled={busy()}
            onClick={() => props.onCover()}
          >
            <ShieldIcon size={18} />
            <span>{props.cover ? "Siperdesin" : "Siper al"}</span>
          </button>
        </div>
        <Show when={props.cover}>
          <i class="cx__dome" aria-hidden="true" />
        </Show>
      </Show>

      <p class="cx__hint" role="status">
        {hint()}
      </p>
      <TamamBar
        spectator={props.spectator}
        locked={props.locked}
        disabled={props.closed || (props.mine === null && !props.cover)}
        ready={props.lockedIds.length}
        readyIds={props.lockedIds}
        total={props.crew.length}
        label="ATEŞE HAZIR"
        doneLabel="Ateşe hazırsın"
        dots={false}
        onLock={props.onLock}
      />
      <ul class="cx__ready" aria-hidden="true">
        <For each={props.crew}>
          {(p) => (
            <li class="cx__ready-item" data-on={ready(p.id) ? "1" : undefined}>
              <Avatar index={p.avatar} size={22} />
              <span class="cx__ready-ammo">
                <BulletIcon size={12} />
              </span>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

/** İzleyici/TV: büyük halka; her portrede dönen nişangâh (kimin kimi hedeflediği yok), hazırlarda mermi. */
function WatchRing(props: { crew: readonly PlayerInfo[]; ready: (id: string) => boolean }) {
  return (
    <div class="cx__arena cx__arena--watch" style={{ "--cx-rav": ringAvatar(props.crew.length) }}>
      <For each={props.crew}>
        {(p, i) => {
          const pos = () => ringPosition(i(), props.crew.length, RING.radius, RING.cy);
          return (
            <div
              class="cx__node"
              data-ready={props.ready(p.id) ? "1" : undefined}
              style={{ left: `${pos().x}%`, top: `${pos().y}%`, "--delay": `${-i() * 0.7}s` }}
            >
              <span class="cx__body">
                <Avatar index={p.avatar} size="var(--cx-rav)" connected={p.connected} />
              </span>
              <span class="cx__wsight" aria-hidden="true">
                <ReticleRing />
              </span>
              <span class="cx__rname">{p.nickname}</span>
              <Show when={props.ready(p.id)}>
                <span class="cx__chip cx__chip--ammo">
                  <BulletIcon size={14} />
                </span>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
