/**
 * Yalnız geliştirme önizlemesi: Bozuk Telefon'un her aşaması.
 *   ?mock=bozuk-briefing
 *   ?mock=bozuk-write | bozuk-write-late (çizimi anlat) | bozuk-write-locked | bozuk-write-spectator
 *   ?mock=bozuk-draw | bozuk-draw-ink | bozuk-draw-locked | bozuk-draw-spectator
 *   ?mock=bozuk-show (&shown=2) | bozuk-vote | bozuk-vote-picked | bozuk-vote-voted | bozuk-vote-spectator
 *   ?mock=bozuk-result | bozuk-result-robust | bozuk-result-quiet | bozuk-results (oyun sonu: galeri + sıralama)
 *   ?mock=bozuk-write-sent (ilk cümle kablodan gitti)
 *   ?mock=bozuk-write-ilham (İlham ver önerileri) | bozuk-write-ilham-yok ("Şu an ilham yok") | bozuk-write-ilham-kapali
 *   ?mock=bozuk-gallery (&sonuc=1: altta "Devam et") — oyun içi sonuç: gecenin en komikleri
 * `&n=8` oyuncu sayısını değiştirir. Yazı ve çizim yerelde tutulur; oylar yerelde işlenir.
 * TV: ?mock=tv-bozuk-<aynı ad> (ör. tv-bozuk-show, tv-bozuk-vote, tv-bozuk-result-robust).
 */
