/**
 * Oyun başına oynama stratejileri. Her strateji görünümleri kendi küçük arayüzüyle okur (yalnız ihtiyaç duyduğu
 * alanlar); alan yoksa ya da tür beklenmedikse ya hiçbir şey yapmaz ya da hata verir (bots.ts güvenle düşer).
 *
 * Değişmekte olan oyunlar (Rüşvet ve Darbe, Ortalamanın Yarısı, Çizgiyi Geçme) burada
 * yok: onlarda bot `BOTS`'u kullanır. Son Kişi yalnız `phase`, `round`, `escaped` ve "escape"e dayanır.
 */
import { acgozlulukFairShare, ITTIFAK_BAND_MS, ittifakMaxPromises } from "@glix/engine";
import { shapeStrokes } from "./cizim.js";
import type { PlayCtx, PlayStep, PlayStrategy } from "./index.js";
import {
  BOZUK_GUESSES,
  BOZUK_SENTENCES,
  cagrisimAnswer,
  GUESS_WORDS,
  kendimAnswer,
  LAF_ANSWERS,
  pick,
  sozlukBluff,
  yaziWord,
} from "./metin.js";

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec {
  if (v === null || typeof v !== "object" || Array.isArray(v))
    throw new Error("görünüm beklenen biçimde değil");
  return v as Rec;
}
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const between = (c: PlayCtx, lo: number, hi: number): number => lo + c.rng.int(hi - lo + 1);

/**
 * "Düşünme" beklemesi: `key` için ilk görüşte bir an seçer; o an gelene dek bekler (true döner ve `wait` ile kalan
 * süreyi verir), sonra false.
 */
function thinking(c: PlayCtx, key: string, lo: number, hi: number): PlayStep | null {
  const k = `t:${key}`;
  let at = num(c.mem[k]);
  if (at === null) {
    at = c.now + between(c, lo, hi);
    c.mem[k] = at;
  }
  return c.now < at ? { next: Math.min(4_000, at - c.now + 50) } : null;
}

/** Kendisi dışındaki adaylardan biri; aynı kişiye hep oy vermesin diye bot başına karışık. */
function someoneElse(c: PlayCtx, pool: readonly string[]): string | null {
  const others = pool.filter((id) => id !== c.me);
  return others.length === 0 ? null : pick(c.rng, others);
}

// ——— Sözlük Blöfü ———
const sozluk: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  const phase = str(p.phase);
  if (phase === "write") {
    if (v.myBluff !== null) return null;
    return (
      thinking(c, "bluff", 6_000, 20_000) ?? {
        action: { kind: "bluff", text: sozlukBluff(c.rng, str(p.wordType)) },
      }
    );
  }
  if (phase === "pick") {
    if (v.locked === true) return null;
    if (v.myPick === null) {
      const wait = thinking(c, "pick", 3_000, 10_000);
      if (wait) return wait;
      const cards = (Array.isArray(p.cards) ? p.cards : [])
        .map((x) => str(rec(x).id))
        .filter((x) => x !== null);
      const card = someoneElse({ ...c, me: str(v.myCard) ?? "" }, cards);
      return card === null ? null : { action: { kind: "pick", card } };
    }
    return thinking(c, "pickLock", 1_000, 4_000) ?? { action: { kind: "lock" } };
  }
  return null;
};

// ——— Çağrışım Ağı ———
const cagrisim: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  if (str(p.phase) !== "answer" || v.myAnswer !== null) return null;
  const roundStartedAt = num(p.roundStartedAt) ?? 0;
  if (c.now < roundStartedAt) return { next: roundStartedAt - c.now + 50 };
  const round = num(p.round) ?? 0;
  return (
    thinking(c, `r${round}`, 3_000, 11_000) ?? {
      action: { kind: "answer", text: cagrisimAnswer(c.rng, str(p.word) ?? "") },
    }
  );
};

