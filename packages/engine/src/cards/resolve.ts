import { CARDS, type CardId, MAX_HAND } from "./catalog.js";
import { deriveRng } from "./draw.js";

/** Kesinleşmiş bir kart oynayışı. `target`: hedef oyuncu; `gameId`: Veto / Oyunu Seç için seçilen oyun. */
export interface PlayedCard {
  playerId: string;
  cardId: CardId;
  target?: string;
  gameId?: string;
}

/** Sonuç ekranındaki bir etki satırı: "Çift Puan: +2 → +4". */
export interface CardLine {
  cardId: CardId;
  /** Kartı oynayan (kötü kartta çeken) oyuncu. */
  owner: string;
  /** Puanı değişen oyuncu. */
  subject: string;
  before: number;
  after: number;
  /** korundu: Koruma engelledi; yansidi: Ayna saldırıyı geri çevirdi; etkisiz: hedef yok / kart işlemedi. */
  note?: "korundu" | "yansidi" | "etkisiz";
}

export interface ResolveInput {
  /** Oyuna katılanlar (katılım sırası). */
  participants: readonly string[];
  /** Hâlâ odada olanlar; ayrılanın kartı ve hedefi olduğu kart etkisizdir. */
  present: readonly string[];
  miniScores: Readonly<Record<string, number>>;
  /** Oyunun ham genel skor puanları. */
  awards: Readonly<Record<string, number>>;
  /** Kesinleşmiş oynayışlar, oynanma sırasıyla. */
  plays: readonly PlayedCard[];
  /** Bu oyunda işleyen bekleyen kötü kartlar (oyuncu -> kartlar). */
  pending: Readonly<Record<string, readonly CardId[]>>;
  /** Oynanan kartlar çıktıktan sonraki eller (Kart Çal için). */
  hands: Readonly<Record<string, readonly CardId[]>>;
  /** Kart Çal rastgeleliği: maç tohumu ve oyun sırası. */
  seed: number;
  gameIndex: number;
}

export interface ResolveOutput {
  awards: Record<string, number>;
  lines: CardLine[];
  /** Kart Çal sonrası eller. */
  hands: Record<string, CardId[]>;
  /** Tetiklenerek açılan gizli kartlar (Ayna / Koruma) ve sahipleri. */
  revealed: PlayedCard[];
}

/** Sıfıra doğru yarılama (3→1, −3→−1, 1→0). */
const halve = (n: number): number => Math.trunc(n / 2) + 0;

/**
 * Oyun bitince kartların genel skor puanlarına etkisini hesaplar (docs/KURALLAR.md K6). Saftır: aynı girdi aynı çıktıyı verir.
 */
