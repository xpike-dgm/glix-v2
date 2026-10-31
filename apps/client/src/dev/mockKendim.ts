/**
 * Yalnız geliştirme önizlemesi: Kendim ekranları (`&n=3..8` oyuncu sayısı). Görünümler gerçek oyun kurallarıyla
 * (engine `kendim`) üretilir; böylece önizleme ile oyun aynı veriyi gösterir.
 *   ?mock=kendim-briefing        anlatım
 *   ?mock=kendim-write           yazma (aynaya yaz); `&topic=1` başka konu ("Hayvan olsaydın?")
 *   ?mock=kendim-write-locked    Tamam denildi (kelime aynaya kazındı)
 *   ?mock=kendim-match           eşleştirme; `&paired=2` kaç kartın eşi başlangıçta var
 *   ?mock=kendim-match-locked    eşleştirme kilitli (kartlar soluk, kilit)
 *   ?mock=kendim-reveal          açılış; `&t=ms` açılışın başından geçen süre (yoksa özet), `&twin=1` ikiz kelime,
 *                                `kendim-reveal-negative`: senin bütün eşlemelerin yanlış (tanıma puanı 0)
 *   ?mock=kendim-spectator-write | -match | -reveal   katılımcı değilsin
 *   TV: ?mock=tv-kendim-write | tv-kendim-match | tv-kendim-reveal&t=4000
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  createRng,
  isRejected,
  KENDIM_TOPIC_POOL,
  KENDIM_WRITE_MS,
  type KendimState,
  kendim,
  kendimCards,
  kendimMatchMs,
  kendimRevealMs,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const WORDS = ["ÇAY", "GÜNEŞ", "KARAKTERLİ", "SAKİN", "FIRTINA", "KEDİ", "ÇİKOLATA", "TATLI-SERT"];
const SELF = "p0";
const INFO: GameInfo = {
  id: kendim.id,
  name: kendim.name,
  minPlayers: kendim.minPlayers,
  maxPlayers: kendim.maxPlayers,
  orientation: "portrait",
};

export function startKendimMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
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
  const stage = kind.includes("reveal") ? "reveal" : kind.includes("match") ? "match" : "write";
  const now = Date.now();
  const matchMs = kendimMatchMs(participants.length);
  const tRaw = params.get("t");
  const revealT = tRaw !== null && Number.isFinite(Number(tRaw)) ? Number(tRaw) : kendimRevealMs(n) - 1_500;
  const offset = {
    write: 9_000,
    match: KENDIM_WRITE_MS + 9_000,
    reveal: KENDIM_WRITE_MS + matchMs + revealT,
  };
  const startedAt = now - offset[stage];
  const content =
    params.get("topic") === "1"
      ? { [KENDIM_TOPIC_POOL.id]: [{ topic: "Hayvan olsaydın?", hint: "Ben bir…" }] }
      : undefined;
  const ctx = (at: number) => ({
    now: at,
    rng: createRng(7),
    connected: participants,
    ...(content ? { content } : {}),
  });
  let state: KendimState = kendim.setup(participants, ctx(startedAt));
  const apply = (who: string, action: unknown, at: number): boolean => {
    const parsed = kendim.parseAction(action);
    if (parsed === null) return false;
    const r = kendim.reduce(state, who, parsed, ctx(at));
    if (isRejected(r)) return false;
    state = r;
    return true;
  };

  const twin = params.get("twin") === "1";
  const wordOf = (id: string): string => {
    const i = Number(id.slice(1));
    if (twin && i === 2) return WORDS[1] as string;
    return WORDS[i % WORDS.length] as string;
  };
  const writeAt = startedAt + 1_000;
  const typed = kind.includes("write-locked") ? "MERAKLI" : null;
  for (const id of participants) {
    if (stage === "write" && id === SELF && typed === null) continue;
    // Yazmada diğerlerinin kelimesi önizlemede de görünmez (görünüm gizler); yine de kart sahibi olsunlar.
    apply(id, { kind: "write", text: id === SELF && typed ? typed : wordOf(id) }, writeAt);
  }
  if (stage === "write" && (kind.includes("locked") || spectator)) {
    const others = participants.filter((id) => id !== SELF).slice(0, Math.max(1, Math.floor(n / 2) - 1));
    for (const id of spectator ? others : [SELF, ...others]) apply(id, { kind: "lock" }, writeAt + 10);
  }

  const matchAt = state.writeEndsAt + 1_000;
  const cards = () => kendimCards(state);
  const cardOf = (owner: string) => cards().find((c) => c.owner === owner)?.id ?? -1;
  if (stage === "match" && !spectator) {
    const paired = Number(params.get("paired") ?? (kind.includes("locked") ? 2 : 0));
    const mine = cards().filter((c) => c.owner !== SELF);
    mine.slice(0, paired).forEach((c, i) => {
      const wrong = participants.find((id) => id !== SELF && id !== c.owner) ?? c.owner;
      apply(SELF, { kind: "match", card: c.id, target: i === 1 ? wrong : c.owner }, matchAt);
    });
  }
  if (stage === "match" && (kind.includes("locked") || spectator)) {
    const others = participants.filter((id) => id !== SELF).slice(0, Math.max(1, Math.floor(n / 2) - 1));
    for (const id of spectator ? others : [SELF, ...others]) apply(id, { kind: "lock" }, matchAt + 10);
  }
  if (stage === "reveal") {
    const negative = kind.includes("negative");
    participants.forEach((id, i) => {
      if (id === SELF) {
        cards()
          .filter((c) => c.owner !== SELF)
          .forEach((c, k) => {
            const ok = !negative && k % 2 === 0;
            const wrong = participants.find((x) => x !== SELF && x !== c.owner) ?? c.owner;
            apply(SELF, { kind: "match", card: c.id, target: ok ? c.owner : wrong }, matchAt);
          });
        return;
      }
      // Diğerleri: biri doğru, biri yanlış tahmin eder; bazı kartları yalnız bir kişi bulur (bonus).
      const right = participants[(i + 1) % participants.length] as string;
      const wrongOwner = participants[(i + 2) % participants.length] as string;
      if (i % 2 === 0) apply(id, { kind: "match", card: cardOf(right), target: right }, matchAt);
      const other = participants[(i + 3) % participants.length] as string;
      if (wrongOwner !== id && other !== id && other !== wrongOwner)
        apply(id, { kind: "match", card: cardOf(wrongOwner), target: other }, matchAt);
      if (i % 3 === 1) apply(id, { kind: "match", card: cardOf(SELF), target: SELF }, matchAt);
    });
  }

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let rev = 1;

  const snapshot = (): RoomSnapshot => {
    if (kind === "kendim-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = now + 40_000;
    }
    const at = Math.max(Date.now(), now);
    state = kendim.tick(state, ctx(at));
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: kendim.briefing.goal, steps: [...kendim.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: startedAt,
      phaseEndsAt,
      publicView: kendim.publicView(state, ctx(at)),
      view: kendim.view(state, spectator ? null : SELF, ctx(at)),
      result: null,
    };
    return {
      rev: ++rev,
      serverNow: Date.now(),
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
    // Önizlemede süre akmaz: eylem aşamanın içindeki sabit bir anda uygulanır.
    const at = stage === "write" ? writeAt + 20 : matchAt + 20;
    if (!apply(SELF, msg.payload, at)) return;
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
