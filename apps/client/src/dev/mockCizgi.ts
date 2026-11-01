/**
 * Yalnız geliştirme önizlemesi: Çizgiyi Geçme ekranları (`&n=2..8` oyuncu sayısı). Görünümler gerçek motordan
 * (setup + sahte seçimler) üretilir; saat, istenen anın "şimdi" olacağı şekilde kaydırılır. `&tur=1..2` gösterilen tur.
 *   ?mock=cizgi-briefing          anlatım (masanın platformlarıyla)
 *   ?mock=cizgi-choosing          seçim; kuleye dokununca seçim değişir (`&chosen=0` seçimsiz, `&at=ms` turun başından)
 *   ?mock=cizgi-locked            pinin kilitli (bayrak), radar bekleniyor
 *   ?mock=cizgi-radar             radar az önce çekildi (tarama, yanan platformlar); `&at=ms` radardan sonra
 *   ?mock=cizgi-last              son 5 sn (seçimsiz: "Seçmezsen pasif kalırsın!")
 *   ?mock=cizgi-reveal            tur açılışı (`&at=ms` açılıştan geçen süre; varsayılan sonuç ve "ne olurdu" satırı)
 *   ?mock=cizgi-reveal-crowd      herkes aynı platformlarda; -passive seçmeyenler; -peak Zirvede tek kalan sensin
 *   ?mock=cizgi-final             son tur açılışı ve iki turun toplamı
 *   ?mock=cizgi-spectator         katılımcı değilsin (izleyici)
 *   `&dondur=1` oyun saati istenen anda durur; `&koptu=1` son oyuncu kopuk; ?mock=tv-cizgi-…  büyük ekran
 */
import {
  CIZGI_CHOOSE_MS,
  CIZGI_RADAR_MS,
  CIZGI_ROUND_REVEAL_MS,
  type CizgiState,
  cizgiyiGecme,
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

const g = cizgiyiGecme;
const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: g.id,
  name: g.name,
  minPlayers: g.minPlayers,
  maxPlayers: g.maxPlayers,
  orientation: "portrait",
};
// 1. tur: p0 (sen) 72 ile tek; p1 ve p2 95/94 (5+ kişide aynı platform) çarpışır; p3 ikinci.
const ROUND1: (number | null)[] = [72, 95, 94, 38, 12, 99, 15, 55];
// 2. tur: herkes biraz aşağı kaçar; p0 yine 72 civarı, p1 Zirve.
const ROUND2: (number | null)[] = [66, 100, 88, 63, 30, 87, 9, 47];
const CROWD: (number | null)[] = [42, 45, 41, 48, 40, 44, 47, 43];
const PEAK: (number | null)[] = [100, 95, 94, 60, 12, 80, 15, null];

export function startCizgiMock(kind: string, params: URLSearchParams, tv = false): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(params.get("koptu") === "1" && i === n - 1),
    score: 0,
    spectator: false,
  }));
  const stage = kind.replace(/^cizgi-/, "");
  const spectator = tv || stage === "spectator";
  const ids = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const online = players.filter((p) => p.connected && ids.includes(p.id)).map((p) => p.id);
  const finalStage = stage === "final";
  const reveal = stage.startsWith("reveal") || finalStage;
  const r = finalStage ? 1 : Math.min(2, Math.max(1, Number(params.get("tur")) || 1)) - 1;
  const at = Number(params.get("at"));
  const ctx = (now: number) => ({ now, rng: createRng(1), connected: online });

  const S = r * (CIZGI_CHOOSE_MS + CIZGI_ROUND_REVEAL_MS);
  const E = S + CIZGI_CHOOSE_MS;
  const moment = (() => {
    switch (stage) {
      case "locked":
        return S + 6_000;
      case "radar":
        return S + CIZGI_RADAR_MS + (at > 0 ? at : 250);
      case "last":
        return E - 3_600;
      case "spectator":
        return S + CIZGI_RADAR_MS + 2_000;
      default:
        if (reveal) return E + (at > 0 ? at : 4_800);
        return S + (at > 0 ? at : 4_000);
    }
  })();
  const base = Date.now() - moment;
  const frozenAt = params.get("dondur") === "1" ? Date.now() : null;
  const clock = (): number => frozenAt ?? Date.now();
  if (frozenAt !== null) {
    const hold = () => setState({ clockOffset: frozenAt - Date.now() });
    hold();
    setInterval(hold, 16);
  }

  let state: CizgiState = g.setup(ids, ctx(base));
  const act = (s: CizgiState, id: string, action: unknown, t: number): CizgiState => {
    const parsed = g.parseAction(action);
    if (!parsed) return s;
    const res = g.reduce(s, id, parsed, ctx(t));
    return isRejected(res) ? s : res;
  };
  const valuesFor = (round: number): (number | null)[] => {
    if (stage.includes("crowd")) return CROWD;
    if (stage.includes("peak")) return PEAK;
    return round === 0 ? ROUND1 : ROUND2;
  };
  for (let i = 0; i <= r; i++) {
    const round = state.rounds[i];
    if (!round) continue;
    const current = i === r;
    const values = valuesFor(i);
    let t = round.startAt + 400;
    ids.forEach((id, k) => {
      const idx = spectator ? k + 1 : k;
      let v = values[idx] ?? null;
      if (stage.includes("passive") && k >= 3) v = null;
      if (current && !reveal && id === SELF && (params.get("chosen") === "0" || stage === "last")) v = null;
      if (v === null || t >= clock()) return;
      state = act(state, id, { kind: "choose", value: v }, t);
      t += 150;
    });
    if (current && !reveal) {
      const lockers = ids.slice(1, Math.max(1, Math.ceil(ids.length / 2)));
      if (stage === "locked") lockers.unshift(SELF);
      for (const id of lockers)
        state = act(state, id, { kind: "lock" }, Math.min(clock() - 1, round.startAt + 3_000));
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
      publicView: g.publicView(state, ctx(now)),
      view: g.view(state, spectator ? null : SELF, ctx(now)),
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
  // Radar, tur kapanışı ve tur geçişinde görünüm yenilensin.
  setInterval(() => {
    const next = g.tick(state, ctx(clock()));
    if (next !== state) {
      state = next;
      applySnapshot(snapshot());
    }
  }, 100);
}
