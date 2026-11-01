/**
 * Yalnız geliştirme önizlemesi: Açgözlülük Limiti ekranları (`&n=3..8` oyuncu sayısı). Görünümler gerçek motordan
 * (setup + sahte seçimler) üretilir; saat, istenen anın "şimdi" olacağı şekilde kaydırılır. `&tur=1..3` gösterilen tur.
 *   ?mock=acgozluluk-briefing        anlatım (masanın sayılarıyla)
 *   ?mock=acgozluluk-choosing        seçim; sayıya dokununca seçim değişir (`&chosen=0` seçimsiz, `&open=1` açılış sahnesi,
 *                                    `&at=ms` turun başından geçen süre, varsayılan 2000)
 *   ?mock=acgozluluk-locked          seçimin mühürlü, diğerleri bekleniyor
 *   ?mock=acgozluluk-door            son 5 sn: kasa kapısı iniyor
 *   ?mock=acgozluluk-scout           bu tur Gözcü sensin (bakmadan önce); `&at=ms` bakıştan sonra (anahtar deliği)
 *   ?mock=acgozluluk-reveal-ok       tur açıldı, sığdı; -over taştı, -full ağzına kadar, -boom patladı
 *                                    (`&at=ms` açılıştan geçen süre; varsayılan karar ve "ne olurdu" satırından sonra)
 *   ?mock=acgozluluk-final           son tur açılışı (+2 / +1 rozetleri); `&tur` yok sayılır
 *   ?mock=acgozluluk-spectator       katılımcı değilsin (izleyici)
 *   `&dondur=1` oyun saati istenen anda durur (ekran denetimi: ölçüm sürerken tur kapanmaz, kapı inmez)
 *   `&koptu=1` son oyuncu kopuk; ?mock=tv-acgozluluk-…  büyük ekran (izleyici kipinde StageView)
 */
import {
  type AcgozlulukState,
  acgozlulukLimiti,
  createRng,
  type GameInfo,
  isRejected,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const g = acgozlulukLimiti;
const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: g.id,
  name: g.name,
  minPlayers: g.minPlayers,
  maxPlayers: g.maxPlayers,
  orientation: "portrait",
};

type Outcome = "ok" | "over" | "full" | "boom";

/** Bir turun sahte seçimleri: `outcome`a göre toplam limitin altında, üstünde ya da tam limitte. */
function plan(
  ids: readonly string[],
  outcome: Outcome,
  limit: number,
  selfSkip: boolean,
): Record<string, number> {
  const n = ids.length;
  const out: Record<string, number> = {};
  if (outcome === "full") {
    const base = Math.floor(limit / n);
    let rest = limit - base * n;
    for (const id of ids) {
      out[id] = Math.min(n, base + (rest > 0 ? 1 : 0));
      rest--;
    }
    return out;
  }
  ids.forEach((id, i) => {
    const fair = Math.floor(limit / n);
    const v =
      outcome === "ok"
        ? Math.max(0, fair - (i % 3 === 1 ? 1 : 0) - (i === n - 1 ? 2 : 0))
        : outcome === "boom"
          ? n - (i % 2)
          : fair + (i % 2 === 0 ? 1 : 0);
    out[id] = Math.max(0, Math.min(n, v));
  });
  if (selfSkip) delete out[SELF];
  return out;
}

