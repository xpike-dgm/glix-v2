import { type Accessor, createSignal } from "solid-js";

export interface VoteChoiceOptions {
  /** Bu karta dokunulabilir mi (oy hakkın var, kart senin değil, cevaplı). */
  canPick: (card: string) => boolean;
  /** Sunucudaki oyun (varsa); gelince seçim kesinleşmiş sayılır. */
  serverVote: Accessor<string | null>;
  /** Onaylanan oyu gönderir; `true` dönerse oy kabul edildi. */
  send: (card: string) => Promise<boolean>;
}

export interface VoteChoice {
  /** Ekranda vurgulanan kart: onaylanmış oy ya da yerel seçim. */
  picked: Accessor<string | null>;
  /** Oy kesinleşti (gönderildi ya da sunucuda var). */
  confirmed: Accessor<boolean>;
  busy: Accessor<boolean>;
  /** Karta dokunma: seçer; onaydan önce başka karta geçilebilir, aynı karta yeniden dokunmak seçimi bırakmaz. */
  pick: (card: string) => void;
  /** "BU DAHA KOMİK": seçili kartı oy olarak gönderir. Reddedilirse seçim yerinde kalır, yeniden onaylanabilir. */
  confirm: () => Promise<boolean>;
  reset: () => void;
}

/**
 * Oylama seçimi (dokun-seç, sonra onayla). Seçim yalnız yereldir; sunucuya yalnız onaylanan oy gider ve sunucu
 * oyu tek seferlik kabul eder.
 */
export function createVoteChoice(opts: VoteChoiceOptions): VoteChoice {
  const [local, setLocal] = createSignal<string | null>(null);
  const [sent, setSent] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const confirmed = () => opts.serverVote() !== null || sent() !== null;
  const picked = () => opts.serverVote() ?? sent() ?? local();
  return {
    picked,
    confirmed,
    busy,
    pick: (card) => {
      if (confirmed() || busy() || !opts.canPick(card)) return;
      setLocal(card);
    },
    confirm: async () => {
      const card = local();
      if (card === null || confirmed() || busy() || !opts.canPick(card)) return false;
      setBusy(true);
      setSent(card);
      const ok = await opts.send(card);
      setBusy(false);
      if (!ok) setSent(null);
      return ok;
    },
    reset: () => {
      setLocal(null);
      setSent(null);
      setBusy(false);
    },
  };
}
