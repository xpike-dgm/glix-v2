/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez). Rüşvet ve Darbe ekranları gerçek motorla çalışır
 * (`&n=3..8` oyuncu sayısı, varsayılan 5; sen p0 "Cihad"):
 *   ?mock=rusvet-briefing        anlatım
 *   ?mock=rusvet-vote            başkanlık seçimi; vaatler asılı, iki kişi mühürledi (`&chosen=1` seçimin p1)
 *   ?mock=rusvet-vote-locked     seçim: oyunu mühürledin ve Tamam dedin
 *   ?mock=rusvet-vote-offline    seçim: bir oyuncunun bağlantısı yok ("oyu rastgele gidecek")
 *   ?mock=rusvet-runoff          kalabalık eşitlik: ikinci oylama (n ≥ 4)
 *   ?mock=rusvet-duel            düello, sen adaysın (`&c=2..8` aday, `&open=1` işaretler açık, `&replay=1` önceki el
 *                                sonuçsuz, `&beat=1` son 3 sn ritmi, `&lottery=1` 6. elden sonra kura)
 *   ?mock=rusvet-duel-out        düello, aday değilsin
 *   ?mock=rusvet-duel-locked     düello: işaretini verdin
 *   ?mock=rusvet-crown           "Başkan seçildi" anı (`&me=president` başkan sensin)
 *   ?mock=rusvet-give            sen başkansın, defterin açık (`&budget=2..7`, `&random=1` bir oy zarla düştü)
 *   ?mock=rusvet-give-urgent     sen başkansın, son 5 sn, dağıtmadığın jeton var
 *   ?mock=rusvet-give-locked     sen başkansın, "Bitti" dedin
 *   ?mock=rusvet-give-wait       başkan başkası: tahtın önü, "Senin oyun", vaadi
 *   ?mock=rusvet-give-done       başkan başkası ve "Bitti" dedi
 *   ?mock=rusvet-give-offline    başkanın bağlantısı koptu
 *   ?mock=rusvet-coup            darbe: jeton almadın, karar senin
 *   ?mock=rusvet-coup-locked     darbe: kararını verdin (`&vote=no` Darbe yok)
 *   ?mock=rusvet-coup-wait       darbe: jeton aldın, karar onlarda
 *   ?mock=rusvet-reveal          açılış (`&t=` açılış başından ms, varsayılan 10500; `&coup=hit|miss`,
 *                                `&me=president`, `&pledge=kept|broke`, `&random=1`)
 *   ?mock=rusvet-spectator-<evre>  katılımcı değilsin (ör. rusvet-spectator-vote, rusvet-spectator-coup)
 * TV: `?mock=tv-rusvet-<evre>` aynı durumu sahne görünümünde açar (izleyici kipinde).
 */
import {
  type ClientMessage,
  createRng,
  type GameInfo,
  isRejected,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
  RUSVET_CROWN_MS,
  RUSVET_GIVE_MS,
  RUSVET_RUNOFF_MS,
  RUSVET_SIGN_MS,
  RUSVET_SIGN_REVEAL_MS,
  type RusvetAction,
  type RusvetState,
  rusvetDarbe,
  rusvetVoteMs,
} from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: rusvetDarbe.id,
  name: rusvetDarbe.name,
  minPlayers: rusvetDarbe.minPlayers,
  maxPlayers: rusvetDarbe.maxPlayers,
  orientation: "portrait",
};

export function startRusvetMock(kind: string, params: URLSearchParams): void {
  startRusvetMockAs(kind, params, false);
}

