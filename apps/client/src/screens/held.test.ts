import {
  type Accessor,
  createMemo,
  createRenderEffect,
  createRoot,
  ErrorBoundary,
  type JSX,
  Match,
  Switch,
  untrack,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { describe, expect, it } from "vitest";
import { createHeld } from "./held.js";

/**
 * App.tsx'teki oda/maç ekran ağacının DOM'suz eşi: üst seçici (final / maç), maç dalında sonuç ekranı.
 * Sonuç ekranındaki bir hesap, maçın son oyunu bitip final gelirken aynı güncelleme turunda maç okuyucusunu
 * okur. Üretimdeki kayıt (iPhone, maç #15): `Stale read from <Match>.` ve ardından donan uygulama.
 */
interface Room {
  id: string;
  phase: "lobby" | "results" | "final";
  scores: number[];
  match: { round: number; total: number; awards: number[] } | null;
}

const resultsRoom = (): Room => ({
  id: "R",
  phase: "results",
  scores: [3, 1, 0],
  match: { round: 27, total: 28, awards: [2, 1, 0] },
});
const finalRoom = (): Room => ({ ...resultsRoom(), phase: "final", scores: [3, 1, 1] });

/** JSX olmadan bileşen ağacı: `Switch`/`Match` çağrıları ve çıktıyı çözen bir okuyucu. */
const resolve = (v: unknown): unknown => {
  let x = v;
  while (typeof x === "function") x = (x as () => unknown)();
  return Array.isArray(x) ? x.map(resolve) : x;
};
/** `children` çizim anında (seçicinin içinde, onun sahipliğinde) üretilir; JSX'teki `<Match>` çocukları gibi. */
const match = (when: () => unknown, children: () => unknown) =>
  Match({
    get when() {
      return when();
    },
    get children() {
      return children() as JSX.Element;
    },
  });
const sw = (children: () => JSX.Element[]) =>
  Switch({
    get children() {
      return children();
    },
  });

/**
 * `late`: sonuç ekranında, seçicinin dalı kapanmadan önce aynı turda çalışan hesap (puan sütunu gibi). Üretimde
 * böyle bir hesap Solid'in sıralamasında üst seçiciden önce koştu; burada aynı sıra, seçicinin dışına
 * bağlanmış bir memo ile kesinleştirilir.
 */
function mount(kind: "narrowed" | "held") {
  const [state, setState] = createStore<{ snapshot: Room | null }>({ snapshot: resultsRoom() });
  const screen = createMemo(() => state.snapshot?.phase ?? "home");
  let readMatch: (() => number) | null = null;
  // DOM'daki gibi: ağacın çıktısını bir çizim etkisi (render effect) okur.
  let shown: unknown = null;
  const out = (): unknown => shown;
  const dispose = createRoot((d) => {
    // Puan değişince maçı okuyan geç hesap (seçiciden önce oluşturulduğu için kuyrukta önde).
    createMemo(() => {
      state.snapshot?.scores.join();
      return readMatch ? untrack(() => readMatch?.()) : null;
    });
    const heldMatch = createHeld(() => state.snapshot?.match);
    const inner = (round: () => number) => {
      readMatch = () => round();
      return () => `sonuç ${round() + 1}`;
    };
    const tree = sw(() => [
      match(
        () => screen() === "home",
        () => "ana sayfa",
      ),
      match(
        () => screen() === "lobby",
        () => "lobi",
      ),
      match(
        () => screen() === "final",
        () => "final",
      ),
      kind === "narrowed"
        ? match(
            () => state.snapshot?.match,
            () => (m: Accessor<NonNullable<Room["match"]>>) => inner(() => m().round),
          )
        : match(
            () => state.snapshot?.match,
            () => inner(() => (heldMatch() as NonNullable<Room["match"]>).round),
          ),
    ]);
    createRenderEffect(() => {
      shown = resolve(tree);
    });
    return d;
  });
  return { state, setState, out, dispose };
}

describe("sonuç → final geçişi", () => {
  it("daraltılmış maç okuyucusu: geç hesap fırlatır ve ekran seçimi donar (eski yapı)", () => {
    const { setState, out, dispose } = mount("narrowed");
    expect(out()).toBe("sonuç 28");
    expect(() => setState("snapshot", reconcile(finalRoom(), { key: "id" }))).toThrow(
      // Üretim derlemesi: "Stale read from <Match>."; geliştirme derlemesi: "...stale value from <Match>...".
      /Stale read from <Match>|stale value from <Match>/,
    );
    // Donma: hata turu yarıda kestiği için seçici artık güncellenmez; ana sayfaya dönüş bile görünmez.
    setState("snapshot", null);
    expect(out()).not.toBe("ana sayfa");
    dispose();
  });

  it("son geçerli değer (createHeld): fırlatmaz, final ve ardından ana sayfa görünür", () => {
    const { setState, out, dispose } = mount("held");
    expect(out()).toBe("sonuç 28");
    setState("snapshot", reconcile(finalRoom(), { key: "id" }));
    expect(out()).toBe("final");
    setState("snapshot", null);
    expect(out()).toBe("ana sayfa");
    dispose();
  });

  it("yamalar ekranı yeniden kurmaz: aynı maç nesnesinde okuyucu değişmez", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore<{ snapshot: Room | null }>({ snapshot: resultsRoom() });
      const held = createHeld(() => state.snapshot?.match);
      let runs = 0;
      const ident = createMemo(() => {
        runs++;
        return held();
      });
      const first = ident();
      setState("snapshot", reconcile({ ...resultsRoom(), scores: [5, 5, 5] }, { key: "id" }));
      setState("snapshot", reconcile(finalRoom(), { key: "id" }));
      expect(ident()).toBe(first);
      expect(runs).toBe(1);
      // Oda kapanınca son değer kalır (geç kalan hesap fırlatmaz).
      setState("snapshot", null);
      expect(held()).toBe(first);
      dispose();
    });
  });
});

describe("ekran hata sınırı", () => {
  it("ekran çizilirken hata olursa güncelleme sürer; sınır yedeği gösterir, sıfırlanınca ekran döner", () => {
    const [state, setState] = createStore({ phase: "results" as "results" | "final" | "home", boom: false });
    const boundary: { reset?: () => void } = {};
    let shown: unknown = null;
    const dispose = createRoot((d) => {
      const view = ErrorBoundary({
        fallback: (_err: unknown, reset: () => void) => {
          boundary.reset = reset;
          return "hata ekranı";
        },
        get children() {
          return sw(() => [
            match(
              () => state.phase === "home",
              () => "ana sayfa",
            ),
            match(
              () => state.phase === "final",
              () => "final",
            ),
            match(
              () => state.phase === "results",
              () =>
                createMemo(() => {
                  if (state.boom) throw new Error("çizim hatası");
                  return "sonuç";
                }),
            ),
          ]);
        },
      });
      createRenderEffect(() => {
        shown = resolve(view);
      });
      return d;
    });
    expect(shown).toBe("sonuç");
    expect(() => setState("boom", true)).not.toThrow();
    expect(shown).toBe("hata ekranı");
    setState({ phase: "home", boom: false });
    boundary.reset?.();
    expect(shown).toBe("ana sayfa");
    dispose();
  });
});