// ——— Yazı Yaz ———
const yaziYaz: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  const stage = str(p.stage);
  const topic = str(p.topic);
  if (stage === "write") {
    if (v.locked === true) return null;
    const wait = thinking(c, "write", 3_000, 10_000);
    if (wait) return wait;
    if (v.role === "writer" && v.myText === null)
      return { action: { kind: "write", text: yaziWord(c.rng, topic) } };
    return thinking(c, "writeLock", 1_000, 3_000) ?? { action: { kind: "lock" } };
  }
  if (stage === "talk") {
    if (c.mem.skipped === true) return null;
    const wait = thinking(c, "talk", 12_000, 30_000);
    if (wait) return wait;
    c.mem.skipped = true;
    return { action: { kind: "skip" } };
  }
  if (stage === "guess") {
    if (v.locked === true) return null;
    const guess = rec(v.myGuess ?? {});
    const wait = thinking(c, "guess", 3_000, 9_000);
    if (wait) return wait;
    if (str(guess.target) === null) {
      const target = someoneElse(c, strs(p.players));
      return target === null ? null : { action: { kind: "guessPlayer", target } };
    }
    if ((str(guess.word) ?? "") === "")
      return { action: { kind: "guessWord", text: yaziWord(c.rng, topic) } };
    return thinking(c, "guessLock", 1_000, 3_000) ?? { action: { kind: "lock" } };
  }
  return null;
};

// ——— Kendim ———
const kendim: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  const stage = str(p.stage);
  if (stage === "write") {
    if (v.locked === true) return null;
    if (v.myText === null) {
      return (
        thinking(c, "write", 4_000, 12_000) ?? {
          action: { kind: "write", text: kendimAnswer(c.rng, str(p.topic) ?? "") },
        }
      );
    }
    return thinking(c, "writeLock", 1_000, 3_000) ?? { action: { kind: "lock" } };
  }
  if (stage === "match") {
    if (v.locked === true) return null;
    const wait = thinking(c, "match", 2_000, 5_000);
    if (wait) return wait;
    const cards = (Array.isArray(v.cards) ? v.cards : [])
      .map((x) => num(rec(x).id))
      .filter((x) => x !== null);
    const pairs = rec(v.myPairs ?? {});
    const used = new Set(Object.values(pairs).filter((x): x is string => typeof x === "string"));
    const free = strs(p.owners).filter((id) => id !== c.me && !used.has(id));
    const open = cards.filter((id) => !Object.hasOwn(pairs, String(id)));
    const card = open[0];
    const target = free.length > 0 ? pick(c.rng, free) : null;
    if (card !== undefined && target !== null) {
      return { action: { kind: "match", card, target }, next: between(c, 1_200, 3_000) };
    }
    return thinking(c, "matchLock", 1_000, 3_000) ?? { action: { kind: "lock" } };
  }
  return null;
};

// ——— Laf Sokma Düellosu ———
const lafSokma: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  const phase = str(p.phase);
  if (phase === "write" || phase === "finalWrite") {
    if (v.locked === true) return null;
    const tasks = (Array.isArray(v.tasks) ? v.tasks : []).map(rec);
    const open = tasks.find((t) => t.answer === null);
    const wait = thinking(c, `${phase}:${String(open?.id ?? "lock")}`, 4_000, 12_000);
    if (wait) return wait;
    if (open) {
      const usedKey = "lafUsed";
      const used = strs(c.mem[usedKey]);
      const choices = LAF_ANSWERS.filter((a) => !used.includes(a));
      const text = pick(c.rng, choices.length > 0 ? choices : LAF_ANSWERS);
      c.mem[usedKey] = [...used, text];
      return { action: { kind: "answer", prompt: str(open.id) ?? "", text } };
    }
    return { action: { kind: "lock" } };
  }
  if (phase === "vote" || phase === "finalVote") {
    // Düellodaki yazarlar oy vermez; yalnız oy verebilenler (`voters`) ve cevabı olan kartlar.
    if (v.myVote !== null || !strs(p.voters).includes(c.me)) return null;
    const duel = p.duel === null ? null : rec(p.duel);
    const cards = (duel && Array.isArray(duel.cards) ? duel.cards : [])
      .map(rec)
      .filter((x) => typeof x.text === "string")
      .map((x) => str(x.id))
      .filter((x): x is string => x !== null && x !== v.myCard);
    if (cards.length === 0) return null;
    const wait = thinking(c, `vote:${String(p.index)}:${phase}`, 2_000, 6_000);
    if (wait) return wait;
    return { action: { kind: "vote", card: pick(c.rng, cards) } };
  }
  return null;
};

