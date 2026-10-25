import { createSignal, onCleanup, onMount } from "solid-js";

/**
 * Ekran klavyesi açılınca görünen alan küçülür (Android'de yalnız görsel görünüm, iOS'ta kaydırma da olur).
 * `visualViewport`'u izler; klavye açıkken ekran görünen alana oturtulur, böylece alan ve düğme hep görünür.
 */
export function createVisibleArea(): () => { top: number; height: number; keyboard: boolean } {
  const read = () => {
    const vv = window.visualViewport;
    const height = vv?.height ?? window.innerHeight;
    return {
      top: vv?.offsetTop ?? 0,
      height,
      keyboard: window.innerHeight - height > 120,
    };
  };
  const [area, setArea] = createSignal(read());
  onMount(() => {
    const vv = window.visualViewport;
    const update = (): void => {
      setArea(read());
    };
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    onCleanup(() => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    });
  });
  return area;
}
