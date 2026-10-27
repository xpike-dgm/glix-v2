/** Basılı tutma: parmak `ms` boyunca kıpırdamadan kalırsa `onLong` çalışır. Kısa dokunuş `onTap` olur. */
export interface PointerLike {
  button: number;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
}

export interface LongPress {
  onPointerDown: (e: PointerLike) => void;
  onPointerMove: (e: PointerLike) => void;
  onPointerEnd: () => void;
  /** `keyboard`: klavye/ekran okuyucu tıklaması (`detail === 0`); basılı tutulamayacağı için doğrudan `onLong` olur. */
  onClick: (keyboard: boolean) => void;
}

export const LONG_PRESS_MS = 500;
/** Parmak bu kadar pikselden fazla kayarsa (kaydırma) basış iptal olur. */
export const LONG_PRESS_SLOP = 10;

export function createLongPress(
  onLong: () => void,
  onTap: () => void,
  ms = LONG_PRESS_MS,
  slop = LONG_PRESS_SLOP,
): LongPress {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;
  let startX = 0;
  let startY = 0;
  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  return {
    onPointerDown: (e) => {
      if (e.button !== 0 || !e.isPrimary) return;
      cancel();
      fired = false;
      startX = e.clientX;
      startY = e.clientY;
      timer = setTimeout(() => {
        timer = undefined;
        fired = true;
        onLong();
      }, ms);
    },
    onPointerMove: (e) => {
      if (timer === undefined) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > slop) cancel();
    },
    onPointerEnd: cancel,
    onClick: (keyboard) => {
      if (keyboard) {
        onLong();
        return;
      }
      // Basılı tutma tetiklendiyse parmak kalkınca gelen `click` kısa dokunuş sayılmaz.
      if (fired) {
        fired = false;
        return;
      }
      onTap();
    },
  };
}