// ——— Bozuk Telefon ———
const bozukTelefon: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  const phase = str(p.phase);
  const step = num(p.step) ?? 0;
  if ((phase === "write" || phase === "draw") && v.done !== true) {
    if (v.role === "write") {
      if (v.text === null) {
        const wait = thinking(c, `w${step}`, 4_000, 10_000);
        if (wait) return wait;
        const firstStep = v.prompt === null;
        return { action: { kind: "text", text: pick(c.rng, firstStep ? BOZUK_SENTENCES : BOZUK_GUESSES) } };
      }
      return thinking(c, `wl${step}`, 1_000, 3_000) ?? { action: { kind: "lock" } };
    }
    if (v.role === "draw") return drawPlan(c, `d${step}`);
    return null;
  }
  if (phase === "reveal") {
    const reveal = p.reveal === null ? null : rec(p.reveal);
    if (!reveal || str(reveal.stage) !== "vote" || v.myVote !== null) return null;
    const steps = Array.isArray(reveal.steps) ? reveal.steps.length : 0;
    const mine = num(v.myStep);
    const options = Array.from({ length: steps }, (_, i) => i).filter((i) => i !== mine);
    if (options.length === 0) return null;
    const wait = thinking(c, `v${String(reveal.chain)}`, 1_000, 3_500);
    if (wait) return wait;
    return { action: { kind: "vote", step: pick(c.rng, options) } };
  }
  return null;
};

/** Çizim: bir şekil seçilir, her uyanışta bir darbe, bitince "Tamam". */
function drawPlan(c: PlayCtx, key: string): PlayStep | null {
  const planKey = `plan:${key}`;
  if (!Array.isArray(c.mem[planKey])) c.mem[planKey] = shapeStrokes(c.rng);
  const plan = c.mem[planKey] as unknown[];
  const doneKey = `drawn:${key}`;
  const drawn = num(c.mem[doneKey]) ?? 0;
  const wait = thinking(c, key, 1_500, 4_000);
  if (wait) return wait;
  const stroke = plan[drawn];
  if (stroke !== undefined) {
    c.mem[doneKey] = drawn + 1;
    return { action: stroke, next: between(c, 500, 1_400) };
  }
  return thinking(c, `${key}:lock`, 1_000, 3_000) ?? { action: { kind: "lock" } };
}

// ——— Karalama Defteri ———
const karalama: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  const phase = str(p.phase);
  if (phase === "draw") return v.drawDone === true ? null : drawPlan(c, "draw");
  if (phase === "vote") {
    if (v.locked === true) return null;
    if (v.myVote === null) {
      const wait = thinking(c, "vote", 3_000, 9_000);
      if (wait) return wait;
      const target = someoneElse(c, strs(p.players));
      return target === null ? null : { action: { kind: "vote", target } };
    }
    return thinking(c, "voteLock", 1_000, 3_000) ?? { action: { kind: "lock" } };
  }
  if (phase === "guess") {
    // Yalnız bilgisiz (yakın kelimeyi alan) son şansta ana kelimeyi tahmin eder.
    const reveal = p.reveal === null ? null : rec(p.reveal);
    if (!reveal || reveal.outsider !== c.me || c.mem.guessed === true) return null;
    const opens = num(reveal.guessOpensAt) ?? 0;
    if (c.now < opens) return { next: opens - c.now + 50 };
    const wait = thinking(c, "guess", 2_000, 6_000);
    if (wait) return wait;
    c.mem.guessed = true;
    const near = str(v.word);
    return { action: { kind: "guess", text: near ? cagrisimAnswer(c.rng, near) : pick(c.rng, GUESS_WORDS) } };
  }
  return null;
};

