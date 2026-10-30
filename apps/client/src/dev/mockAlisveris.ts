/**
 * Yalnız geliştirme önizlemesi: Gizli Alışveriş ekranları (`&n=3..8` oyuncu sayısı).
 *   ?mock=alisveris-briefing   anlatım
 *   ?mock=alisveris-shop       alışveriş; ürünlere dokununca sepet güncellenir (`&empty=1` boş sepetle başlar);
 *                              rafta görseli henüz olmayan yeni ürünler yer tutucuyla, kuponun macenta etiketle
 *   ?mock=alisveris-heat       15. saniye geçti: vitrin fısıltısı (talep ateşi) görünür
 *   ?mock=alisveris-tense      son 10 saniye: kırmızı şerit, tik, bekleten avatarlar sallanır
 *   ?mock=alisveris-closing    son 3 saniye: "Kasa kapanıyor!", kepenk biraz iner
 *   ?mock=alisveris-locked     sen "Tamam" dedin (paketlenmiş sepet), diğerleri bekleniyor
 *   ?mock=alisveris-low        bütçe neredeyse bitmiş
 *   ?mock=alisveris-reveal     sonuç: kepenk → ürün ürün çakışma → sepetler sondan başa → puanlar
 *   ?mock=alisveris-reveal-tie sonuç: en değerli sepetler eşit (ikisi +2, sonraki +1)
 *   ?mock=alisveris-spectator  katılımcı değilsin (vitrin; `&heat=1` talep ateşiyle)
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  ALISVERIS_HEAT_AT_MS,
  ALISVERIS_POOL,
  ALISVERIS_SHOP_MS,
  type AlisverisState,
  createRng,
  gizliAlisveris,
} from "@glix/engine";
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
/** Sabit raf (havuz numarası → bu maçın fiyatı): yeni ürünler dahil; en ucuz 5'in toplamı 81. */
const SHELF: [number, number][] = [
  [11, 38],
  [19, 33],
  [10, 27],
  [18, 31],
  [9, 24],
  [17, 22],
  [8, 29],
  [16, 21],
  [7, 20],
  [15, 17],
  [14, 14],
  [12, 9],
];
/** Oyuncu sırasıyla kuponlar (hepsi farklı). Senin kuponun Mini Drone (27 → 14). */
const COUPONS = [10, 19, 7, 12, 8, 15, 16, 9];
/** Sepetler (ürün numaraları; kuponla ödenen toplam ≤ 60). */
const BASKETS: number[][] = [
  [10, 12, 14], // sen: 14 + 9 + 14
  [19, 16],
  [11, 7],
  [12, 15, 17],
  [8, 9],
  [12, 14, 15, 7],
  [18, 16],
  [],
];
const TIE: number[][] = [[11], [11], [12], [14], [15], [], [], []];

export function startAlisverisMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const spectator = kind.endsWith("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const revealed = kind.startsWith("alisveris-reveal");
  const heated = kind === "alisveris-heat" || (spectator && params.get("heat") === "1");
  const elapsedMs: Record<string, number> = {
    "alisveris-heat": ALISVERIS_HEAT_AT_MS + 600,
    "alisveris-tense": ALISVERIS_SHOP_MS - 8_000,
    "alisveris-closing": ALISVERIS_SHOP_MS - 2_600,
  };
  const startedAt =
    Date.now() -
    (revealed ? ALISVERIS_SHOP_MS + 50 : (elapsedMs[kind] ?? (heated ? ALISVERIS_HEAT_AT_MS + 600 : 8_000)));
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

  const setup = gizliAlisveris.setup(participants, {
    now: startedAt,
    rng: createRng(7),
    connected: participants,
  });
  const coupons: Record<string, number> = {};
  players.forEach((p, i) => {
    if (participants.includes(p.id)) coupons[p.id] = COUPONS[i] ?? 0;
  });
  const base: AlisverisState = {
    ...setup,
    shelf: SHELF.map(([id, price]) => ({ id, name: ALISVERIS_POOL[id]?.name ?? "", price })),
    coupons,
  };
  const ctx = () => ({ now: Date.now(), rng: createRng(1), connected: participants });
  // "Tamam" diyenler (mock): kilitli ekranda sen ve birkaç kişi; izleyici ekranında birkaç kişi.
  let myLocked = kind === "alisveris-locked";
  const lockedIds = (): string[] => {
    if (kind === "alisveris-locked")
      return participants.slice(0, Math.max(1, Math.ceil(participants.length / 2)));
    if (spectator) return participants.slice(1, 3);
    if (kind === "alisveris-tense" || kind === "alisveris-closing") return participants.slice(1, 3);
    return myLocked ? [SELF] : [];
  };
  // Vitrin ateşi 15. saniyedeki sepetlerden donar (mock'ta o anki sepetler).
  const state = (): AlisverisState => {
    const st: AlisverisState = { ...base, baskets: { ...baskets }, locked: lockedIds() };
    return gizliAlisveris.tick(st, ctx());
  };

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
      continueIds: [],
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
