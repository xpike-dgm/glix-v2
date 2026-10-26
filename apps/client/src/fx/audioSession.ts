import { KEYS, readStored, writeStored } from "../net/storage.js";

/**
 * iPhone sessiz düğmesi (Safari 16.4+ `navigator.audioSession`). Varsayılan: sessiz düğmesine uyulur.
 * Tercih açıksa oyun sesleri sessiz kipte de çalar.
 * Ayarlar ekranındaki "Sessiz modda da çal" anahtarı `setPlayInSilent` ile buraya bağlıdır.
 */

export interface AudioSessionHost {
  audioSession?: { type: string };
}

export function getPlayInSilent(): boolean {
  return readStored(KEYS.sessizdeCal) === "1";
}

export function setPlayInSilent(
  on: boolean,
  host: AudioSessionHost = navigator as unknown as AudioSessionHost,
): void {
  writeStored(KEYS.sessizdeCal, on ? "1" : "0");
  if (on) applyAudioSession(host);
  else setType(host, "auto");
}

function setType(host: AudioSessionHost, type: string): void {
  try {
    if (host.audioSession) host.audioSession.type = type;
  } catch {
    // desteklenmiyor: önemli değil
  }
}

/** Açılışta çağrılır: yalnız tercih açıksa "playback" yapar; varsayılanda hiçbir şey yapmaz. */
export function applyAudioSession(host: AudioSessionHost = navigator as unknown as AudioSessionHost): void {
  if (getPlayInSilent()) setType(host, "playback");
}
