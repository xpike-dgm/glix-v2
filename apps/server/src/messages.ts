import type { ErrorCode, ServerMessage } from "@glix/engine";

export const ERROR_TEXT: Record<ErrorCode, string> = {
  invalid_message: "Geçersiz mesaj.",
  rate_limited: "Çok hızlı gidiyorsun, biraz yavaşla.",
  nickname_invalid: "Takma ad 1 ile 16 karakter arasında olmalı.",
  room_not_found: "Bu kodla bir oda bulunamadı.",
  room_full: "Oda dolu.",
  match_in_progress: "Oyun sürüyor, bitince tekrar dene.",
  resume_failed: "Oturumun süresi dolmuş, yeniden katılmalısın.",
  not_host: "Bunu yalnızca oda sahibi yapabilir.",
  not_in_room: "Bir odada değilsin.",
  already_in_room: "Zaten bir odadasın.",
  invalid_games: "Seçilen oyunlar geçerli değil.",
  avatar_taken: "Bu karakter alınmış.",
  nickname_taken: "Bu takma ad odada kullanılıyor.",
  account_name: "Hesabınla oynarken adın kullanıcı adındır. Profilinden değiştirebilirsin.",
  not_enough_players: "Yeterli oyuncu yok.",
  wrong_phase: "Bunu şu an yapamazsın.",
  not_participant: "Bu oyunda yer almıyorsun.",
  game_failed: "Oyunda bir sorun çıktı. Lobiye döndün, puanların korundu.",
  draining: "Güncelleme yapılıyor, birazdan tekrar dene.",
  server_busy: "Sunucu şu an çok yoğun, birazdan tekrar dene.",
  stage_full: "Bu odada zaten iki TV ekranı var.",
  login_required: "Oda kurmak için giriş yapmalısın.",
  stage_readonly: "TV ekranı oyuna karışamaz.",
  invite_failed: "Davet gönderilemedi.",
  friend_not_found: "Arkadaşın şu an katılabileceğin bir odada değil.",
  maintenance: "Kısa bir bakım yapıyoruz, birazdan tekrar dene.",
  report_limit: "Çok fazla bildirim gönderdin, biraz sonra tekrar dene.",
  report_duplicate: "Bu oyuncuyu zaten bildirdin.",
  room_blocked: "Odadan çıkarıldın, bu odaya şimdilik giremezsin.",
};

export function errorMessage(code: ErrorCode, text?: string): ServerMessage {
  return { type: "error", code, message: text ?? ERROR_TEXT[code] };
}
