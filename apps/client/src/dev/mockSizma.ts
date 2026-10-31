/**
 * Yalnız geliştirme önizlemesi: Sızma ekranları (`&n=3..8` oyuncu sayısı). Durum gerçek motorla kurulur.
 *   ?mock=sizma-briefing          anlatım
 *   ?mock=sizma-clue              ipucu turları (`&turn=K` kaçıncı konuşma; varsayılan 2)
 *   ?mock=sizma-clue-myturn       sıra sende ("SÖYLEDİM", kenar ışığı)
 *   ?mock=sizma-clue-locked       sen "Oylamaya geç" dedin
 *   ?mock=sizma-clue-done         iki tur bitti, oylamaya geri sayım
 *   ?mock=sizma-vote              gizli oylama (`&chosen=K` seçili başlar)
 *   ?mock=sizma-vote-locked       oylama: sen "Oyumu ver" dedin
 *   ?mock=sizma-runoff            eşitlik: ikinci oylama (`&chosen=1` seçili)
 *   ?mock=sizma-notice            "Sızma sen miydin?"; `-answered` cevabını verdin (`&yes=0` Hayır)
 *   ?mock=sizma-unmask            yakalanma açılışı (`&t=ms` açılış başından; oylar uçar, maske kırılır)
 *   ?mock=sizma-guess             son şans (`&me=odd` sızma sensin: yazı alanı)
 *   ?mock=sizma-reveal            yakalandı, son açılış (`&stole=1` kelimeyi çaldı, `&t=ms`)
 *   ?mock=sizma-reveal-escaped    kurtuldu (`&tie=1` ikinci oylamada da eşitlik, `&t=ms`)
 *   ortak: `&me=odd` sızma sensin, `&noticed=1` sızma Evet dedi, `&quip=1` spiker yorumu, `&off=K` K. oyuncu kopuk
 *   ?mock=sizma-spectator-<aşama>  katılımcı değilsin
 *   TV: `?mock=tv-sizma-<aşama>` (aynı adlar, `tv-` önekiyle).
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import { createRng, isRejected, type SizmaState, sizma, speakerAt } from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: sizma.id,
  name: sizma.name,
  minPlayers: sizma.minPlayers,
  maxPlayers: sizma.maxPlayers,
  orientation: "portrait",
};
const QUIP = "Elif ile Zeynep birbirini suçlarken Mert kahvesini yudumlayıp sessizce kaçtı.";

type Stage = "clue" | "vote" | "runoff" | "notice" | "unmask" | "guess" | "reveal";

function stageOf(kind: string): Stage {
  for (const s of ["runoff", "notice", "unmask", "guess", "reveal", "vote"] as const) {
    if (kind.includes(s)) return s;
  }
  return "clue";
}

export function startSizmaMock(mock: string, params: URLSearchParams): void {
  const kind = mock;
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const offIndex = params.has("off") ? Number(params.get("off")) : -1;
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: i !== offIndex,
    score: 0,
    spectator: false,
  }));
  const spectator = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(kind.includes("spectator") && id === SELF));
  const connected = participants.filter((id) => players.find((p) => p.id === id)?.connected);
  const stage = stageOf(kind);
  const meOdd = params.get("me") === "odd" && !spectator;
  const infiltrator = meOdd ? SELF : participants.includes("p2") ? "p2" : (participants[1] as string);
  const escaped = kind.includes("escaped");
  const tie = params.get("tie") === "1";
  const noticed = params.get("noticed") === "1";
  const t = params.has("t") ? Number(params.get("t")) : null;
  const ctxAt = (now: number) => ({ now, rng: createRng(1), connected });

  const run = (s: SizmaState, who: string, action: unknown, at: number): SizmaState => {
    const a = sizma.parseAction(action);
    if (!a) return s;
    const r = sizma.reduce(s, who, a, ctxAt(at));
    return isRejected(r) ? s : r;
  };

  /** Durumu `base` başlangıcıyla kurar; dönen `point` önizlemenin "şimdi"si (mutlak). */
  const build = (base: number): { st: SizmaState; point: number } => {
    let st: SizmaState = {
      ...sizma.setup(participants, ctxAt(base)),
      infiltrator,
      commonWord: "ÇAY",
      infiltratorWord: "KAHVE",
      // Söyleme sırası: p1, p2, …, p0 (sen sonda).
      order: [...participants.slice(1), ...participants.slice(0, 1)],
    };
    const total = st.order.length * 2;
    if (stage === "clue") {
      const want = kind.includes("myturn")
        ? st.order.indexOf(SELF)
        : kind.includes("done")
          ? total
          : Math.min(total, Number(params.get("turn") ?? 2));
      let at = base + 1_000;
      for (let turn = 0; turn < want; turn++, at += 1_000) {
        st = run(st, speakerAt(st.order, turn) ?? "", { kind: "said", turn }, at);
      }
      if (kind.includes("locked")) {
        for (const id of [SELF, ...participants.slice(1, Math.floor(n / 2))])
          st = run(st, id, { kind: "skip" }, at);
      }
      return { st, point: kind.includes("done") ? at + 600 : at + 5_000 };
    }
    // Herkes "Oylamaya geç": oylama base + 2 sn'de başlar.
    for (const id of participants) st = run(st, id, { kind: "skip" }, base + 1_000);
    const voteAt = base + 3_000;
    const others = participants.filter((id) => id !== SELF);
    if (stage === "vote") {
      for (const id of others.slice(0, Math.floor(others.length / 2))) {
        st = run(st, id, { kind: "vote", target: infiltrator }, voteAt);
      }
      const chosen = params.get("chosen");
      if (chosen !== null || kind.includes("locked")) {
        st = run(st, SELF, { kind: "vote", target: `p${Number(chosen ?? 1)}` }, voteAt);
      }
      if (kind.includes("locked")) {
        st = run(st, SELF, { kind: "lock" }, voteAt + 100);
        for (const id of others.slice(0, Math.floor(others.length / 2) - 1))
          st = run(st, id, { kind: "lock" }, voteAt + 100);
      }
      return { st, point: voteAt + 6_000 };
    }
    // Oylar: yakalanma (çoğu sızmaya), kurtulma (çoğu p1'e) ya da eşitlik (p1 ile p3).
    const [ta, tb] = ["p1", participants.includes("p3") ? "p3" : "p0"] as const;
    const tieVotes = (s0: SizmaState, at: number): SizmaState => {
      let s = s0;
      const voters = participants.slice(0, participants.length - (participants.length % 2));
      voters.forEach((id, i) => {
        s = run(s, id, { kind: "vote", target: i % 2 === 0 ? ta : tb }, at);
      });
      return s;
    };
    if (stage === "runoff" || tie) {
      st = tieVotes(st, voteAt);
    } else {
      participants.forEach((id, i) => {
        // Kurtulma: herkes p1'e (p1 sızmaya); yakalanma: herkes sızmaya (sızma p1'e, biri p3'e).
        const target = escaped
          ? id === ta
            ? infiltrator
            : ta
          : id === infiltrator
            ? ta
            : i === 1 && n > 4
              ? tb
              : infiltrator;
        st = run(st, id, { kind: "vote", target }, voteAt);
      });
    }
    for (const id of participants) st = run(st, id, { kind: "lock" }, voteAt + 200);
    const runoffAt = voteAt + 1_300;
    if (stage === "runoff") {
      if (params.get("chosen") !== null) st = run(st, SELF, { kind: "vote", target: ta }, runoffAt);
      for (const id of others.slice(0, 2)) st = run(st, id, { kind: "vote", target: tb }, runoffAt);
      for (const id of others.slice(0, 1)) st = run(st, id, { kind: "lock" }, runoffAt + 50);
      return { st, point: runoffAt + 4_000 };
    }
    let noticeAt = runoffAt;
    if (tie) {
      st = tieVotes(st, runoffAt);
      for (const id of participants) st = run(st, id, { kind: "lock" }, runoffAt + 200);
      noticeAt = runoffAt + 1_300;
    }
    if (stage === "notice") {
      for (const id of others.slice(0, Math.floor(n / 2)))
        st = run(st, id, { kind: "notice", yes: false }, noticeAt);
      if (kind.includes("answered"))
        st = run(st, SELF, { kind: "notice", yes: params.get("yes") !== "0" }, noticeAt);
      return { st, point: noticeAt + 2_500 };
    }
    for (const id of participants) {
      st = run(st, id, { kind: "notice", yes: id === infiltrator ? noticed : id === "p3" }, noticeAt);
    }
    const opened = noticeAt + 1_000;
    if (stage === "unmask") return { st, point: opened + (t ?? 3_200) };
    const s2 = sizma.tick(st, ctxAt(opened + 100));
    if (s2.stage === "reveal") return { st: s2, point: opened + (t ?? 8_000) };
    const guessAt = s2.guessOpensAt ?? opened;
    if (stage === "guess") return { st: s2, point: guessAt + (t ?? 4_000) };
    const g = run(
      s2,
      infiltrator,
      { kind: "guess", text: params.get("stole") === "1" ? "çay" : "çaydanlık" },
      guessAt + 3_000,
    );
    return { st: g, point: (g.guessEndsAt ?? guessAt) + (t ?? 3_500) };
  };

  const probe = build(0);
  const base = Date.now() - probe.point;
  let state = build(base).st;
  /** Önizlenen aşama ekranda kalsın: zaman aşamanın bitişinden biraz önce durur. */
  const hold = (): number => {
    const s = sizma.tick(state, ctxAt(Date.now()));
    if (s.stage === "reveal") return Number.POSITIVE_INFINITY;
    const end = sizma.publicView(s, ctxAt(Date.now())).phaseEndsAt;
    if (s.stage === "clue" && !s.clueClosing) return Math.min(end, s.turnEndsAt) - 300;
    return end - 300;
  };
  const frozenAt = Math.min(Date.now(), hold());
  const nowFor = (): number => Math.min(Date.now(), Math.max(frozenAt, hold()));

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let rev = 1;
  const snapshot = (): RoomSnapshot => {
    if (kind === "sizma-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = Date.now() + 40_000;
    }
    const now = nowFor();
    const st = sizma.tick(state, ctxAt(now));
    const pub = sizma.publicView(st, ctxAt(now));
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: sizma.briefing.goal, steps: [...sizma.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: st.startedAt,
      phaseEndsAt,
      publicView: pub,
      view: sizma.view(st, spectator ? null : SELF, ctxAt(now)),
      result: null,
      ...(params.get("quip") === "1" && pub.reveal?.final ? { comment: QUIP } : {}),
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
    const action = sizma.parseAction(msg.payload);
    if (!action) {
      mockAck(msg.seq, { ok: false, reason: "invalid_action" });
      return;
    }
    const r = sizma.reduce(state, SELF, action, ctxAt(nowFor()));
    if (isRejected(r)) {
      mockAck(msg.seq, { ok: false, reason: r.rejected });
      return;
    }
    state = r;
    mockAck(msg.seq, { ok: true });
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
  // Aşama içi zaman geçişleri (konuşma sırası, açılış) ekrana yansısın.
  setInterval(() => applySnapshot(snapshot()), 500);
}