export function startAcgozlulukMock(kind: string, params: URLSearchParams, tv = false): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(params.get("koptu") === "1" && i === n - 1),
    score: 0,
    spectator: false,
  }));
  const stage = kind.replace(/^acgozluluk-/, "");
  const spectator = tv || stage === "spectator";
  const ids = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const online = players.filter((p) => p.connected && ids.includes(p.id)).map((p) => p.id);
  const finalStage = stage === "final";
  const reveal = stage.startsWith("reveal") || finalStage;
  const outcome: Outcome = finalStage ? "ok" : ((stage.split("-")[1] as Outcome | undefined) ?? "ok");
  const r = finalStage ? 2 : Math.min(3, Math.max(1, Number(params.get("tur")) || 1)) - 1;
  const at = Number(params.get("at"));
  const ctx = (now: number) => ({ now, rng: createRng(1), connected: online });

  // Oyun anı (setup'tan ms): turlar 17 sn arayla (12 sn seçim + 5 sn ara açılış).
  const S = r * 17_000;
  const E = S + 12_000;
  const moment = (() => {
    switch (stage) {
      case "locked":
        return S + 3_000;
      case "door":
        return S + 7_300;
      case "scout":
        return at > 0 ? S + 7_000 + at : S + 2_000;
      case "spectator":
        return S + 3_000;
      default:
        if (reveal) return E + (at > 0 ? at : finalStage ? 5_200 : 4_600);
        return params.has("open") ? S + 100 : S + (at > 0 ? at : 2_000);
    }
  })();
  const base = Date.now() - moment;
  // `&dondur=1`: oyun saati bu anda durur (motor görünümleri ve ekranın sunucu saati).
  const frozenAt = params.get("dondur") === "1" ? Date.now() : null;
  const clock = (): number => frozenAt ?? Date.now();
  if (frozenAt !== null) {
    const hold = () => setState({ clockOffset: frozenAt - Date.now() });
    hold();
    setInterval(hold, 16);
  }

  let state: AcgozlulukState = g.setup(ids, {
    now: base,
    rng: createRng(Number(params.get("tohum")) || 4),
    connected: online,
  });
  // Gözcü: `scout` evresinde sen; diğerlerinde ikinci oyuncu (tur başına sırayla).
  const order = [...ids];
  if (!spectator) {
    const want = stage === "scout" ? SELF : (ids[1] as string);
    const rest = order.filter((id) => id !== want);
    rest.splice(r % ids.length, 0, want);
    order.splice(0, order.length, ...rest);
  }
  state = { ...state, scoutOrder: order, offline: ids.filter((id) => !online.includes(id)) };
  // Gerçek limitler: bandın içinde; "ağzına kadar" turunda tam toplam.
  const mid = (state.band.low + state.band.high) / 2;
  const outcomes: Outcome[] = [r === 0 ? outcome : "ok", r === 1 ? outcome : "over", outcome];
  state = {
    ...state,
    rounds: state.rounds.map((round, i) => ({
      ...round,
      limit: outcomes[i] === "full" ? Math.round(mid) : round.limit,
      // Gözcü sırası değişti: kurulumdaki atama yeniden yapılsın.
      assigned: false,
      scoutId: null,
    })),
  };

  const act = (s: AcgozlulukState, id: string, action: unknown, t: number): AcgozlulukState => {
    const parsed = g.parseAction(action);
    if (!parsed) return s;
    const res = g.reduce(s, id, parsed, ctx(t));
    return isRejected(res) ? s : res;
  };
  for (let i = 0; i <= r; i++) {
    const round = state.rounds[i];
    if (!round) continue;
    const current = i === r;
    const skipSelf = current && !reveal && params.get("chosen") === "0";
    const values = plan(ids, outcomes[i] ?? "ok", round.limit, skipSelf);
    if (current && !reveal && !skipSelf) values[SELF] = Math.min(n, 2);
    let t = round.startAt + 400;
    for (const id of ids) {
      if (!current && i === 0 && id === ids[ids.length - 1]) continue; // ilk turda biri seçmedi (0 · seçmedi)
      const v = values[id];
      if (v === undefined) continue;
      if (t >= clock()) break;
      state = act(state, id, { kind: "choose", value: v }, t);
      t += 150;
    }
    if (current && !reveal) {
      const lockers = ids.slice(1, Math.max(1, Math.ceil(ids.length / 2)));
      if (stage === "locked") lockers.unshift(SELF);
      for (const id of lockers)
        state = act(state, id, { kind: "lock" }, Math.min(clock() - 1, round.startAt + 2_000));
    }
  }
  state = g.tick(state, ctx(clock()));

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let rev = 1;

  const snapshot = (): RoomSnapshot => {
    const now = clock();
    if (stage === "briefing") {
      phase = "briefing";
      readyIds = ids.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const pub = g.publicView(state, ctx(now));
    const priv = g.view(state, spectator ? null : SELF, ctx(now));
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: g.briefing.goal, steps: [...g.briefing.steps] },
      orientation: "portrait",
      participants: ids,
      readyIds,
      continueIds: [],
      phaseStartedAt: state.startedAt,
      phaseEndsAt,
      publicView: pub,
      view: priv,
      result: null,
    };
    return {
      rev: ++rev,
      serverNow: now,
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [INFO.id],
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [INFO],
      match,
    };
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action" || spectator) return;
    const next = act(state, SELF, msg.payload, clock());
    if (next !== state) {
      state = next;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
  // Bakış, tur kapanışı ve tur geçişinde görünüm yenilensin.
  setInterval(() => {
    const next = g.tick(state, ctx(clock()));
    if (next !== state) {
      state = next;
      applySnapshot(snapshot());
    }
  }, 100);
}
