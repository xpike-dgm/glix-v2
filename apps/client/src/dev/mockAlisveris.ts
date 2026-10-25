/**
 * Yalnız geliştirme önizlemesi: Gizli Alışveriş ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=alisveris-briefing   anlatım
 *   ?mock=alisveris-shop       alışveriş; ürünlere dokununca sepet güncellenir (`&empty=1` boş sepetle başlar)
 *   ?mock=alisveris-locked     sen "Tamam" dedin (sepet dolu), diğerleri bekleniyor
 *   ?mock=alisveris-low        bütçe neredeyse bitmiş
 *   ?mock=alisveris-reveal     sonuç: kepenk, alıcı sayıları, sepet sıralaması
 *   ?mock=alisveris-reveal-tie sonuç: en değerli sepetler eşit
 *   ?mock=alisveris-spectator  katılımcı değilsin
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import { ALISVERIS_SHOP_MS, type AlisverisState, createRng, gizliAlisveris } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: gizliAlisveris.id,
  name: gizliAlisveris.name,
  minPlayers: gizliAlisveris.minPlayers,
  maxPlayers: gizliAlisveris.maxPlayers,
  orientation: "portrait",
};
/** Sepetler (ürün numaraları; fiyatlar toplamı ≤ 60). */
const BASKETS: number[][] = [
  [11, 0, 2], // sen
  [7, 5],
  [11, 3],
  [4, 6, 1],
  [9, 10],
  [0, 1, 2, 3],
  [5, 8],
  [],
];
const TIE: number[][] = [[7], [7], [0], [1], [2], [3], [], []];

export function startAlisverisMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
  }));
  const spectator = kind.endsWith("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const revealed = kind.startsWith("alisveris-reveal");
  const startedAt = Date.now() - (revealed ? ALISVERIS_SHOP_MS + 300 : 8_000);
  const source = kind === "alisveris-reveal-tie" ? TIE : BASKETS;
  const shopping = !revealed;
  let rev = 1;
  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;

  const baskets: Record<string, number[]> = {};
  participants.forEach((id, i) => {
    baskets[id] = [...(source[i] ?? [])];
  });
  if (kind === "alisveris-low") baskets[SELF] = [11, 7];
  if (shopping && kind === "alisveris-shop" && params.get("empty") === "1") baskets[SELF] = [];
  // Alışveriş ekranında yalnız kendi sepetin vardır; ötekiler gerekmez.
  if (shopping) for (const id of participants) if (id !== SELF) baskets[id] = [];

  const base = gizliAlisveris.setup(participants, {
    now: startedAt,
    rng: createRng(7),
    connected: participants,
  });
  const ctx = () => ({ now: Date.now(), rng: createRng(1), connected: participants });
  // "Tamam" diyenler (mock): kilitli ekranda sen ve birkaç kişi; izleyici ekranında birkaç kişi.
  let myLocked = kind === "alisveris-locked";
  const lockedIds = (): string[] => {
    if (kind === "alisveris-locked")
      return participants.slice(0, Math.max(1, Math.ceil(participants.length / 2)));
    if (spectator) return participants.slice(1, 3);
    return myLocked ? [SELF] : [];
  };
  const state = (): AlisverisState => ({ ...base, baskets: { ...baskets }, locked: lockedIds() });

  const snapshot = (): RoomSnapshot => {
    if (kind === "alisveris-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = Date.now() + 40_000;
    }
    const st = state();
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: gizliAlisveris.briefing.goal, steps: [...gizliAlisveris.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      phaseStartedAt: startedAt,
      phaseEndsAt,
      publicView: gizliAlisveris.publicView(st, ctx()),
      view: gizliAlisveris.view(st, spectator ? null : SELF, ctx()),
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
      tone: "arkadas",
      catalog: [INFO],
      match,
    };
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const p = msg.payload as { kind?: string; product?: number } | null;
    if (spectator || !p) return;
    if (p.kind === "lock") {
      myLocked = true;
      applySnapshot(snapshot());
      return;
    }
    if (typeof p.product !== "number" || myLocked) return;
    const next = gizliAlisveris.parseAction(p);
    if (!next) return;
    const r = gizliAlisveris.reduce(state(), SELF, next, ctx());
    if ("rejected" in r) return;
    baskets[SELF] = r.baskets[SELF] ?? [];
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
