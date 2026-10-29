/** Sunucu hata kodlarının oyuncuya gösterilen Türkçe karşılıkları. Ham kod ya da teknik metin asla gösterilmez. */
export const GENERIC_ERROR = "Bir sorun oluştu, biraz sonra tekrar dene.";
export const NETWORK_ERROR = "Bağlantı kurulamadı, tekrar dene.";

const TEXTS: Readonly<Record<string, string>> = {
  // Mağaza ve dolap
  unknown_item: "Bu ürün artık yok.",
  already_owned: "Bu ürüne zaten sahipsin.",
  insufficient_glix: "Yeterli Glix yok.",
  not_owned: "Bu ürüne sahip değilsin.",
  unknown_colour: "Bu renk seçilemez.",
  // Genel
  rate_limited: "Çok hızlı gidiyorsun, biraz yavaşla.",
  login_required: "Önce giriş yap.",
  forbidden: "Bu işlemi yapamazsın.",
  not_found: "Aradığın şey bulunamadı.",
  invalid_input: "Girdiğin bilgi geçersiz, kontrol edip tekrar dene.",
  invalid_message: "Girdiğin bilgi geçersiz, kontrol edip tekrar dene.",
  method_not_allowed: GENERIC_ERROR,
  server_error: GENERIC_ERROR,
  network: NETWORK_ERROR,
  // Oda ve oyun
  room_not_found: "Bu kodla bir oda bulunamadı.",
  room_full: "Oda dolu.",
  room_blocked: "Bu odaya şimdilik giremezsin.",
  match_in_progress: "Maç başlamış, bu odaya şimdi girilemez.",
  resume_failed: "Bu oda artık yok. Yeni bir oda kurabilirsin.",
  not_host: "Bunu yalnız ev sahibi yapabilir.",
  not_in_room: "Bir odada değilsin.",
  already_in_room: "Zaten bir odadasın.",
  invalid_games: "Seçtiğin oyunlarla maç kurulamıyor.",
  not_enough_players: "Oyuncu sayısı yetmiyor.",
  wrong_phase: "Bu işlem şimdi yapılamaz.",
  not_participant: "Bu işlemi yalnız oyuncular yapabilir.",
  card_invalid: "Bu kart şimdi oynanamaz.",
  game_failed: "Oyunda bir sorun çıktı, tekrar dene.",
  draining: "Oyun güncelleniyor, biraz sonra tekrar dene.",
  server_busy: "Şu an çok yoğunuz, biraz sonra tekrar dene.",
  maintenance: "Bakım yapılıyor, biraz sonra tekrar dene.",
  stage_full: "TV bağlantısı dolu.",
  stage_readonly: "TV'den bu işlem yapılamaz.",
  nickname_invalid: "Bu takma ad kullanılamaz.",
  nickname_taken: "Bu takma ad odada alınmış.",
  avatar_taken: "Bu karakteri başkası aldı.",
  account_name: "Bu ad kullanılamaz.",
  invite_failed: "Davet gönderilemedi, tekrar dene.",
  friend_not_found: "Bu kullanıcı adıyla biri bulunamadı.",
  report_limit: "Bu saat için bildirim sınırına ulaştın.",
  report_duplicate: "Bu oyuncuyu zaten bildirdin.",
};

/** İstemci tarafında bilinen bir Türkçe karşılığı olan kodlar (testlerde tüm protokol kodları denetlenir). */
export const KNOWN_ERROR_CODES: readonly string[] = Object.keys(TEXTS);

/** Ham kod, sayı, "undefined/null" ya da İngilizce hata gibi oyuncuya gösterilmemesi gereken metin mi? */
export function looksTechnical(text: string): boolean {
  const t = text.trim();
  if (t === "") return true;
  if (/^[a-z0-9_.:-]+$/i.test(t)) return true; // tek parça kod: unknown_item, 500, null
  if (
    /\b(undefined|null|NaN|exception|stack|internal server|unauthorized|bad request|failed|timeout)\b/i.test(
      t,
    )
  )
    return true;
  if (/^\d{3}\b/.test(t) || t.includes("[object")) return true;
  return false;
}

/** Kod için Türkçe metin; bilinmeyen kod genel mesaja düşer. */
export function errorTextForCode(code: unknown): string {
  return (typeof code === "string" && TEXTS[code]) || GENERIC_ERROR;
}

/**
 * Oyuncuya gösterilecek hata metni: sunucunun Türkçe mesajı temizse o, değilse koda göre yerel karşılık.
 */
export function playerErrorText(code: unknown, serverMessage?: unknown): string {
  if (typeof serverMessage === "string" && !looksTechnical(serverMessage)) return serverMessage;
  return errorTextForCode(code);
}
