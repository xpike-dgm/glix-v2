/**
 * Yalnız geliştirme önizlemesi: Kontrol Paneli Kaosu ekranları (`&n=2..8` oyuncu sayısı). Durum gerçek oyun
 * kuralıyla (motorun `setup` / `reduce` / `view`) kurulur; böylece ekranlar kuralla birebir aynı veriyi gösterir.
 *   ?mock=kontrol-briefing          anlatım
 *   ?mock=kontrol-play              dalga: kablo seç, KES (`&wave=1..3`; `&clue=3` üç koşullu ipucu;
 *                                   `&kind=notAt|adjacent|above|position|mixed` dalga 2-3 ipucu türü)
 *   ?mock=kontrol-cut               kesim yapıldı, diğerleri bekleniyor
 *   ?mock=kontrol-jump              son 10 sn: biri yanlış kesti, saat 5 sn atlar (flaş + "bzzzt")
 *   ?mock=kontrol-break             dalgalar arası kısa sonuç (`&wave=1..2`)
 *   ?mock=kontrol-reveal            oyun sonu; kendi kesimlerin doğru (`kontrol-reveal-wrong`: yanlış;
 *                                   `kontrol-reveal-clear`: herkes her dalgada doğru) ve bomba uzmanı yorumu
 *   ?mock=kontrol-spectator-play | -reveal   katılımcı değilsin (izleyici/TV görünümü)
 */
import type {
  GameInfo,
  KontrolState,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  WireColor,
} from "@glix/engine";
import {
  createRng,
  kontrolPaneliKaosu as game,
  isRejected,
  KONTROL_TIMELINE,
  waveColors,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: game.id,
  name: game.name,
  minPlayers: game.minPlayers,
  maxPlayers: game.maxPlayers,
  orientation: "portrait",
};
const COMMENT = "Mert üç dalgada üç kez maviyi kesti; mavi onun için bir yaşam tarzı.";

type Cut = { at: number; who: string; color: WireColor };

/** Bir dalganın başlangıcı (kesimsiz zaman çizelgesinde, oyun başından itibaren). */
const waveStart = (w: number): number =>
  KONTROL_TIMELINE.waveMs.slice(0, w).reduce((a, b) => a + b, 0) + KONTROL_TIMELINE.breakMs * w;

