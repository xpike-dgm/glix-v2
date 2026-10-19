import { createSignal, onCleanup, untrack } from "solid-js";
import { hasWord, typedWord } from "./view.js";

interface Options {
  /** Sunucudaki son değer (yeniden bağlanınca alanı doldurmak için bir kez okunur). */
  server: () => string;
  /** Metni sunucuya gönderir. */
  send: (text: string) => void;
  /** Boş metin de gönderilsin mi (tahmin kelimesini silmek için). */
  allowEmpty: boolean;
  delayMs?: number;
}

/** Yazılan metin: büyük harfe çevrilir ve kısa bir gecikmeyle sunucuya gider; `flush` bekleyeni hemen yollar. */
export function createWordDraft(opts: Options) {
  const initial = untrack(opts.server);
  const [text, setText] = createSignal(initial);
  let lastSent = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const sendable = (value: string): boolean =>
    opts.allowEmpty ? value === "" || hasWord(value) : hasWord(value);
  const flush = (): void => {
    clearTimeout(timer);
    const value = text();
    if (value === lastSent || !sendable(value)) return;
    lastSent = value;
    opts.send(value);
  };
  const input = (raw: string): string => {
    const value = typedWord(raw);
    setText(value);
    clearTimeout(timer);
    timer = setTimeout(flush, opts.delayMs ?? 350);
    return value;
  };
  return { text, input, flush };
}
