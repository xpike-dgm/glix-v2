/**
 * Yalnız geliştirme önizlemesi: Laf Sokma Düellosu ekranları (`&n=3..8` oyuncu sayısı). Görünümler gerçek oyun
 * motorundan üretilir; eylemler de motordan geçer.
 *   ?mock=laf-briefing            anlatım
 *   ?mock=laf-write               iki soruya cevap yazma (`-filled` biri yazılı, `-locked` Tamam dedin)
 *   ?mock=laf-vote                iki isimsiz karttan oy verme (`-author` cevap sahibisin, `-done` oy verdin, `-empty` Cevap yok kartı)
 *   ?mock=laf-reveal              düello açılışı (`-master` Laf Ustası, `-tie` berabere, `-empty` iki taraf da cevapsız, `-none` sen oy almadın)
 *   ?mock=laf-final-write         final sorusu (`-locked` Tamam dedin)
 *   ?mock=laf-final-vote          final oylaması (`-done` oy verdin)
 *   ?mock=laf-final-reveal        final açılışı
 *   ?mock=laf-spectator-write | -vote | -reveal | -final-vote   katılımcı değilsin
 *   `&t=<ms>`: açılışlarda evrenin başından geçen süre (zaman çizelgesinin o anı; varsayılan açılışın sonu).
 *   TV: `?mock=tv-laf-vote`, `tv-laf-reveal-master&t=4800`, `tv-laf-final-reveal` … (aynı adlar, `tv-` önekiyle).
 */
import type { GameInfo, MatchSnapshot, PlayerInfo, RoomPhase, RoomSnapshot } from "@glix/engine";
import { createRng, isRejected, type LafState, lafAdvance, lafCards, lafSokma } from "@glix/engine";
import { mockAck, useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: lafSokma.id,
  name: lafSokma.name,
  minPlayers: lafSokma.minPlayers,
  maxPlayers: lafSokma.maxPlayers,
  orientation: "portrait",
};
const TEXTS = [
  "Kedim bile bana güvenmiyor",
  "Annemin terliği",
  "Bir kova dolusu makarna",
  "Pazartesiyi iptal ederdim",
  "Sesli mesajla özür dilemek",
  "Uyku tulumuyla toplantı",
  "Mutfakta kaybolan çorap",
  "Uzaylılar bile şaşırırdı",
  "Hesabı yarı yarıya böleriz",
  "Alarmı kapatıp tekrar uyumak",
  "Bir ördek gibi yürüdüm",
  "Çorbada saç buldum, şikâyetçiyim",
];

interface Plan {
  stage: "write" | "vote" | "reveal" | "finalWrite" | "finalVote" | "finalReveal";
  elapsed: number;
}

function planOf(kind: string, t: number | null): Plan {
  if (kind.includes("final-reveal")) return { stage: "finalReveal", elapsed: t ?? 11_000 };
  if (kind.includes("final-vote")) return { stage: "finalVote", elapsed: 1_500 };
  if (kind.includes("final-write")) return { stage: "finalWrite", elapsed: 9_000 };
  if (kind.includes("reveal")) return { stage: "reveal", elapsed: t ?? 6_000 };
  if (kind.includes("vote")) return { stage: "vote", elapsed: 1_500 };
  return { stage: "write", elapsed: 8_000 };
}