// ——— Sızma ———
const sizma: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  const phase = str(p.phase);
  if (phase === "clue") {
    const order = strs(p.order);
    const turn = num(p.turn) ?? 0;
    if (order.length === 0 || order[turn % order.length] !== c.me) return null;
    // Sözünü (gerçek hayatta) söylemiş gibi biraz bekler, sonra sırayı devreder.
    return thinking(c, `said${turn}`, 3_000, 7_000) ?? { action: { kind: "said", turn } };
  }
  if (phase === "vote" || phase === "runoff") {
    if (v.locked === true) return null;
    if (v.myVote === null) {
      const wait = thinking(c, phase, 4_000, 12_000);
      if (wait) return wait;
      const runoff = strs(p.runoff);
      const target = someoneElse(c, runoff.length > 0 ? runoff : strs(p.players));
      return target === null ? null : { action: { kind: "vote", target } };
    }
    return thinking(c, `${phase}Lock`, 1_000, 3_000) ?? { action: { kind: "lock" } };
  }
  if (phase === "notice") {
    if (v.myNotice !== null) return null;
    return thinking(c, "notice", 2_000, 5_000) ?? { action: { kind: "notice", yes: c.rng.int(2) === 0 } };
  }
  if (phase === "guess") {
    const reveal = p.reveal === null ? null : rec(p.reveal);
    if (!reveal || reveal.infiltrator !== c.me || c.mem.guessed === true) return null;
    const opens = num(reveal.guessOpensAt) ?? 0;
    if (c.now < opens) return { next: opens - c.now + 50 };
    const wait = thinking(c, "guess", 3_000, 8_000);
    if (wait) return wait;
    c.mem.guessed = true;
    const own = str(v.word);
    const text = own ? cagrisimAnswer(c.rng, own) : pick(c.rng, GUESS_WORDS);
    return { action: { kind: "guess", text } };
  }
  return null;
};

// ——— Kör Kronometre: hedef süreye yakın, inandırıcı sapmayla ———
const korKronometre: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  if (str(p.phase) !== "count" || v.pressed === true) return null;
  const handIndex = num(p.hand) ?? 0;
  const hand = (Array.isArray(p.played) ? p.played : []).map(rec).find((h) => h.index === handIndex);
  if (!hand) return null;
  const goAt = num(hand.goAt);
  const targetMs = num(hand.targetMs);
  if (goAt === null || targetMs === null) return null;
  const key = `press${handIndex}`;
  let at = num(c.mem[key]);
  if (at === null) {
    // ±0,3–1,5 sn sapma (iki yönde).
    const dev = between(c, 300, 1_500) * (c.rng.int(2) === 0 ? -1 : 1);
    at = goAt + targetMs + dev;
    c.mem[key] = at;
  }
  if (c.now < at) return { next: Math.max(1, at - c.now) };
  return { action: { kind: "press" }, next: 2_000 };
};

// ——— Son Kişi: her alarmda makul bir kaçış anı ———
/** SK-M2: 3 tur. Turun başlangıcı görünümde yok (yalnız `startedAt`); bot turu ilk gördüğü anı başlangıç sayar. */
const sonKisi: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  if (p.finished === true) return null;
  // Tur arasında sık bakar ki yeni turun başını kaçırmasın.
  if (str(p.phase) !== "play" || v.escaped === true) return { next: 250 };
  const key = `escape${num(p.round) ?? 0}`;
  let at = num(c.mem[key]);
  if (at === null) {
    at = c.now + between(c, 3_000, 10_000);
    c.mem[key] = at;
  }
  if (c.now < at) return { next: Math.max(1, at - c.now) };
  return { action: { kind: "escape" }, next: 250 };
};

