/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; App.tsx `import.meta.env.DEV` ile korur).
 * Çapraz Ateş ekranlarını sahte verilerle açar (`&n=8` oyuncu sayısı):
 *   ?mock=capraz-briefing          anlatım
 *   ?mock=capraz-ates              tur 1 hedef seçme (`&off=1` çevrimdışı oyuncu, `&open=1` açılış sahnesi)
 *   ?mock=capraz-locked            hedef seçilmiş (nişangâh kilitli, lazer)
 *   ?mock=capraz-cover             siper seçilmiş (alt kalkan)
 *   ?mock=capraz-tamam             seçim kesinleşti ("Ateşe hazırsın"), diğerleri bekleniyor
 *   ?mock=capraz-duel              son saniyeler: karartma ve "3 · 2 · 1" (`&left=ms` kalan süre)
 *   ?mock=capraz-closed            süre doldu, hedefler açılıyor
 *   ?mock=capraz-interval          tur 1'in kısa açılışı (`&at=ms` açılışın neresi)
 *   ?mock=capraz-round2            tur 2 seçimi: rozetler ve tur 1'in mini halkası (`&cover=1`)
 *   ?mock=capraz-reveal            final açılışı (`&me=hit|free|clash|cover|idle`, `&at=ms`)
 *   ?mock=capraz-spectator         katılımcı değilsin (tur 1 seçimi; büyük halka)
 *   ?mock=capraz-spectator-round2
 *   ?mock=capraz-spectator-reveal
 */