export function startKontrolMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const spectator = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const reveal = kind.includes("reveal");
  const wantWave = Math.min(3, Math.max(1, Number(params.get("wave")) || 1)) - 1;
  const wave = kind === "kontrol-break" ? Math.min(1, wantWave) : wantWave;
  const wrong = kind.includes("wrong");
  const clear = kind.includes("clear");
  const wantClue = params.get("clue");
  const wantKind = params.get("kind");
  const viewer = participants.includes(SELF) ? SELF : (participants[0] as string);

  // İstenen ipucu biçimini veren bir tohum ara (yoksa ilk tohum).
  const seedOk = (s: KontrolState): boolean => {
    const clue = s.waves[wave]?.clues[viewer];
    if (!clue) return true;
    if (wantClue === "3" && clue.conditions.length !== 3) return false;
    if (wantKind === "position") return clue.cut.kind === "position";
    if (wantKind === "mixed") return clue.conditions.some((c) => c.kind !== "at");
    if (wantKind) return clue.conditions.some((c) => c.kind === wantKind);
    return true;
  };
  let seed = 1;
  for (let s = 1; s < 800; s++) {
    if (seedOk(game.setup(participants, { now: 0, rng: createRng(s), connected: participants }))) {
      seed = s;
      break;
    }
  }

  /** Kesimler (oyun başından göreli ms). Kopuk sayılır (`connected: []`): erken bitiş görüntüyü kaydırmasın. */
  const plan: Cut[] = [];
  const answer = (s: KontrolState, w: number, id: string): WireColor => s.waves[w]?.answers[id] as WireColor;
  const other = (s: KontrolState, w: number, id: string): WireColor =>
    waveColors(w).find((c) => c !== answer(s, w, id)) as WireColor;

  const build = (t0: number, extra: Cut[] = []): KontrolState => {
    let s = game.setup(participants, { now: t0, rng: createRng(seed), connected: participants });
    const all = [...plan, ...extra].sort((a, b) => a.at - b.at);
    for (const c of all) {
      const r = game.reduce(
        s,
        c.who,
        { kind: "cut", color: c.color },
        { now: t0 + c.at, rng: createRng(1), connected: [] },
      );
      if (!isRejected(r)) s = r;
    }
    return s;
  };

  // Senaryonun kesimleri.
  const base = build(0);
  const fill = (w: number, upTo: number) => {
    // Önceki kesimler (saat atlaması, erken bitiş) dalgayı kaydırmış olabilir: gerçek başlangıca göre kes.
    const start = build(0).waves[w]?.startedAt ?? waveStart(w);
    participants.forEach((id, i) => {
      if (i >= upTo) return;
      const self = id === SELF;
      const ok = clear || (self ? !wrong : i % 2 === 1);
      if (!clear && !self && i % 4 === 3) return;
      plan.push({
        at: start + 3_000 + i * 200,
        who: id,
        color: ok ? answer(base, w, id) : other(base, w, id),
      });
    });
  };
  if (reveal) for (const w of [0, 1, 2]) fill(w, n);
  else if (kind === "kontrol-break") for (let w = 0; w <= wave; w++) fill(w, n);
  else {
    for (let w = 0; w < wave; w++) fill(w, n);
    const waveAt = build(0).waves[wave]?.startedAt ?? waveStart(wave);
    const others = participants.filter((id) => id !== SELF).slice(0, Math.max(1, Math.floor(n / 2) - 1));
    others.forEach((id, i) => {
      plan.push({ at: waveAt + 2_000 + i * 300, who: id, color: answer(base, wave, id) });
    });
    if (kind === "kontrol-cut" && participants.includes(SELF))
      plan.push({
        at: waveAt + 4_000,
        who: SELF,
        color: (base.waves[wave]?.panels[SELF] ?? [])[1] as WireColor,
      });
  }

  // Ekranın zamanı: kesimlerle kayan çizelgeye göre (önce göreli kur, sonra şimdiye oturt).
  const rel = build(0);
  const relWave = rel.waves[wave];
  const target = (() => {
    if (reveal) return (rel.waves[2]?.endsAt ?? 0) + 400;
    if (kind === "kontrol-break") return (relWave?.endsAt ?? 0) + 300;
    if (kind === "kontrol-jump") return (relWave?.endsAt ?? 0) - 9_000;
    return (relWave?.startedAt ?? 0) + 7_000;
  })();
  const t0 = Date.now() - target;
  const extra: Cut[] = [];
  let state = build(t0);

  let rev = 1;
  const snapshot = (): RoomSnapshot => {
    const now = Date.now();
    let phase: RoomPhase = "playing";
    let readyIds: string[] = [];
    let phaseEndsAt: number | null = null;
    if (kind === "kontrol-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const ctx = { now, rng: createRng(1), connected: participants };
    const s = game.tick(state, ctx);
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: game.briefing.goal, steps: [...game.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: t0,
      phaseEndsAt,
      publicView: game.publicView(s, ctx),
      view: game.view(s, spectator ? null : SELF, ctx),
      result: null,
      ...(reveal ? { comment: COMMENT } : {}),
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
    if (msg.type !== "action") return;
    const p = msg.payload as { kind?: string; color?: WireColor } | null;
    if (p?.kind !== "cut" || !p.color) return;
    extra.push({ at: Date.now() - t0, who: SELF, color: p.color });
    state = build(t0, extra);
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
  // Saat atlaması önizlemesi: biri az sonra yanlış keser (flaş, "−5", bzzzt).
  if (kind === "kontrol-jump") {
    const who = participants.find((id) => id !== SELF && !state.waves[wave]?.cuts[id]);
    if (who)
      setTimeout(() => {
        extra.push({ at: Date.now() - t0, who, color: other(state, wave, who) });
        state = build(t0, extra);
        applySnapshot(snapshot());
      }, 900);
  }
  // Dalga sürerken saat geçişleri (dalga sonu → ara) önizlemede de görünsün; ara ve sonuç ekranı sabit kalır.
  if (kind.startsWith("kontrol-play") || kind === "kontrol-cut" || kind === "kontrol-jump")
    setInterval(() => applySnapshot(snapshot()), 1_000);
}
