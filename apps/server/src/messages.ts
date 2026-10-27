import type { ErrorCode, ServerMessage } from "@glix/engine";

export const ERROR_TEXT: Record<ErrorCode, string> = {
  invalid_message: "Geçersiz mesaj.",
  rate_limited: "Çok hızlı gidiyorsun, biraz yavaşla.",
  nickname_invalid: "Takma ad 1 ile 16 karakter arasında olmalı.",
  room_not_found: "Bu kodla bir oda bulunamadı.",
  room_full: "Oda dolu.",
  match_in_progress: "Bu odada oyun başladı, şimdi katılamazsın.",
  resume_failed: "Oturumun süresi dolmuş, yeniden katılmalısın.",
  not_host: "Bunu yalnızca oda sahibi yapabilir.",
  not_in_room: "Bir odada değilsin.",
  already_in_room: "Zaten bir odadasın.",
  invalid_games: "Seçilen oyunlar geçerli değil.",
  avatar_taken: "Bu karakter alınmış.",
  nickname_taken: "Bu takma ad odada kullanılıyor.",
  not_enough_players: "Yeterli oyuncu yok.",
  wrong_phase: "Bunu şu an yapamazsın.",
  not_participant: "Bu oyunda yer almıyorsun.",
  game_failed: "Oyunda bir sorun çıktı. Lobiye döndün, puanların korundu.",
  draining: "Güncelleme yapılıyor, birazdan tekrar dene.",
  server_busy: "Sunucu şu an çok yoğun, birazdan tekrar dene.",
};

export function errorMessage(code: ErrorCode, text?: string): ServerMessage {
  return { type: "error", code, message: text ?? ERROR_TEXT[code] };
}
