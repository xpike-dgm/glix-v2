import { createMemo, For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { pressable } from "../../ui/press.js";
import { Seal, Table } from "./Art.js";
import { ringPosition, SEAL_FADE_MS, TALK_URGENT_MS } from "./view.js";

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

interface Props {
  crew: CrewMember[];
  selfId: string;
  /** Pazarlığın bitişi (sunucu saati, ms). */
  endsAt: number;
  /** Sunucu saati (tepkisel). */
  now: () => number;
  /** "Oylamaya geçelim" diyenler. */
  ready?: readonly string[];
  /** Söz işareti koyduğun oyuncular (yalnız sana görünür). */
  promised?: readonly string[];
  /** Söz mührünün konduğu an (yerel saat); 3 sn sonra mühür soluklaşır (IT-U10). */
  placedAt?: Readonly<Record<string, number>>;
  /** Şerit basılı tutuluyor: mühürler ve ipler tam görünür. */
  peek?: boolean;
  /** Sınır doluyken dokunulan portre (sallanır). */
  shake?: string | null;
  /** Az önce sözü geri alınan portre (mühür kırılıp düşer). */
  broken?: string | null;
  /** Verilirse portrelere dokununca söz işareti konur/kalkar (izleyicide verilmez). */
  onPromise?: (id: string) => void;
  /** Yerel saat (mühür soluklaşması için; tepkisel). */
  clock: () => number;
  /** Büyük ekran: daha büyük portreler. */
  tv?: boolean;
}

function PromiseTap(props: { m: CrewMember; on: boolean; onPromise: (id: string) => void }) {
  // Parmak dokunur dokunmaz etkinleşir; klavye/ekran okuyucu `click` ile.
  const press = pressable(() => props.onPromise(props.m.id));
  return (
    <button
      type="button"
      class="it__tap"
      data-on={props.on ? "1" : undefined}
      aria-pressed={props.on}
      aria-label={
        props.on ? `${props.m.nickname} için söz işaretini geri al` : `${props.m.nickname} için söz işareti`
      }
      onPointerDown={press.onPointerDown}
      onClick={press.onClick}
    />
  );
}

/**
 * Müzakere masası (IT-U1): portreler yuvarlak masanın çevresinde, sayaç masanın ortasında büyük. Yalnız gerçek bilgi
 * çizilir: senin söz verdiğin portrelere senden çıkan altın ip ve mühür (yalnız sende), "Oylamaya geç" diyenlerde ✓.
 * Hiçbir söz ya da anlaşma kaydedilmez; söz işareti puansız bir hatırlatmadır.
 */
export function Pazarlik(props: Props) {
  const pos = (i: number) => ringPosition(i, props.crew.length, 39);
  const left = () => Math.max(0, Math.ceil((props.endsAt - props.now()) / 1000));
  const urgent = () => props.endsAt - props.now() <= TALK_URGENT_MS;
  const selfIndex = createMemo(() => props.crew.findIndex((m) => m.id === props.selfId));
  const dim = (id: string): boolean => {
    if (props.peek) return false;
    const at = props.placedAt?.[id];
    return at === undefined || props.clock() - at >= SEAL_FADE_MS;
  };
  const threads = createMemo(() => {
    const me = selfIndex();
    if (me < 0) return [];
    const a = pos(me);
    return props.crew.flatMap((m, i) => (props.promised?.includes(m.id) ? [{ id: m.id, a, b: pos(i) }] : []));
  });
  return (
    <div class="it__stage">
      <div
        class="it__arena"
        data-urgent={urgent() ? "1" : undefined}
        data-tv={props.tv ? "1" : undefined}
        data-crowd={props.crew.length >= 7 ? "1" : undefined}
      >
        <Table urgent={urgent()} />
        <svg class="it__threads" viewBox="0 0 100 100" aria-hidden="true">
          <For each={threads()}>
            {(t) => (
              <line
                class="it__thread"
                data-dim={dim(t.id) ? "1" : undefined}
                x1={t.a.x}
                y1={t.a.y}
                x2={t.b.x}
                y2={t.b.y}
              />
            )}
          </For>
        </svg>

        <div class="it__clock" role="timer" aria-label={`Kalan süre ${left()} saniye`}>
          <span class="it__clock-num">{left()}</span>
          <span class="it__clock-unit">saniye</span>
        </div>

        <For each={props.crew}>
          {(m, i) => {
            const on = () => props.promised?.includes(m.id) === true;
            return (
              <div
                class="it__node"
                data-me={m.id === props.selfId ? "1" : undefined}
                data-shake={props.shake === m.id ? "1" : undefined}
                style={{ left: `${pos(i()).x}%`, top: `${pos(i()).y}%` }}
              >
                <Avatar
                  index={m.avatar}
                  size="var(--it-av)"
                  connected={m.connected}
                  ready={props.ready?.includes(m.id) === true}
                />
                <Show when={on()}>
                  <span class="it__seal" data-dim={dim(m.id) ? "1" : undefined}>
                    <Seal />
                  </span>
                </Show>
                <Show when={props.broken === m.id && !on()}>
                  <span class="it__seal it__seal--broken">
                    <Seal broken />
                  </span>
                </Show>
                <Show when={props.onPromise && m.id !== props.selfId}>
                  <PromiseTap m={m} on={on()} onPromise={(id) => props.onPromise?.(id)} />
                </Show>
                <span class="it__name">{m.nickname}</span>
                <Show when={!m.connected}>
                  <span class="it__off">bağlantı yok</span>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
