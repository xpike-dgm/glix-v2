/**
 * Yalnız geliştirme önizlemesi: Zehirli Kadeh ekranları (`&n=2..8` oyuncu sayısı).
 *   ?mock=zehirli-briefing    anlatım
 *   ?mock=zehirli-play        haklar duruyor (kadehe dokun: "Kontrol et" / "Takas et" çalışır)
 *   ?mock=zehirli-checked     kontrol hakkını kullandın: kontrol ettiğin kadehte sana özel rozet
 *   ?mock=zehirli-used        takas ve kontrol yapıldı, geçmiş görünüyor (rozet kadehle birlikte yer değiştirdi)
 *   ?mock=zehirli-tense       son 5 saniye: mum titrer, masa kararır
 *   ?mock=zehirli-spectator   katılımcı değilsin (TV ile aynı görünüm; kontrol/zehir bilgisi yok)
 *   ?mock=zehirli-reveal      "Şerefe!" açılış evresi, tam ekran (sen temiz kadehli); `&poison=1` sen zehirli;
 *                             `&t=<ms>` açılışın o anından başlar (ör. `t=900` tokuşturma, `t=20000` son hâl)
 */
import type {
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  ZehirliKadehPublicView,
} from "@glix/engine";
import { LATE_ACTION_GRACE_MS, zehirliKadeh, zehirliKadehPoisonCount } from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: zehirliKadeh.id,
  name: zehirliKadeh.name,
  minPlayers: zehirliKadeh.minPlayers,
  maxPlayers: zehirliKadeh.maxPlayers,
  orientation: "portrait",
};

export function startZehirliMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(2, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const ids = players.map((p) => p.id);
  const spectator = kind === "zehirli-spectator";
  const participants = ids.filter((id) => !(spectator && id === SELF));
  let now = Date.now();
  const briefing = kind === "zehirli-briefing";
  const reveal = kind === "zehirli-reveal";
  const tense = kind === "zehirli-tense";
  const revealAt = Math.max(0, Number(params.get("t")) || 0);
  // "Şerefe!" açılışı oyunun kendi evresidir: faz hâlâ "playing", sonuç görünümü açık.
  const phase: RoomPhase = briefing ? "briefing" : "playing";
  let startedAt = now - 7_000;

  const holdings: Record<string, number> = Object.fromEntries(ids.map((id, i) => [id, i]));
  let swaps: ZehirliKadehPublicView["swaps"] = [];
  let swapped: string[] = [];
  const swap = (from: string, to: string, at: number): void => {
    const a = holdings[from] as number;
    holdings[from] = holdings[to] as number;
    holdings[to] = a;
    swaps = [...swaps, { seq: swaps.length + 1, from, to, at }];
    swapped = [...swapped, from];
  };
  if (kind === "zehirli-used" || kind === "zehirli-spectator" || tense || reveal) {
    swap(SELF === ids[0] && !spectator ? SELF : "p1", "p2", now - 4_000);
    if (n > 3) swap("p3", "p1", now - 2_000);
  }
  const poisonedCups =
    params.get("poison") === "1"
      ? ids.slice(0, zehirliKadehPoisonCount(n)).map((_, i) => i)
      : ids.map((_, i) => i).slice(n - zehirliKadehPoisonCount(n));
  // Kontrol: "checked" ve "used" ekranlarında sen (p0) p1'in başlangıçtaki kadehini (1) kontrol etmişsin.
  let check: { cup: number; poisoned: boolean } | null =
    kind === "zehirli-checked" || kind === "zehirli-used" || tense
      ? { cup: 1, poisoned: poisonedCups.includes(1) }
      : null;

  // Her yayın yeni sürüm: aynı saniyedeki iki yayın da uygulanır (kontrol yanıtı gibi).
  let rev = Math.floor(Date.now() / 1000);
  const publish = (): void => {
    const endsAt = startedAt + 20_000 + swaps.length * 5_000;
    const poisoned = ids.filter((id) => poisonedCups.includes(holdings[id] as number));
    const pub: ZehirliKadehPublicView = {
      startedAt: reveal ? now - 40_000 : startedAt,
      endsAt: reveal ? now - revealAt - LATE_ACTION_GRACE_MS : tense ? now + 4_600 : endsAt + 8_000,
      players: ids,
      holdings,
      swapped,
      swaps,
      poisonCount: poisonedCups.length,
      ended: reveal,
      result: reveal ? { clean: ids.filter((id) => !poisoned.includes(id)), poisoned, poisonedCups } : null,
    };
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: zehirliKadeh.briefing.goal, steps: [...zehirliKadeh.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds: briefing ? ["p1", "p2"] : [],
      continueIds: [],
      phaseStartedAt: reveal ? now - 40_000 : startedAt,
      phaseEndsAt: briefing ? now + 40_000 : null,
      publicView: briefing ? null : pub,
      view: briefing ? null : spectator ? { role: "spectator", check: null } : { role: "player", check },
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
      gameIds: [INFO.id],
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [INFO],
      match,
    };
    applySnapshot(snapshot);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action") return;
    const p = msg.payload as { kind?: string; target?: string } | null;
    if (typeof p?.target !== "string") return;
    if (p.kind === "check" && check === null && p.target !== SELF) {
      const cup = holdings[p.target] as number;
      // Gerçek ağ gecikmesi gibi: kapak biraz titresin.
      setTimeout(() => {
        check = { cup, poisoned: poisonedCups.includes(cup) };
        mockAck(msg.seq, { ok: true });
        publish();
      }, 450);
      return;
    }
    if (p.kind !== "swap" || swapped.includes(SELF)) return;
    swap(SELF, p.target, Date.now());
    mockAck(msg.seq, { ok: true });
    publish();
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
  // Süre ekranı sabit kalsın: önizleme açık kaldığı sürece zaman damgaları tazelenir.
  if (!reveal && !briefing) {
    setInterval(() => {
      now = Date.now();
      startedAt = now - 7_000;
      publish();
    }, 3_000);
  }
}