import type { CaprazAtesPublicView, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import {
  CAPRAZ_ATES_FIRE_MS,
  CAPRAZ_ATES_INTERVAL_MS,
  CAPRAZ_ATES_REVEAL_MS,
  caprazAtes,
  caprazAtesReveal,
  caprazAtesTotals,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";

/** Tur 1: p0→p3, p1→p0, p2→p0, p3→p2, p4 siperde, p5↔p6 karşılıklı, p7→p4 (siperdekine). */
const FIRST: Record<string, string> = {
  p0: "p3",
  p1: "p0",
  p2: "p0",
  p3: "p2",
  p5: "p6",
  p6: "p5",
  p7: "p4",
};
const FIRST_COVER = ["p4"];

/** Tur 2: kendi sonucuna göre (`&me=`); diğerleri ortak: p3→p1, p4 siperde, p5→p4, p6→p3. */
const SECOND_COMMON: Record<string, string> = { p3: "p1", p5: "p4", p6: "p3" };
const SECOND: Record<string, { targets: Record<string, string>; cover: string[] }> = {
  hit: { targets: { p0: "p3", p1: "p0", p2: "p0" }, cover: [] },
  free: { targets: { p0: "p1", p1: "p2", p2: "p1" }, cover: [] },
  clash: { targets: { p0: "p1", p1: "p0", p2: "p0" }, cover: [] },
  cover: { targets: { p1: "p0", p2: "p0" }, cover: ["p0"] },
  idle: { targets: { p1: "p2", p2: "p3" }, cover: [] },
};

const only = (map: Record<string, string>, ids: readonly string[]) =>
  Object.fromEntries(Object.entries(map).filter(([from, to]) => ids.includes(from) && ids.includes(to)));

export function startCaprazMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(kind === "capraz-ates" && params.has("off") && i === 2),
    score: 0,
    spectator: false,
  }));
  const ids = players.map((p) => p.id);
  const watching = kind.startsWith("capraz-spectator");
  const participants = watching ? ids.filter((id) => id !== SELF) : ids;
  const now = Date.now();
  const at = Math.max(0, Number(params.get("at")) || 100);

  const first = caprazAtesReveal(participants, only(FIRST, participants), FIRST_COVER);
  const me = params.get("me") ?? "hit";
  const second = SECOND[me] ?? SECOND.hit ?? { targets: {}, cover: [] };
  const secondReveal = caprazAtesReveal(
    participants,
    only({ ...SECOND_COMMON, ...second.targets }, participants),
    [...second.cover, "p4"],
  );

  const isFinal = kind === "capraz-reveal" || kind === "capraz-spectator-reveal";
  const isRound2 = kind === "capraz-round2" || kind === "capraz-spectator-round2";
  const isInterval = kind === "capraz-interval";

  let round: 1 | 2 = 1;
  let roundStartedAt = params.has("open") ? now - 100 : now - 9_000;
  let endsAt = roundStartedAt + CAPRAZ_ATES_FIRE_MS;
  let rounds = [] as CaprazAtesPublicView["rounds"];
  if (kind === "capraz-duel") {
    endsAt = now + (Number(params.get("left")) || 2_600);
    roundStartedAt = endsAt - CAPRAZ_ATES_FIRE_MS;
  } else if (kind === "capraz-closed") {
    endsAt = now - 400;
    roundStartedAt = endsAt - CAPRAZ_ATES_FIRE_MS;
  } else if (isInterval) {
    round = 2;
    roundStartedAt = now - at + CAPRAZ_ATES_INTERVAL_MS;
    endsAt = roundStartedAt + CAPRAZ_ATES_FIRE_MS;
    rounds = [first];
  } else if (isRound2) {
    round = 2;
    roundStartedAt = now - 6_000;
    endsAt = roundStartedAt + CAPRAZ_ATES_FIRE_MS;
    rounds = [first];
  } else if (isFinal) {
    round = 2;
    endsAt = now - at;
    roundStartedAt = endsAt - CAPRAZ_ATES_FIRE_MS;
    rounds = [first, secondReveal];
  }
  const startedAt =
    round === 1 ? roundStartedAt : roundStartedAt - CAPRAZ_ATES_INTERVAL_MS - CAPRAZ_ATES_FIRE_MS;
  // Önizlemede sonuç ekranı kendiliğinden gelmez; final dışında bitiş uzak.
  const finishAt = isFinal ? endsAt + CAPRAZ_ATES_REVEAL_MS : startedAt + 10 * 60_000;

  let myTarget: string | null = kind === "capraz-locked" || kind === "capraz-tamam" ? "p2" : null;
  let myCover = kind === "capraz-cover" || (isRound2 && params.has("cover"));
  if (kind === "capraz-duel") myTarget = "p3";
  let locked = kind === "capraz-tamam";
  let phase: RoomPhase = kind === "capraz-briefing" ? "briefing" : "playing";
  let rev = 1;
  let readyIds: string[] = [];
  const othersReady = (): string[] =>
    participants.filter(
      (id, i) =>
        id !== SELF &&
        i % 2 === 1 &&
        (watching || kind === "capraz-tamam" || kind === "capraz-duel" || isRound2),
    );

  const publicView = (): CaprazAtesPublicView => ({
    startedAt,
    round,
    roundStartedAt,
    endsAt,
    finishAt,
    rounds,
    totals: rounds.length === 2 ? caprazAtesTotals(participants, rounds) : null,
    lockedIds: isFinal || isInterval ? [] : [...(locked && !watching ? [SELF] : []), ...othersReady()],
  });

  const publish = (): void => {
    const info = caprazAtes;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: info.id,
      gameName: info.name,
      briefing: { goal: info.briefing.goal, steps: [...info.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: startedAt,
      phaseEndsAt: phase === "briefing" ? now + 40_000 : null,
      publicView: phase === "briefing" ? null : publicView(),
      view:
        phase === "briefing"
          ? null
          : {
              myTarget: watching || myCover ? null : myTarget,
              cover: !watching && myCover,
              locked: !watching && locked,
            },
      result: null,
    };
    const snapshot: RoomSnapshot = {
      rev: ++rev,
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [info.id],
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [
        {
          id: info.id,
          name: info.name,
          minPlayers: info.minPlayers,
          maxPlayers: info.maxPlayers,
          orientation: "portrait",
        },
      ],
      match,
    };
    applySnapshot(snapshot);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type === "ready") {
      readyIds = ids;
      publish();
    }
    if (msg.type === "action") {
      const payload = msg.payload as { kind?: unknown; target?: unknown };
      if (payload.kind === "lock" && (myTarget !== null || myCover)) {
        locked = true;
        publish();
      }
      if (payload.kind === "cover" && !locked) {
        setTimeout(() => {
          myCover = true;
          myTarget = null;
          publish();
        }, 120);
      }
      if (
        payload.kind === "target" &&
        !locked &&
        typeof payload.target === "string" &&
        ids.includes(payload.target)
      ) {
        const target = payload.target;
        setTimeout(() => {
          myTarget = target;
          myCover = false;
          publish();
        }, 120);
      }
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  phase = kind === "capraz-briefing" ? "briefing" : "playing";
  publish();
}
