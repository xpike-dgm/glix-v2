/**
 * Yalnız geliştirme önizlemesi: Yazı Yaz ekranları. Durum gerçek motorla (setup + reduce) kurulur, görünümler motorun
 * `publicView` / `view` çıktısıdır. Parametreler: `&n=3..8` oyuncu, `&role=writer|innocent`, `&topic=0` konusuz tur
 * (varsayılan konu MEYVE), `&t=ms` açılışın kaçıncı ms'i (varsayılan 8500: açılış bitmiş), `&chosen=i` seçili kişi,
 * `&seen=1` rol kartı çevrilmiş (pano açık), `&yorum=1` spiker yorumu.
 *   ?mock=yazi-briefing         anlatım
 *   ?mock=yazi-write            yazma: ters rol kartı (`&seen=1` pano açık)
 *   ?mock=yazi-write-locked     Tamam denildi (pano ●●●●●), diğerleri bekleniyor (yalnız sayı)
 *   ?mock=yazi-talk             sözlü tartışma (konu + harf ipucu); `yazi-talk-end` son 10 sn
 *   ?mock=yazi-talk-locked      "Tahmine geç" denildi
 *   ?mock=yazi-guess            tahmin (`&chosen=1` seçili başlar)
 *   ?mock=yazi-guess-locked     tahmin kilitli
 *   ?mock=yazi-reveal           sonuç (`yazi-reveal-zero`: hiç puan yok; `yazi-reveal-hidden`: sen yazansın, iz bırakmadın;
 *                               `yazi-reveal-empty`: bir yazan kelime yazmadı)
 *   ?mock=yazi-spectator-write | -talk | -guess | -reveal   katılımcı değilsin
 *   TV: ?mock=tv-yazi-write | tv-yazi-talk | tv-yazi-guess | tv-yazi-reveal&t=3000
 */
import type {
  GameInfo,
  MatchSnapshot,
  PlayerInfo,
  RoomPhase,
  RoomSnapshot,
  YaziYazAction,
} from "@glix/engine";
import { createRng, isRejected, YAZI_YAZ_TOPIC_POOL, yaziYaz } from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const INFO: GameInfo = {
  id: yaziYaz.id,
  name: yaziYaz.name,
  minPlayers: yaziYaz.minPlayers,
  maxPlayers: yaziYaz.maxPlayers,
  orientation: "portrait",
};
type State = ReturnType<typeof yaziYaz.setup>;