// ——— Butona Bas: insan hızında basış ———
const butonaBas: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  if (str(p.phase) !== "play") return { next: between(c, 500, 1_200) };
  const readyAt = num(v.readyAt);
  if (readyAt !== null && c.now < readyAt) return { next: readyAt - c.now + between(c, 200, 900) };
  return { action: { kind: "press" }, next: between(c, 1_500, 4_000) };
};

// ——— İttifak: pazarlıkta çoğu zaman bir söz işareti, oylamada çoğunlukla sözünü tutar, sonra Tamam ———
const ittifakBot: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  const phase = str(p.phase);
  const players = strs(p.players);
  if (phase === "talk") {
    const mine = strs(v.myPromises);
    if (c.mem.promised !== true) {
      const wait = thinking(c, "promise", 3_000, 15_000);
      if (wait) return wait;
      c.mem.promised = true;
      // IT-M5: sınır oyuncu sayısına göre (3–4 kişide 1); bot çoğu zaman yalnız bir söz verir.
      if (mine.length < ittifakMaxPromises(players.length) && c.rng.int(4) !== 0) {
        const target = someoneElse(c, players);
        if (target !== null) return { action: { kind: "promise", target, on: true }, next: 1_000 };
      }
    }
    if (v.locked === true) return null;
    return thinking(c, "skip", 20_000, 40_000) ?? { action: { kind: "skip" } };
  }
  if (phase === "vote") {
    if (v.locked === true) return null;
    const opens = (num(p.talkEndsAt) ?? 0) + ITTIFAK_BAND_MS;
    if (c.now < opens) return { next: opens - c.now + 50 };
    if (v.myVote === null) {
      const wait = thinking(c, "vote", 2_000, 8_000);
      if (wait) return wait;
      const promised = strs(v.myPromises).filter((id) => players.includes(id) && id !== c.me);
      // Çoğu zaman sözünü tutar; bazen ihanet eder.
      const target =
        promised.length > 0 && c.rng.int(10) < 7 ? pick(c.rng, promised) : someoneElse(c, players);
      return target === null ? null : { action: { kind: "vote", target } };
    }
    return thinking(c, "lock", 1_000, 3_000) ?? { action: { kind: "lock" } };
  }
  return null;
};

// ——— Açgözlülük Limiti (AL-M2): her tur biraz düşünür, çoğunlukla adil paya yakın seçer, sonra Tamam ———
const acgozluluk: PlayStrategy = (c) => {
  const p = rec(c.pub);
  const v = rec(c.priv);
  if (p.reveal !== null || v.locked === true) return null;
  const round = num(p.round) ?? 1;
  const max = num(p.maxChoice) ?? 3;
  if (v.myChoice === null) {
    const wait = thinking(c, `pick${round}`, 1_500, 6_000);
    if (wait) return wait;
    const share = acgozlulukFairShare(max);
    const roll = c.rng.int(10);
    // Çoğu zaman adil pay ya da bir altı; bazen bir üstü (açgözlü), nadiren hepsi.
    const value = roll < 5 ? share : roll < 7 ? share - 1 : roll < 9 ? share + 1 : max;
    return { action: { kind: "choose", value: Math.max(0, Math.min(max, value)) }, next: 800 };
  }
  return thinking(c, `lock${round}`, 1_000, 4_000) ?? { action: { kind: "lock" } };
};

export const STRATEGIES: Record<string, PlayStrategy> = {
  "acgozluluk-limiti": acgozluluk,
  ittifak: ittifakBot,
  "sozluk-blofu": sozluk,
  "cagrisim-agi": cagrisim,
  "yazi-yaz": yaziYaz,
  kendim,
  "laf-sokma": lafSokma,
  "bozuk-telefon": bozukTelefon,
  "karalama-defteri": karalama,
  sizma,
  "kor-kronometre": korKronometre,
  "son-kisi": sonKisi,
  "butona-bas": butonaBas,
};