export function startLafMock(kind: string, params: URLSearchParams): void {
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
  const tRaw = params.get("t");
  const plan = planOf(kind, tRaw === null ? null : Math.max(0, Number(tRaw) || 0));
  const locked = kind.includes("locked");
  const filled = kind.includes("filled");
  const done = kind.includes("done");
  const empty = kind.includes("empty");
  const master = kind.includes("master");
  const tie = kind.includes("tie");
  const none = kind.includes("none");
  const authorRole = kind.includes("author");

  const build = (base: number): LafState => {
    const ctx = (now: number) => ({ now, rng: createRng(7), connected: participants });
    let st = lafSokma.setup(participants, ctx(base));
    const run = (who: string, action: Parameters<typeof lafSokma.reduce>[2], now: number): void => {
      const r = lafSokma.reduce(st, who, action, ctx(now));
      if (!isRejected(r)) st = r;
    };
    const toStep = (step: number): void => {
      while (st.step < step) st = lafAdvance(st, st.stepEndsAt);
    };
    const target = (): number => {
      // Gösterilecek düello: sen cevap sahibisin ya da değilsin.
      const j = st.duels.findIndex(
        (d) => d.authors.includes(SELF) === (authorRole || plan.stage === "reveal"),
      );
      return Math.max(0, j);
    };
    const t0 = base + 1_000;
    const missing = new Map<string, string>();
    const duelIdx = (): number => {
      if (empty && plan.stage === "vote") return 0;
      return target();
    };
    const j = duelIdx();
    // Kimin cevabı olmayacak: "empty" senaryosunda hedef düellodaki ilk yazar (vote) ya da ikisi (reveal).
    const targetDuel = st.duels[j];
    if (empty && targetDuel) {
      missing.set(targetDuel.id, targetDuel.authors[0]);
      if (plan.stage === "reveal") missing.set(`${targetDuel.id}:b`, targetDuel.authors[1]);
    }
    let k = 0;
    for (const who of participants) {
      if (who === SELF && plan.stage === "write" && !filled && !locked) continue;
      for (const d of st.duels.filter((x) => x.authors.includes(who))) {
        if (
          plan.stage === "write" &&
          who === SELF &&
          filled &&
          d.id !== st.duels.find((x) => x.authors.includes(SELF))?.id
        ) {
          continue;
        }
        if (missing.get(d.id) === who || missing.get(`${d.id}:b`) === who) continue;
        run(who, { kind: "answer", prompt: d.id, text: TEXTS[k++ % TEXTS.length] as string }, t0);
      }
    }
    if (plan.stage === "write") {
      const others = participants.filter((id) => id !== SELF);
      for (const who of others.slice(0, Math.floor(others.length / 2))) run(who, { kind: "lock" }, t0 + 10);
      if (locked) run(SELF, { kind: "lock" }, t0 + 20);
      return st;
    }
    if (plan.stage === "vote" || plan.stage === "reveal") {
      toStep(1 + 2 * j);
      const at = st.stepStartedAt + 800;
      const id = st.duels[j]?.id ?? "";
      const cards = lafCards(st, id);
      const voters = participants.filter((p) => !st.duels[j]?.authors.includes(p));
      const first = cards.find((c) => c.text !== null) ?? cards[0];
      const second = cards.find((c) => c.id !== first?.id && c.text !== null) ?? first;
      if (plan.stage === "reveal") {
        voters.forEach((v, i) => {
          const pick =
            master || none ? first : tie ? (i % 2 === 1 ? second : first) : i % 3 === 2 ? second : first;
          const mine = cards.find((c) => c.author === SELF);
          const choose = none && mine && pick?.id === mine.id ? cards.find((c) => c.id !== mine.id) : pick;
          if (choose && choose.text !== null) run(v, { kind: "vote", card: choose.id }, at + i * 50);
        });
        toStep(2 + 2 * j);
        return st;
      }
      const castable = voters.filter((v) => v !== SELF);
      for (const v of castable.slice(0, Math.max(0, Math.floor(castable.length / 2)))) {
        if (first) run(v, { kind: "vote", card: first.id }, at);
      }
      if (done && first) run(SELF, { kind: "vote", card: first.id }, at + 20);
      return st;
    }
    // final
    toStep(2 * st.duels.length + 1);
    const fAt = st.stepStartedAt + 1_000;
    const finalPeople =
      plan.stage === "finalWrite" && !locked ? participants.filter((p) => p !== SELF) : participants;
    finalPeople.forEach((who, i) => {
      run(who, { kind: "answer", prompt: "final", text: TEXTS[(i + 3) % TEXTS.length] as string }, fAt);
      if (plan.stage === "finalWrite" && who !== SELF && i % 2 === 0) run(who, { kind: "lock" }, fAt + 10);
    });
    if (plan.stage === "finalWrite") {
      if (locked) run(SELF, { kind: "lock" }, fAt + 20);
      return st;
    }
    toStep(2 * st.duels.length + 2);
    const vAt = st.stepStartedAt + 800;
    const cards = lafCards(st, "final");
    const pickFor = (v: string, i: number) => {
      const others = cards.filter((c) => c.author !== v);
      const star = others.find((c) => c.author === "p1") ?? others[0];
      return i % 3 === 2 ? (others[others.length - 1] ?? star) : star;
    };
    const voters = participants.filter((v) => plan.stage === "finalReveal" || v !== SELF);
    voters.forEach((v, i) => {
      if (plan.stage === "finalVote" && i % 2 === 1) return;
      const c = pickFor(v, i);
      if (c) run(v, { kind: "vote", card: c.id }, vAt + i * 40);
    });
    if (plan.stage === "finalVote" && done) {
      const c = pickFor(SELF, 0);
      if (c) run(SELF, { kind: "vote", card: c.id }, vAt + 500);
    }
    if (plan.stage === "finalReveal") toStep(2 * st.duels.length + 3);
    return st;
  };

  // İki geçiş: önce hedef aşamanın başlangıcını bul, sonra zamanı bugüne oturt.
  const probe = build(0);
  const base = Date.now() - probe.stepStartedAt - plan.elapsed;
  let state = build(base);

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let rev = 1;
  const snapshot = (): RoomSnapshot => {
    if (kind === "laf-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = Date.now() + 40_000;
    }
    const ctx = { now: Date.now(), rng: createRng(1), connected: participants };
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: lafSokma.briefing.goal, steps: [...lafSokma.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: state.startedAt,
      phaseEndsAt,
      publicView: lafSokma.publicView(state, ctx),
      view: lafSokma.view(state, spectator ? null : SELF, ctx),
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
    const action = lafSokma.parseAction(msg.payload);
    if (!action) {
      mockAck(msg.seq, { ok: false, reason: "invalid_action" });
      return;
    }
    // Önizleme aşaması ekranda kalsın: eylem zamanı aşamanın içinde tutulur.
    const now = Math.min(Date.now(), state.stepEndsAt - 500);
    const r = lafSokma.reduce(state, SELF, action, { now, rng: createRng(1), connected: participants });
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
}