export function resolveCards(input: ResolveInput): ResolveOutput {
  const { participants } = input;
  const present = new Set(input.present);
  const a: Record<string, number> = { ...input.awards };
  for (const id of participants) a[id] ??= 0;
  const mini = (id: string): number => input.miniScores[id] ?? 0;
  const scores = participants.map(mini);
  const top = scores.length > 0 ? Math.max(...scores) : 0;
  const bottom = scores.length > 0 ? Math.min(...scores) : 0;
  const isFirst = (id: string): boolean => mini(id) === top;
  const isLast = (id: string): boolean => top > bottom && mini(id) === bottom;
  const hands: Record<string, CardId[]> = {};
  for (const [id, h] of Object.entries(input.hands)) hands[id] = [...h];
  const lines: CardLine[] = [];
  const revealed: PlayedCard[] = [];

  const isPlayer = (id: string | undefined): id is string =>
    id !== undefined && participants.includes(id) && present.has(id);
  const plays = input.plays.filter((p) => present.has(p.playerId) && participants.includes(p.playerId));
  const voidLine = (p: PlayedCard): void => {
    lines.push({
      cardId: p.cardId,
      owner: p.playerId,
      subject: p.playerId,
      before: a[p.playerId] ?? 0,
      after: a[p.playerId] ?? 0,
      note: "etkisiz",
    });
  };
  /** Adımdan önceki ödülle şimdikini karşılaştırıp değişen herkes için satır yazar; değişen yoksa sahibine tek satır. */
  const diff = (
    cardId: CardId,
    owner: string,
    before: Record<string, number>,
    note?: CardLine["note"],
  ): void => {
    let any = false;
    for (const id of participants) {
      const b = before[id] ?? 0;
      const n = a[id] ?? 0;
      if (b === n) continue;
      any = true;
      lines.push({ cardId, owner, subject: id, before: b, after: n, ...(note ? { note } : {}) });
    }
    if (!any)
      lines.push({
        cardId,
        owner,
        subject: owner,
        before: a[owner] ?? 0,
        after: a[owner] ?? 0,
        ...(note ? { note } : {}),
      });
  };
  const copy = (): Record<string, number> => ({ ...a });

  // 1. Ters Köşe
  for (const p of plays) {
    if (p.cardId !== "ters-kose") continue;
    const before = copy();
    reverseAwards(participants, mini, a);
    diff(p.cardId, p.playerId, before);
  }

  // 2. Takas
  for (const p of plays) {
    if (p.cardId !== "takas") continue;
    if (!isPlayer(p.target) || p.target === p.playerId) {
      voidLine(p);
      continue;
    }
    const before = copy();
    const t = a[p.target] ?? 0;
    a[p.target] = a[p.playerId] ?? 0;
    a[p.playerId] = t;
    diff(p.cardId, p.playerId, before);
  }

  // 3. Ortaklık
  for (const p of plays) {
    if (p.cardId !== "ortaklik") continue;
    if (!isPlayer(p.target) || p.target === p.playerId) {
      voidLine(p);
      continue;
    }
    const before = copy();
    const sum = (a[p.playerId] ?? 0) + (a[p.target] ?? 0);
    const high = Math.ceil(sum / 2);
    const ownerBetter = mini(p.playerId) >= mini(p.target);
    a[p.playerId] = ownerBetter ? high : sum - high;
    a[p.target] = ownerBetter ? sum - high : high;
    diff(p.cardId, p.playerId, before);
  }

  // 4. Çarpanlar: Ağır Yük, Çift Puan, Altın Dokunuş (oyuncu başına bu sırayla)
  for (const id of participants) {
    if (!present.has(id)) continue;
    for (const card of input.pending[id] ?? []) {
      if (card !== "agir-yuk") continue;
      const before = a[id] ?? 0;
      a[id] = halve(before);
      lines.push({ cardId: card, owner: id, subject: id, before, after: a[id] ?? 0 });
    }
    for (const p of plays) {
      if (p.playerId !== id || p.cardId !== "cift-puan") continue;
      const before = a[id] ?? 0;
      a[id] = before * 2;
      lines.push({ cardId: p.cardId, owner: id, subject: id, before, after: a[id] ?? 0 });
    }
    for (const p of plays) {
      if (p.playerId !== id || p.cardId !== "altin-dokunus") continue;
      const before = a[id] ?? 0;
      a[id] = before > 0 ? before * 3 : before;
      lines.push({ cardId: p.cardId, owner: id, subject: id, before, after: a[id] ?? 0 });
    }
  }

  // 5. Sabit eklemeler
  const add = (cardId: CardId, owner: string, subject: string, delta: number): void => {
    const before = a[subject] ?? 0;
    a[subject] = before + delta;
    lines.push({ cardId, owner, subject, before, after: a[subject] ?? 0 });
  };
  for (const p of plays) {
    const o = p.playerId;
    switch (p.cardId) {
      case "takviye":
        add(p.cardId, o, o, 1);
        break;
      case "sigorta":
        add(p.cardId, o, o, isLast(o) ? 1 : 0);
        break;
      case "kendine-guven":
        add(p.cardId, o, o, isFirst(o) ? 2 : -1);
        break;
      case "tahmin":
        if (!isPlayer(p.target) || p.target === o) voidLine(p);
        else add(p.cardId, o, o, isFirst(p.target) ? 2 : 0);
        break;
      default:
        break;
    }
  }
  for (const id of participants) {
    if (!present.has(id)) continue;
    for (const card of input.pending[id] ?? []) {
      if (card === "talihsizlik") add(card, id, id, -1);
      else if (card === "kumarbaz") add(card, id, id, -2);
      else if (card === "lanetli-hediye") add(card, id, id, -1);
    }
  }

  // 6. Saldırılar (oynanma sırasıyla)
  const guards = plays.filter((p) => p.cardId === "koruma" && isPlayer(p.target));
  const mirrors = plays.filter((p) => p.cardId === "ayna");
  const usedMirrors = new Set<PlayedCard>();
  const openTarget = (id: string): boolean => (input.pending[id] ?? []).includes("acik-hedef");
  plays.forEach((p, playIndex) => {
    if (!CARDS[p.cardId].attack) return;
    let attacker = p.playerId;
    let victim: string | undefined;
    if (p.cardId === "hirsiz") {
      const cands = participants.filter((id) => present.has(id) && id !== attacker && isFirst(id));
      let best: string | undefined;
      for (const id of cands) if (best === undefined || (a[id] ?? 0) > (a[best] ?? 0)) best = id;
      victim = best;
    } else victim = isPlayer(p.target) && p.target !== attacker ? p.target : undefined;
    if (victim === undefined) {
      voidLine(p);
      return;
    }
    const origAttacker = p.playerId;
    const block = (v: string): boolean => {
      const g = guards.find((x) => x.target === v);
      if (!g) return false;
      if (!revealed.includes(g)) revealed.push(g);
      lines.push({
        cardId: g.cardId,
        owner: g.playerId,
        subject: v,
        before: a[v] ?? 0,
        after: a[v] ?? 0,
        note: "korundu",
      });
      lines.push({
        cardId: p.cardId,
        owner: origAttacker,
        subject: v,
        before: a[v] ?? 0,
        after: a[v] ?? 0,
        note: "korundu",
      });
      return true;
    };
    if (block(victim)) return;
    let reflected = false;
    const mirror = mirrors.find((m) => m.playerId === victim && !usedMirrors.has(m));
    if (mirror) {
      usedMirrors.add(mirror);
      revealed.push(mirror);
      reflected = true;
      const was = attacker;
      attacker = victim;
      victim = was;
      if (block(victim)) {
        // Yansıyan saldırı saldıranın Koruması'na takıldı; Ayna yine de açıldı.
        lines.push({
          cardId: mirror.cardId,
          owner: mirror.playerId,
          subject: victim,
          before: a[victim] ?? 0,
          after: a[victim] ?? 0,
          note: "yansidi",
        });
        return;
      }
    }
    const before = copy();
    const amount = openTarget(victim) ? 2 : 1;
    switch (p.cardId) {
      case "celme":
        a[victim] = (a[victim] ?? 0) - amount;
        break;
      case "lanet":
        if ((a[victim] ?? 0) > 0) a[victim] = 0;
        break;
      case "vergi": {
        const cur = a[victim] ?? 0;
        if (cur > 0) {
          const t = Math.min(amount, cur);
          a[victim] = cur - t;
          a[attacker] = (a[attacker] ?? 0) + t;
        }
        break;
      }
      case "hirsiz":
        a[victim] = (a[victim] ?? 0) - amount;
        a[attacker] = (a[attacker] ?? 0) + amount;
        break;
      case "kart-cal": {
        const theirs = hands[victim] ?? [];
        if (theirs.length === 0) break;
        const rng = deriveRng(input.seed, "cal", input.gameIndex, playIndex);
        const [taken] = theirs.splice(rng.int(theirs.length), 1);
        const mine = hands[attacker] ?? [];
        if (taken !== undefined && mine.length < MAX_HAND) mine.push(taken);
        hands[attacker] = mine;
        hands[victim] = theirs;
        break;
      }
      default:
        break;
    }
    const noteArg = reflected ? ("yansidi" as const) : undefined;
    const changed = participants.some((id) => (before[id] ?? 0) !== (a[id] ?? 0));
    if (reflected && mirror)
      lines.push({
        cardId: mirror.cardId,
        owner: mirror.playerId,
        subject: victim,
        before: before[victim] ?? 0,
        after: a[victim] ?? 0,
        note: "yansidi",
      });
    if (changed || p.cardId !== "kart-cal") diff(p.cardId, origAttacker, before, noteArg);
    else
      lines.push({
        cardId: p.cardId,
        owner: origAttacker,
        subject: victim,
        before: a[victim] ?? 0,
        after: a[victim] ?? 0,
        ...(noteArg ? { note: noteArg } : {}),
      });
  });

  // 7. Hayırsever
  for (const id of participants) {
    if (!present.has(id) || !(input.pending[id] ?? []).includes("hayirsever")) continue;
    const before = copy();
    if ((a[id] ?? 0) > 0) {
      let last: string | undefined;
      for (const c of participants)
        if (c !== id && present.has(c) && isLast(c) && (last === undefined || (a[c] ?? 0) < (a[last] ?? 0)))
          last = c;
      if (last !== undefined) {
        a[id] = (a[id] ?? 0) - 1;
        a[last] = (a[last] ?? 0) + 1;
      }
    }
    diff("hayirsever", id, before);
  }

  // 8. Kalkan
  for (const p of plays) {
    if (p.cardId !== "kalkan") continue;
    const before = a[p.playerId] ?? 0;
    if (before < 0) a[p.playerId] = 0;
    lines.push({
      cardId: p.cardId,
      owner: p.playerId,
      subject: p.playerId,
      before,
      after: a[p.playerId] ?? 0,
    });
  }

  for (const k of Object.keys(a)) a[k] = (a[k] ?? 0) + 0; // -0 → 0
  return { awards: a, lines, hands, revealed };
}

/**
 * Ters Köşe: katılımcılar mini oyun puanına göre dizilir (yüksekten düşüğe, eşitlerde katılım sırası); her beraberlik grubu,
 * aynadaki sıraların ham ödül toplamını alır ve grup içinde eşit böler (artan, gruptaki ilk üyelerden başlayarak +1).
 */
export function reverseAwards(
  participants: readonly string[],
  mini: (id: string) => number,
  a: Record<string, number>,
): void {
  const order = participants
    .map((id, i) => ({ id, i }))
    .sort((x, y) => mini(y.id) - mini(x.id) || x.i - y.i)
    .map((x) => x.id);
  const raw = order.map((id) => a[id] ?? 0);
  const n = order.length;
  let s = 0;
  while (s < n) {
    let e = s + 1;
    while (e < n && mini(order[e] as string) === mini(order[s] as string)) e++;
    let total = 0;
    for (let k = n - e; k < n - s; k++) total += raw[k] ?? 0;
    const m = e - s;
    const base = Math.floor(total / m);
    const rem = total - base * m;
    for (let j = 0; j < m; j++) a[order[s + j] as string] = base + (j < rem ? 1 : 0);
    s = e;
  }
}
