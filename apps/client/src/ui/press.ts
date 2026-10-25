/**
 * Dokununca anında etkinleşen ama klavye/ekran okuyucuyla da (`click`) çalışan düğme işleyicileri.
 * `pointerdown` ile hemen etkinleşir (parmak kalkmasını beklemez, ~50-100 ms kazanır); ardından gelen
 * `click` yinelenmez. Kaydırılan listelerde kullanılmaz: kaydırmayı başlatan dokunuş seçim sayılmasın.
 */
export function pressable(activate: () => void): {
  onPointerDown: (e: PointerEvent) => void;
  onClick: () => void;
} {
  let viaPointer = false;
  let reset: ReturnType<typeof setTimeout> | undefined;
  return {
    onPointerDown: (e) => {
      if (e.button !== 0 || !e.isPrimary) return;
      viaPointer = true;
      clearTimeout(reset);
      // Parmak düğmeden kayıp `click` gelmezse bayrak takılı kalmasın.
      reset = setTimeout(() => {
        viaPointer = false;
      }, 700);
      activate();
    },
    onClick: () => {
      if (viaPointer) {
        viaPointer = false;
        clearTimeout(reset);
        return;
      }
      activate();
    },
  };
}
