import { BOZUK_TEXT_MAX } from "@glix/engine";
import { onCleanup, untrack } from "solid-js";

/** Alanda görünen biçim: Türkçe büyük harf, satır sonu boşluk, en çok 60 karakter. */
export function typedSentence(value: string): string {
  return Array.from(value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, " ").toLocaleUpperCase("tr-TR"))
    .slice(0, BOZUK_TEXT_MAX)
    .join("");
}

/** Gönderilebilir mi (en az bir harf ya da rakam). */
export const hasSentence = (value: string): boolean => /[\p{L}\p{N}]/u.test(value);

interface Props {
  /** Yalnız ilk değer (yeniden bağlanınca alan dolu gelir). */
  value: string;
  locked: boolean;
  placeholder: string;
  label: string;
  onChange: (text: string) => void;
  onEnter: () => void;
  /** Yazılan her değişiklik (sayaç ve "Tamam" düğmesi için). */
  onType: (text: string) => void;
  /** Bekleyen metni hemen sunucuya yollayan işlevi verir. */
  onFlush: (flush: () => void) => void;
}

/** Çok satırlı (en çok 2 satır görünür) cümle alanı: yazdıkça kısa gecikmeyle sunucuya gider. */
export function SentenceField(props: Props) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = untrack(() => props.value);
  let current = last;
  onCleanup(() => clearTimeout(timer));
  const flush = (): void => {
    clearTimeout(timer);
    if (current === last || !hasSentence(current)) return;
    last = current;
    props.onChange(current);
  };
  props.onFlush(flush);
  return (
    <div class="bt__field" data-locked={props.locked ? "1" : undefined}>
      <textarea
        class="bt__input"
        lang="tr"
        rows={2}
        maxlength={BOZUK_TEXT_MAX}
        autocomplete="off"
        autocapitalize="characters"
        autocorrect="off"
        spellcheck={false}
        enterkeyhint="done"
        placeholder={props.placeholder}
        aria-label={props.label}
        disabled={props.locked}
        value={untrack(() => props.value)}
        onInput={(e) => {
          const el = e.currentTarget;
          const value = typedSentence(el.value);
          if (value !== el.value) el.value = value;
          current = value;
          props.onType(value);
          clearTimeout(timer);
          timer = setTimeout(flush, 350);
        }}
        onBlur={flush}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            flush();
            props.onEnter();
          }
        }}
      />
    </div>
  );
}