export function startYaziMock(kind: string, params: URLSearchParams): void {
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
  const ids = players.map((p) => p.id);
  const participants = ids.filter((id) => !(spectator && id === SELF));
  const stage = kind.includes("reveal")
    ? "reveal"
    : kind.includes("guess")
      ? "guess"
      : kind.includes("talk")
        ? "talk"
        : "write";
  const writerRole = params.get("role") === "writer" || kind.includes("hidden");
  const writers = writerRole ? [SELF, "p1"] : ["p1", "p2"];
  const words: Record<string, string> = {
    [writers[0] as string]: "KİRAZ",
    [writers[1] as string]: kind.includes("empty") ? "" : "KARPUZ",
  };
  const topic = params.get("topic") === "0" ? null : "MEYVE";
  const tRaw = Number(params.get("t"));
  const revealT = Number.isFinite(tRaw) && params.get("t") !== null ? tRaw : 8_500;

  const T0 = 1_000_000;
  const content = { [YAZI_YAZ_TOPIC_POOL.id]: [topic ?? "SERBEST"] };
  let state: State = {
    ...yaziYaz.setup(participants, { now: T0, rng: createRng(5), connected: participants, content }),
    writers: [...writers].filter((w) => participants.includes(w)),
  };
  const run = (who: string, action: YaziYazAction, at: number): void => {
    const r = yaziYaz.reduce(state, who, action, { now: at, rng: createRng(1), connected: participants });
    if (!isRejected(r)) state = r;
  };
  const others = participants.filter((id) => id !== SELF);
  const writeAt = T0 + 2_000;
  const locked = kind.includes("locked");
  const selfWrites = stage !== "write" || locked;
  // Yazma: diğerleri yazar; yarısı Tamam der (yazma aşamasında kim olduğu görünmez, yalnız sayı).
  for (const id of participants) {
    if (id === SELF && !selfWrites) continue;
    const w = words[id];
    if (state.writers.includes(id)) {
      if (w) run(id, { kind: "write", text: w }, writeAt);
    } else run(id, { kind: "write", text: "MASUM" }, writeAt);
  }
  if (stage === "write") {
    for (const id of others.slice(0, Math.max(1, Math.floor(n / 2) - 1))) run(id, { kind: "lock" }, writeAt);
    if (locked) run(SELF, { kind: "lock" }, writeAt);
  }
  const tick = (at: number): void => {
    state = yaziYaz.tick(state, { now: at, rng: createRng(1), connected: participants });
  };
  const talkAt = state.writeEndsAt + 1;
  if (stage !== "write") {
    tick(talkAt);
    if (stage === "talk") {
      for (const id of others.slice(0, 2)) run(id, { kind: "skip" }, talkAt);
      if (locked) run(SELF, { kind: "skip" }, talkAt);
    }
  }
  const guessAt = state.talkEndsAt + 1;
  if (stage === "guess" || stage === "reveal") {
    tick(guessAt);
    const [w1, w2] = state.writers as [string, string];
    participants.forEach((id, i) => {
      if (stage === "guess" && id === SELF) return;
      if (i % 4 === 3) return;
      let target = kind.includes("hidden")
        ? i % 2 === 0
          ? w2
          : (others.find((o) => o !== w1 && o !== w2) ?? w2)
        : i % 2 === 0
          ? w1
          : w2;
      if (target === id) target = id === w1 ? w2 : w1;
      if (kind.includes("zero") && id === SELF)
        target = others.find((o) => !state.writers.includes(o)) ?? target;
      run(id, { kind: "guessPlayer", target }, guessAt);
      const guess = i % 3 === 0 ? (words[target] ?? "") : i % 3 === 1 ? "ELMA" : "";
      if (guess)
        run(id, { kind: "guessWord", text: id === SELF && kind.includes("zero") ? "ELMA" : guess }, guessAt);
    });
    if (stage === "guess") {
      const chosen = params.get("chosen");
      if (chosen !== null || locked)
        run(SELF, { kind: "guessPlayer", target: `p${Number(chosen ?? 1)}` }, guessAt);
      if (locked) run(SELF, { kind: "guessWord", text: "KİRAZ" }, guessAt);
      for (const id of others.slice(0, 2)) if (state.guessTarget[id]) run(id, { kind: "lock" }, guessAt);
      if (locked) run(SELF, { kind: "lock" }, guessAt);
    }
  }

  // Ekrandaki an: aşamanın içinde (yazmada 9 sn, tartışmada 14 sn ya da son 8 sn, tahminde 8 sn, açılışta t).
  const atStage =
    stage === "write"
      ? T0 + 9_000
      : stage === "talk"
        ? kind.includes("end")
          ? state.talkEndsAt - 8_000
          : state.writeEndsAt + 14_000
        : stage === "guess"
          ? state.talkEndsAt + 8_000
          : state.guessEndsAt + revealT;
  tick(atStage);
  const shift = Date.now() - atStage;
  const real = (x: number): number => x + shift;

  let phase: RoomPhase = "playing";
  let readyIds: string[] = [];
  let phaseEndsAt: number | null = null;
  let rev = 1;
  const seen = params.get("seen") === "1";

  const snapshot = (): RoomSnapshot => {
    if (kind === "yazi-briefing") {
      phase = "briefing";
      readyIds = participants.slice(1, 3);
      phaseEndsAt = Date.now() + 40_000;
    }
    const ctx = { now: atStage, rng: createRng(1), connected: participants };
    const pub = yaziYaz.publicView(state, ctx);
    const pv = yaziYaz.view(state, spectator ? null : SELF, ctx);
    const shifted = {
      ...pub,
      startedAt: real(pub.startedAt),
      writeEndsAt: real(pub.writeEndsAt),
      talkEndsAt: real(pub.talkEndsAt),
      guessEndsAt: real(pub.guessEndsAt),
      finishAt: real(pub.finishAt),
    };
    const priv = seen && pv.myText === null && stage === "write" ? { ...pv, myText: "" } : pv;
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: INFO.id,
      gameName: INFO.name,
      briefing: { goal: yaziYaz.briefing.goal, steps: [...yaziYaz.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds,
      continueIds: [],
      phaseStartedAt: shifted.startedAt,
      phaseEndsAt,
      publicView: shifted,
      view: priv,
      result: null,
      ...(stage === "reveal" && params.get("yorum") === "1"
        ? { comment: "Elif 'KİRAZ' yazdı, masumdan bile masum göründü ama üç dedektif onu buldu." }
        : {}),
      ...(stage === "reveal"
        ? {
            reveal: {
              startedAt: shifted.guessEndsAt,
              endsAt: shifted.guessEndsAt + 60_000,
              continueIds: others.slice(0, 2),
            },
          }
        : {}),
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
    const action = yaziYaz.parseAction(msg.payload);
    if (!action) return;
    run(SELF, action, atStage);
    applySnapshot(snapshot());
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
