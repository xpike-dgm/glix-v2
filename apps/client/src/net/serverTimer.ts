/**
 * `target` sunucu anına (ms) gelince `fn`'i bir kez çağırır; dönen işlev iptal eder.
 *
 * `setTimeout` yerel süreyle bekler, sunucu saati ise `Date.now() + ofset`tir. Bekleme sırasında gelen bir
 * ping/pong örneği ofset medyanını geri çekebilir (mobil ağda gidiş-dönüş asimetrisi onlarca ms) ya da cihaz
 * saati düzeltilebilir; o zaman zamanlayıcı hedefe varılmadan uyanır. Burada erken uyanış kalan süre için
 * yeniden kurulur: `fn` yalnız `now() >= target` iken çalışır. Böylece "evre sınırında bir kez yeniden hesapla"
 * kalıbı sınırı kaçırıp ekranı bir sonraki sunucu yayınına kadar eski evrede bırakmaz.
 */
export function atServerTime(target: number, fn: () => void, now: () => number): () => void {
  let id: ReturnType<typeof setTimeout> | undefined;
  const arm = (): void => {
    id = setTimeout(
      () => {
        if (now() >= target) fn();
        else arm();
      },
      Math.max(0, target - now()),
    );
  };
  arm();
  return () => clearTimeout(id);
}