import {
  BOZUK_EMPTY_TEXT,
  type BozukChainRecap,
  type BozukPublicView,
  type BozukReveal,
  type BozukStep,
  type BozukView,
  bozukRankAwards,
  bozukStepCount,
  DRAW_PENS,
  type DrawPen,
  GAMES,
  type GameInfo,
  type InspireMine,
  type KaralamaStroke,
  type MatchSnapshot,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";
import { sketch } from "./mockKaralama.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";
const GAME_ID = "bozuk-telefon";
const CATALOG: GameInfo[] = [
  { id: GAME_ID, name: "Bozuk Telefon", minPlayers: 3, maxPlayers: 8, orientation: "portrait" },
];
const IDEAS = [
  "PENGUEN SAHİLDE DONDURMA SATIYOR",
  "DİNOZOR OTOBÜSE YETİŞMEYE ÇALIŞIYOR",
  "AY'IN ÜSTÜNDE PİKNİK YAPAN İNEK",
];
const SENTENCES = [
  "KEDİ UZAYDA PİZZA YİYOR",
  "BALON ÇİÇEĞE ÇARPIP PATLADI",
  "DEV KAPLUMBAĞA BİSİKLET SÜRÜYOR",
  "ŞEMSİYELİ ROBOT YAĞMURDA DANS EDİYOR",
  "PASTA DENİZE DÜŞTÜ",
  "UZAYLI MARKETTEN EKMEK ALDI",
  "KAPLUMBAĞALAR GÖKDELENİN TEPESİNDE PİKNİK YAPIYOR",
];

export function startBozukMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const steps = bozukStepCount(n);
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: !(kind.includes("vote") && i === n - 1 && n > 5),
    score: 0,
    spectator: false,
  }));
  const spectator = kind.includes("spectator");
  const participants = players.map((p) => p.id).filter((id) => !(spectator && id === SELF));
  const now = Date.now();
  const source = GAMES[GAME_ID]?.briefing;
  const briefing = { goal: source?.goal ?? "", steps: [...(source?.steps ?? [])] };

  const isReveal = /bozuk-(show|vote|result)/.test(kind);
  const isVote = kind.includes("vote");
  // bozuk-gallery: oyunun kendi sonuç açılışı (galeri + "Devam et"; `&sonuc=1` şeridi gösterir).
  const isGallery = kind.startsWith("bozuk-gallery");
  const isResult = (kind.includes("result") && kind !== "bozuk-results") || isGallery;
  const isFinal = kind === "bozuk-results" || isGallery;
  const isWrite = kind.startsWith("bozuk-write");
  const late = kind === "bozuk-write-late";
  const step = isWrite ? (late ? 2 : 0) : 1;
  const robust = kind.includes("robust");
  const quiet = kind.includes("quiet");

  // Zincir: yaz, çiz, yaz, çiz ... (yazarlar sıra ile).
  const chain: BozukStep[] = Array.from({ length: steps }, (_, s) => {
    const author = `p${(s + 1) % n}`;
    return s % 2 === 0
      ? { kind: "write", author, text: SENTENCES[s % SENTENCES.length] ?? "" }
      : { kind: "draw", author, strokes: sketch(s + 2) };
  });
  // Sağlam olmayan zincirde son yazı adımı bozulmuş (ya da boş) gelir.
  const lastWrite = steps % 2 === 0 ? steps - 2 : steps - 1;
  if (!robust) {
    chain[lastWrite] = {
      kind: "write",
      author: `p${steps % n}`,
      text: steps === 3 ? "ÇOK ÜZGÜN BİR KÖPEK" : BOZUK_EMPTY_TEXT,
    };
  }

  let phase: RoomPhase = "playing";
  let phaseEndsAt: number | null = null;
  let phaseStartedAt = now - 5_000;
  if (kind === "bozuk-briefing") {
    phase = "briefing";
    phaseEndsAt = now + 40_000;
    phaseStartedAt = now;
  }
  if (isFinal && !isGallery) {
    phase = "results";
    phaseStartedAt = now;
    phaseEndsAt = now + 60_000;
  }

  let text: string | null = kind.includes("locked") && isWrite ? "KEDİ UZAYDA PİZZA YİYOR" : null;
  let strokes: Record<string, KaralamaStroke> = {};
  let nextKey = 0;
  let done = kind.includes("locked") || kind === "bozuk-write-sent";
  if (kind === "bozuk-write-sent") text = "KEDİ UZAYDA PİZZA YİYOR";
  let myVote: number | null = kind.includes("voted") ? 1 : null;
  if (kind === "bozuk-draw-ink") for (const s of sketch(0)) strokes[String(nextKey++)] = s;
  if (kind === "bozuk-draw-locked") for (const s of sketch(3)) strokes[String(nextKey++)] = s;
  const others = (): string[] => participants.filter((id) => id !== SELF);

  const revealView = (): BozukReveal => {
    const showShown = Math.min(steps, Math.max(1, Number(params.get("shown")) || 2));
    const stage = isResult ? "result" : isVote ? "vote" : "show";
    const shown = stage === "show" ? showShown : steps;
    const tally = stage === "result" && !quiet ? chain.map((_, i) => (i === 1 ? 3 : i === 2 ? 1 : 0)) : null;
    const named = stage === "result";
    const top = tally ? Math.max(0, ...tally) : 0;
    return {
      chain: 1,
      chains: n,
      starter: named ? "p1" : null,
      stage,
      shown,
      steps: chain.slice(0, shown).map((st) => ({ ...st, author: named ? st.author : null })),
      chainStartedAt: now - 4_000,
      voteStartsAt: now - 1_000,
      stageEndsAt: now + (stage === "vote" ? 5_000 : stage === "result" ? 1_800 : 2_000),
      voted:
        kind.includes("voted") || myVote !== null ? ["p1", "p3", ...(myVote !== null ? [SELF] : [])] : ["p1"],
      tally: stage === "result" ? (quiet ? chain.map(() => 0) : tally) : null,
      robust: stage === "result" ? robust : null,
      crowned: tally ? (top > 0 ? tally.flatMap((v, i) => (v === top ? [i] : [])) : []) : null,
    };
  };
  /** Oyun sonu özeti: her zincir, farklı taçlarla (biri sağlam, biri oysuz). */
  const recap = (): BozukChainRecap[] =>
    Array.from({ length: n }, (_, c) => {
      const steps: BozukStep[] = chain.map((st, s) => {
        const author = `p${(c + s) % n}`;
        return st.kind === "write"
          ? { kind: "write", author, text: SENTENCES[(c + s) % SENTENCES.length] ?? "" }
          : { kind: "draw", author, strokes: sketch(c + s) };
      });
      const tallyC = steps.map((_, i) =>
        c === 2 ? 0 : i === (c % (steps.length - 1)) + 1 ? 2 + (c % 2) : i === 0 ? 1 : 0,
      );
      const topC = Math.max(0, ...tallyC);
      return {
        chain: c,
        starter: `p${c % n}`,
        steps,
        tally: tallyC,
        robust: c === 0,
        crowned: topC > 0 ? tallyC.flatMap((v, i) => (v === topC ? [i] : [])) : [],
      };
    });
  const scores = (): Record<string, number> => Object.fromEntries(players.map((p, i) => [p.id, (i * 2) % 5]));

  const publicView = (): BozukPublicView => ({
    phase: isFinal ? "done" : isReveal ? "reveal" : isWrite ? "write" : "draw",
    startedAt: now - 5_000,
    step: isReveal || isFinal ? steps : step,
    steps,
    stepStartedAt: isReveal || isFinal ? null : now - 9_000,
    stepEndsAt: isReveal || isFinal ? null : now + (isWrite ? 16_000 : 51_000),
    players: participants,
    doneIds: [
      ...(done && !spectator ? [SELF] : []),
      ...((kind.includes("locked") || spectator) && !isReveal ? others().filter((_, i) => i % 2 === 0) : []),
    ],
    reveal: isReveal || isFinal ? revealView() : null,
    scores: isReveal || isFinal ? scores() : null,
    recap: isFinal ? recap() : null,
  });
  // Kendi adımın (yalnız sana): zincir 1'de s. adımı p(s+1) yazar.
  const myStepOf = (): number | null => {
    if (spectator || !isReveal) return null;
    const own = chain.findIndex((st) => st.author === SELF);
    const shownNow =
      isVote || isResult ? steps : Math.min(steps, Math.max(1, Number(params.get("shown")) || 2));
    return own >= 0 && own < shownNow ? own : null;
  };
  const view = (): BozukView => {
    if (spectator || isReveal || isFinal) {
      return {
        role: null,
        prompt: null,
        text: null,
        strokes: {},
        pointsLeft: 0,
        done: false,
        myVote: spectator ? null : myVote,
        myStep: myStepOf(),
      };
    }
    return {
      role: isWrite ? "write" : "draw",
      prompt: isWrite
        ? late
          ? { kind: "draw", strokes: sketch(3) }
          : null
        : { kind: "write", text: kind === "bozuk-draw-blank" ? BOZUK_EMPTY_TEXT : "KEDİ UZAYDA PİZZA YİYOR" },
      text: isWrite ? text : null,
      strokes: isWrite ? {} : { ...strokes },
      pointsLeft: 1500,
      done: done && !spectator,
      myVote: null,
      myStep: null,
    };
  };

  // "İlham ver" (kişisel): bozuk-write-ilham öneriler gelmiş, bozuk-write-ilham-yok son istek sonuçsuz.
  let inspire: InspireMine = kind.includes("ilham-yok")
    ? { left: 1, pending: false, failed: true, ideas: [] }
    : kind.includes("ilham")
      ? { left: 2, pending: false, failed: false, ideas: IDEAS }
      : { left: 3, pending: false, failed: false, ideas: [] };
  const publish = (): void => {
    const miniScores = scores();
    const snapshot: RoomSnapshot = {
      rev: Math.floor(Date.now() / 1000),
      serverNow: Date.now(),
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [GAME_ID],
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: CATALOG,
      match: {
        round: 0,
        total: 3,
        gameId: GAME_ID,
        gameName: "Bozuk Telefon",
        briefing,
        orientation: "portrait",
        participants,
        readyIds: ["p1", "p2"],
        continueIds: [],
        phaseStartedAt,
        phaseEndsAt,
        publicView: phase === "briefing" ? null : publicView(),
        view: phase === "briefing" ? null : view(),
        inspire:
          isWrite && step === 0 && !spectator && !kind.includes("ilham-kapali") ? { ...inspire } : null,
        result:
          isFinal && !isGallery ? { miniScores, awards: bozukRankAwards(miniScores, participants) } : null,
      } satisfies MatchSnapshot,
    };
    applySnapshot(snapshot);
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type === "ready") return;
    if (msg.type === "inspire") {
      if (inspire.pending || inspire.left === 0) return;
      inspire = { ...inspire, pending: true, failed: false, left: inspire.left - 1 };
      publish();
      setTimeout(() => {
        inspire = { ...inspire, pending: false, ideas: IDEAS };
        publish();
      }, 700);
      return;
    }
    if (msg.type !== "action") return;
    const a = msg.payload as {
      kind?: string;
      text?: string;
      step?: number;
      color?: string;
      size?: number;
      points?: number[];
    };
    if (a.kind === "lock") {
      done = isWrite ? text !== null : Object.keys(strokes).length > 0;
    } else if (
      done &&
      (a.kind === "text" || a.kind === "stroke" || a.kind === "undo" || a.kind === "clear")
    ) {
      return;
    } else if (a.kind === "text" && typeof a.text === "string") {
      text = a.text;
    } else if (a.kind === "stroke" && Array.isArray(a.points)) {
      const idx = DRAW_PENS.indexOf((a.color ?? "beyaz") as DrawPen);
      strokes[String(nextKey++)] = [Math.max(0, idx), a.size ?? 2, ...a.points];
    } else if (a.kind === "undo") {
      const last = Object.keys(strokes).at(-1);
      if (last !== undefined) delete strokes[last];
    } else if (a.kind === "clear") {
      strokes = {};
    } else if (a.kind === "vote" && typeof a.step === "number" && myVote === null) {
      myVote = a.step;
    } else return;
    publish();
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  publish();
}
