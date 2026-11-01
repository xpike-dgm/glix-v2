/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Gizli Hırsız ekranları gerçek motorla çalışır
 * (`&n=2..8` oyuncu sayısı, varsayılan 5):
 *   ?mock=gizli-briefing        anlatım
 *   ?mock=gizli-idle            ÇAL / ÇALMA bekliyor (11. saniye; iki kişi karar vermiş)
 *   ?mock=gizli-pressed         kararın kayıtlı (ÇAL dedin; 👁 basılı tutunca görünür)
 *   ?mock=gizli-stir            15. saniye geçti: "Kasada kıpırtı var!" (GH-M2 / GH-U9)
 *   ?mock=gizli-quiet           15. saniye geçti: "Kasa sessiz"
 *   ?mock=gizli-listen          işaret anı: kasa dinleniyor
 *   ?mock=gizli-urgent          son 5 sn (GH-U7)
 *   ?mock=gizli-offline         bir oyuncu kopuk (gri; GH-U14)
 *   ?mock=gizli-spectator       izleyici (GH-U12)
 *   ?mock=gizli-outro-solo      oyun içi açılış, tek hırsız (GH-U5 / GH-U6; `&t=` açılış başından ms, varsayılan 4400)
 *   ?mock=gizli-outro-multi     oyun içi açılış, çok hırsız
 *   ?mock=gizli-outro-none      oyun içi açılış, kimse çalmadı
 *   ?mock=gizli-reveal-solo     genel sonuç şeridi, tek hırsız (GH-U8)
 *   ?mock=gizli-reveal-multi    genel sonuç şeridi, çok hırsız
 *   ?mock=gizli-reveal-none     genel sonuç şeridi, kimse çalmadı
 * TV: `?mock=tv-gizli-<evre>` aynı durumu sahne görünümünde açar (izleyici kipinde).
 */
import {
  type ClientMessage,
  createRng,
  type GameInfo,
  type GizliHirsizState,
  gizliHirsiz,
  isRejected,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: gizliHirsiz.id,
  name: gizliHirsiz.name,
  minPlayers: gizliHirsiz.minPlayers,
  maxPlayers: gizliHirsiz.maxPlayers,
  orientation: "portrait",
};

export function startGizliHirsizMock(kind: string, params: URLSearchParams): void {
  startGizliHirsizMockAs(kind, params, false);
}

/** `tv`: sahne (TV) görünümü için izleyici kipinde, aynı motor durumu. */
export function startGizliHirsizMockAs(kind: string, params: URLSearchParams, tv: boolean): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const stage = kind.replace(/^gizli-?/, "") || "idle";
  const spectating = tv || stage === "spectator";
  const offlineId = stage === "offline" ? "p2" : null;
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: `p${i}` !== offlineId,
    score: 0,
    spectator: false,
  }));
  const participants = players.map((p) => p.id).filter((id) => !(spectating && id === SELF));
  const connected = () => players.filter((p) => p.connected && participants.includes(p.id)).map((p) => p.id);
  const ctx = (now: number) => ({ now, rng: createRng(7), connected: connected() });
  const briefing = stage === "briefing";
  const results = stage.startsWith("reveal");
  const outro = stage.startsWith("outro");
  const outcome = stage.replace(/^(reveal|outro)-/, "");

  const now0 = Date.now();
  /** Oyunun hangi saniyesinde açıldığı (deciding ekranları) ya da açılışın ne kadar ilerlediği. */
  const at: Record<string, number> = { listen: 15_200, stir: 17_000, quiet: 17_000, urgent: 26_500 };
  const elapsed = Number(params.get("t")) || 4_400;
  const startedAt = outro || results ? now0 - elapsed - 30_000 : now0 - (at[stage] ?? 11_000);
  let s: GizliHirsizState = gizliHirsiz.setup(participants, { ...ctx(startedAt), connected: participants });
  const step = (id: string, k: "steal" | "pass", sec: number): void => {
    if (!participants.includes(id)) return;
    const r = gizliHirsiz.reduce(
      s,
      id,
      { kind: k },
      { ...ctx(startedAt + sec * 1000), connected: participants },
    );
    if (!isRejected(r)) s = r;
  };
  const others = participants.filter((id) => id !== SELF);

  if (outro || results) {
    if (outcome === "solo") step(others[1] ?? others[0] ?? SELF, "steal", 3.2);
    if (outcome === "multi") {
      step(others[0] ?? SELF, "steal", 3.2);
      step(SELF, "steal", 12.4);
      step(others[2] ?? others[1] ?? SELF, "steal", 27.8);
    }
  } else if (stage === "stir") {
    step(others[0] ?? SELF, "steal", 4);
    step(others[1] ?? SELF, "pass", 9);
  } else if (stage === "quiet" || stage === "listen") {
    step(others[1] ?? SELF, "pass", 5);
    if (stage === "listen") step(others[0] ?? SELF, "steal", 6);
  } else if (stage !== "briefing") {
    step(others[0] ?? SELF, "pass", 3);
    step(others[2] ?? SELF, "steal", 7);
    if (stage === "pressed") step(SELF, "steal", 9);
    if (stage === "urgent") for (const id of others.slice(3)) step(id, "pass", 20);
  }

  let rev = 1;
  const phase: RoomPhase = briefing ? "briefing" : results ? "results" : "playing";
  function publish(): void {
    const now = Date.now();
    const cx = ctx(now);
    const ended = now >= s.endsAt;
    const result = ended ? gizliHirsiz.result(s) : null;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: gizliHirsiz.briefing.goal, steps: [...gizliHirsiz.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds: briefing ? ["p1", "p2"] : [],
      continueIds: [],
      phaseStartedAt: s.startedAt,
      phaseEndsAt: briefing ? now + 40_000 : results ? now + 60_000 : null,
      publicView: briefing ? null : gizliHirsiz.publicView(s, cx),
      view: briefing ? null : gizliHirsiz.view(s, spectating ? null : SELF, cx),
      result: results && result ? { miniScores: result.miniScores, awards: result.awards } : null,
      ...(ended && !results
        ? { reveal: { startedAt: s.endsAt, endsAt: s.endsAt + 60_000, continueIds: ["p1"] } }
        : {}),
    };
    const snapshot: RoomSnapshot = {
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
    applySnapshot(snapshot);
  }

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg: ClientMessage) => {
    if (msg.type !== "action") return;
    const action = gizliHirsiz.parseAction(msg.payload);
    if (!action) {
      mockAck(msg.seq, { ok: false, reason: "bad_action" });
      return;
    }
    const r = gizliHirsiz.reduce(s, SELF, action, ctx(Date.now()));
    if (isRejected(r)) {
      mockAck(msg.seq, { ok: false, reason: r.rejected });
      return;
    }
    s = r;
    mockAck(msg.seq, { ok: true });
    publish();
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
  setInterval(publish, 500);
}