/** `tv`: sahne (TV) görünümü için izleyici kipinde, aynı motor durumu. */
export function startRusvetMockAs(kind: string, params: URLSearchParams, onTv: boolean): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const spectating = onTv || kind.includes("spectator");
  const stage = kind.replace(/^rusvet-/, "").replace(/^spectator-?/, "") || "vote";
  const offlineId = stage === "vote-offline" ? "p3" : stage === "give-offline" ? "p1" : null;
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: `p${i}` !== offlineId,
    score: [3, 5, 2, 4, 1, 6, 0, 2][i] ?? 0,
    spectator: false,
  }));
  const P = players.map((p) => p.id).filter((id) => !(spectating && id === SELF));
  const connectedNow = () => players.filter((p) => p.connected && P.includes(p.id)).map((p) => p.id);
  const ctx = (now: number, connected: readonly string[] = P) => ({ now, rng: createRng(11), connected });
  const me = spectating ? null : SELF;
  const VOTE = rusvetVoteMs(P.length);

  /** Sanal zaman (oyun başından ms) üzerinde durum kurar; sonra gerçek saate kaydırılır. */
  const T0 = 1_000_000;
  let s: RusvetState = rusvetDarbe.setup(P, ctx(T0));
  const act = (who: string | null, a: RusvetAction, at: number, connected: readonly string[] = P): void => {
    if (who === null || !P.includes(who)) return;
    const r = rusvetDarbe.reduce(s, who, a, ctx(T0 + at, connected));
    if (!isRejected(r)) s = r;
  };
  const tick = (at: number): void => {
    s = rusvetDarbe.tick(s, ctx(T0 + at));
  };
  const other = (k: number): string => P.filter((id) => id !== SELF)[k % Math.max(1, P.length - 1)] ?? SELF;

  /** Başkan `pres` tek başına `budget` oy alır (geri kalanlar dağınık). */
  const elect = (pres: string, budget: number, random: boolean): void => {
    const voters = P.filter((id) => id !== pres);
    const b = Math.min(voters.length, Math.max(2, budget));
    // Zarla düşecek oy: tercihen başkana oy vermeyen fazla seçmenden (başkan tek lider kalsın).
    const silent = random ? (voters[b] ?? (b >= 4 ? voters[b - 1] : undefined)) : undefined;
    for (const [i, id] of voters.entries()) {
      if (id === silent) continue;
      // Fazla seçmenler başkan dışındakilere dağılır (en çok 1–2 oy): başkan tek lider kalır.
      const target = i < b ? pres : (voters[(i + 1) % voters.length] as string);
      act(id, { kind: "vote", target: target === id ? pres : target }, 1_000 + i * 300);
    }
    // Başkan, fazla seçmenlerin hiç oy vermediği birine verir: başkan tek lider kalır (zar düşse de).
    act(pres, { kind: "vote", target: voters[1] ?? voters[0] ?? pres }, 1_500);
  };
  const pledges = (): void => {
    act(other(0), { kind: "pledge", pledge: "voters" }, 600);
    act(other(1), { kind: "pledge", pledge: "all" }, 700);
    if (P.length > 4) act(other(3), { kind: "pledge", pledge: "voters" }, 800);
  };

  let vt = 4_000;
  const budget = Number(params.get("budget")) || 3;
  const presIsMe = params.get("me") === "president" && me !== null;
  if (stage === "briefing") {
    vt = 0;
  } else if (stage.startsWith("vote")) {
    pledges();
    act(other(0), { kind: "vote", target: other(1) }, 1_200);
    act(other(0), { kind: "lock" }, 1_300);
    act(other(1), { kind: "vote", target: other(0) }, 1_800);
    act(other(1), { kind: "lock" }, 1_900);
    if (params.get("chosen") === "1" || stage === "vote-locked")
      act(me, { kind: "vote", target: other(0) }, 2_500);
    if (stage === "vote-locked") act(me, { kind: "lock" }, 2_600);
    vt = 6_000;
  } else if (stage === "runoff" || stage.startsWith("duel")) {
    // Halka: herkes bir oy alır -> n'li eşitlik (n ≥ 4 ise ikinci oylama).
    for (const [i, id] of P.entries())
      act(id, { kind: "vote", target: P[(i + 1) % P.length] as string }, 1_000);
    if (stage === "runoff") {
      tick(VOTE);
      act(other(2), { kind: "vote", target: other(0) }, VOTE + 1_000);
      act(other(2), { kind: "lock" }, VOTE + 1_100);
      vt = VOTE + 3_000;
    } else {
      let at = VOTE;
      const c = Math.min(P.length, Math.max(2, Number(params.get("c")) || 3));
      if (P.length >= 4) {
        tick(VOTE);
        const out = stage === "duel-out";
        const cands = (out ? P.filter((id) => id !== SELF) : P).slice(0, c);
        if (cands.length < P.length) {
          // İkinci oylamada her adaya birer oy: kalanlar düelloya girer.
          const voters = P.filter((id) => !cands.includes(id) || cands.length > 1);
          cands.forEach((cand, i) => {
            const v = voters.find((x) => x !== cand && !Object.hasOwn(s.runoffVotes, x)) ?? voters[i];
            if (v) act(v, { kind: "vote", target: cand }, VOTE + 500);
          });
        }
        at = VOTE + RUSVET_RUNOFF_MS;
      }
      tick(at);
      const cands = s.candidates;
      if (params.get("replay") === "1" || params.get("lottery") === "1") {
        const hands = params.get("lottery") === "1" ? 6 : 1;
        for (let h = 0; h < hands; h++) {
          for (const id of cands) act(id, { kind: "sign", sign: "tas" }, at + 100);
          if (h < hands - 1 || params.get("lottery") !== "1") {
            at += 100 + RUSVET_SIGN_REVEAL_MS;
            tick(at);
          }
        }
      }
      if (params.get("open") === "1") {
        const signs = ["tas", "makas", "makas", "tas", "makas", "makas", "tas", "makas"] as const;
        for (const [i, id] of cands.entries()) act(id, { kind: "sign", sign: signs[i] ?? "tas" }, at + 200);
        vt = at + 250;
      } else if (params.get("lottery") === "1") {
        vt = at + 300;
      } else {
        for (const id of cands.filter((x) => x !== SELF).slice(0, 1))
          act(id, { kind: "sign", sign: "kagit" }, at + 1_000);
        if (stage === "duel-locked") act(me, { kind: "sign", sign: "makas" }, at + 1_500);
        vt = params.get("beat") === "1" ? at + RUSVET_SIGN_MS - 1_500 : at + 3_000;
      }
    }
  } else {
    const pres =
      presIsMe || stage === "give" || stage.startsWith("give-u") || stage.startsWith("give-l") ? SELF : "p1";
    const president = P.includes(pres) ? pres : (P[0] as string);
    act(president, { kind: "pledge", pledge: params.get("pledge") === "broke" ? "voters" : "all" }, 500);
    elect(president, budget, params.get("random") === "1");
    tick(VOTE);
    const crownEnd = VOTE + RUSVET_CROWN_MS;
    const others = P.filter((id) => id !== president);
    if (stage === "crown") {
      vt = VOTE + 600;
    } else if (stage.startsWith("give")) {
      if (stage !== "give") {
        act(
          president,
          { kind: "give", tokens: [{ to: others[1] ?? others[0] ?? "", n: 1 }] },
          crownEnd + 2_000,
        );
      }
      if (stage === "give-locked" || stage === "give-done")
        act(president, { kind: "lock" }, crownEnd + 3_000);
      if (stage === "give-offline")
        s = rusvetDarbe.onPresence?.(s, ctx(T0 + crownEnd + 2_500, connectedNow())) ?? s;
      vt =
        stage === "give-urgent"
          ? crownEnd + RUSVET_GIVE_MS - 3_500
          : stage === "give-locked" || stage === "give-done"
            ? crownEnd + 3_400
            : crownEnd + 4_000;
    } else {
      // Darbe ve açılış: SELF jeton almaz (coup-wait'te alır).
      const selfGets = stage === "coup-wait";
      const plan: { to: string; n: number }[] = [];
      let left = s.budget;
      const receivers =
        params.get("pledge") === "kept"
          ? others
          : others
              .filter((id) => (selfGets ? true : id !== SELF))
              .slice(0, Math.max(1, Math.ceil(others.length / 2)));
      for (const to of receivers) {
        if (left <= 0) break;
        const k = Math.min(left, params.get("pledge") === "kept" ? 1 : 2);
        plan.push({ to, n: k });
        left -= k;
      }
      act(president, { kind: "give", tokens: plan }, crownEnd + 2_000);
      act(president, { kind: "lock" }, crownEnd + 2_000);
      const coupAt = crownEnd + 3_000;
      tick(coupAt);
      const hit = params.get("coup") === "hit";
      if (stage === "coup-locked") act(me, { kind: "coup", yes: params.get("vote") !== "no" }, coupAt + 800);
      if (stage.startsWith("coup")) {
        // Biri oy verir (son hak sahibi değilse: aşama bitip açılışa geçmesin).
        const open = s.coupEligible.filter((id) => !Object.hasOwn(s.coupVotes, id));
        const voter = open.find((id) => id !== SELF);
        if (voter && open.length > 1) act(voter, { kind: "coup", yes: true }, coupAt + 1_200);
        vt = coupAt + 2_500;
      } else {
        for (const id of s.coupEligible) act(id, { kind: "coup", yes: hit }, coupAt + 1_000);
        tick(coupAt + 2_000);
        tick(coupAt + 10_000);
        const start = s.finishAt === null ? coupAt + 2_000 : s.finishAt - 11_000 - T0;
        vt = start + (Number(params.get("t")) || 10_500);
      }
    }
  }

  // Sanal zamanı gerçek saate kaydır: şu an = sanal vt.
  const shift = Date.now() - (T0 + vt);
  const real = (x: number) => x + shift;
  const briefing = stage === "briefing";
  let rev = 1;
  function publish(): void {
    const now = Date.now();
    const cx = ctx(now - shift, connectedNow());
    const ended = rusvetDarbe.isFinished(s, cx);
    const pub = briefing ? null : shiftTimes(rusvetDarbe.publicView(s, cx), shift);
    const revealAt = rusvetDarbe.revealAt?.(s, cx) ?? null;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: rusvetDarbe.briefing.goal, steps: [...rusvetDarbe.briefing.steps] },
      orientation: "portrait",
      participants: P,
      readyIds: briefing ? ["p1", "p2"] : [],
      continueIds: [],
      phaseStartedAt: real(s.startedAt),
      phaseEndsAt: briefing ? now + 40_000 : null,
      publicView: pub,
      view: briefing ? null : rusvetDarbe.view(s, me, cx),
      result: ended ? rusvetDarbe.result(s) : null,
      ...(revealAt !== null
        ? { reveal: { startedAt: real(revealAt), endsAt: real(revealAt) + 60_000, continueIds: ["p1"] } }
        : {}),
    };
    const phase: RoomPhase = briefing ? "briefing" : "playing";
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
    const action = rusvetDarbe.parseAction(msg.payload);
    if (!action || me === null) {
      mockAck(msg.seq, { ok: false, reason: "bad_action" });
      return;
    }
    const r = rusvetDarbe.reduce(s, me, action, ctx(Date.now() - shift, connectedNow()));
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
  setInterval(publish, 250);
}

/** Görünümdeki mutlak zamanları gerçek saate kaydırır (sanal saatle kurulan durum). */
function shiftTimes<T>(v: T, shift: number): T {
  const keys = new Set([
    "startedAt",
    "phaseStartedAt",
    "phaseEndsAt",
    "endsAt",
    "signStartedAt",
    "signEndsAt",
    "revealEndsAt",
  ]);
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (typeof x !== "object" || x === null) return x;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(x))
      out[k] = keys.has(k) && typeof val === "number" ? val + shift : walk(val);
    return out;
  };
  return walk(v) as T;
}
