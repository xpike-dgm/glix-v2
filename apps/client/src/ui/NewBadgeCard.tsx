import { type Accessor, createMemo, createSignal, onMount, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { type BadgeFamily, type BadgeInfo, badgeFamily } from "../net/badgeRules.js";
import { dismissBadges, freshBadges } from "../net/badges.js";
import { BadgeMedal } from "./BadgeMedal.js";
import { PrimaryButton } from "./PrimaryButton.js";

/**
 * "Yeni rozet!" kutlaması: kutu yok; ekran kararır, madalyonun arkasında aile renginde dönen ışık demeti ve
 * parlama, çevresinde konfeti olur; madalyon büyüyerek (hafif dönerek) gelir, altında ad ve açıklama.
 * Birden çok rozet varsa sırayla gösterilir. Yalnız transform/opacity hareket eder; hareket azaltma tercihinde
 * (base.css) hiçbir şey oynamaz, ışık durağan kalır.
 */
export function NewBadgeCard() {
  return (
    <Show when={freshBadges().length > 0}>
      <NewBadgeBody />
    </Show>
  );
}

function NewBadgeBody() {
  const [at, setAt] = createSignal(0);
  const total = () => freshBadges().length;
  const current = createMemo((): BadgeInfo | null => freshBadges()[Math.min(at(), total() - 1)] ?? null);
  const next = (): void => {
    if (at() >= total() - 1) dismissBadges();
    else setAt(at() + 1);
  };
  return (
    <div class="nbc" role="dialog" aria-modal="true" aria-label="Yeni rozet">
      <Show when={current()} keyed>
        {(b) => <Reveal badge={b} index={at} total={total} onNext={next} />}
      </Show>
    </div>
  );
}

/** Konfeti parçaları: sabit formülle dağılır (rastgelelik yok; her açılışta aynı görünür). */
const PIECES = Array.from({ length: 18 }, (_, i) => {
  const a = ((i * 20 + ((i * 37) % 13)) * Math.PI) / 180;
  const dist = 84 + ((i * 53) % 76);
  return {
    dx: Math.round(Math.cos(a) * dist * 1.25),
    dy: Math.round(Math.sin(a) * dist * 0.85 - 24),
    rot: (i % 2 === 0 ? 1 : -1) * (160 + ((i * 67) % 220)),
    delay: ((i % 6) * 0.14).toFixed(2),
    size: 6 + (i % 3) * 2,
    tone: i % 3,
  };
});

function Reveal(props: {
  badge: BadgeInfo;
  index: Accessor<number>;
  total: Accessor<number>;
  onNext: () => void;
}) {
  let actRef: HTMLDivElement | undefined;
  const family = (): BadgeFamily => badgeFamily(props.badge.id, props.badge.secret);
  onMount(() => {
    hapticTap();
    actRef?.querySelector("button")?.focus({ preventScroll: true });
  });
  return (
    <div class="nbc__stage" data-family={family()}>
      <div class="nbc__hero" aria-hidden="true">
        <div class="nbc__rays" />
        <div class="nbc__rays nbc__rays--b" />
        <div class="nbc__glow" />
        <div class="nbc__sparks">
          {PIECES.map((p) => (
            <i
              class="nbc__piece"
              data-tone={p.tone}
              style={{
                "--dx": `${p.dx}px`,
                "--dy": `${p.dy}px`,
                "--rot": `${p.rot}deg`,
                "--d": `${p.delay}s`,
                "--s": `${p.size}px`,
              }}
            />
          ))}
        </div>
        <div class="nbc__medal">
          <div class="nbc__float">
            <BadgeMedal id={props.badge.id} earned secret={props.badge.secret} size={200} />
          </div>
        </div>
      </div>
      <div class="nbc__text">
        <p class="overline nbc__over">
          Yeni rozet!
          <Show when={props.total() > 1}>
            <span class="nbc__count">
              {" "}
              · {props.index() + 1} / {props.total()}
            </span>
          </Show>
        </p>
        <h2 class="nbc__name">{props.badge.name}</h2>
        <p class="nbc__desc">{props.badge.description}</p>
        <div ref={actRef} class="nbc__act">
          <PrimaryButton onClick={props.onNext}>Harika!</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
