import { describe, expect, it } from "vitest";
import { snapshot } from "../net/fixtures.js";
import { selectScreen } from "./route.js";

describe("ekran seçimi", () => {
  it("oturum yokken ana sayfa, katıl ya da oda yok", () => {
    expect(selectScreen({ snapshot: null, nav: "home", notFound: false })).toBe("home");
    expect(selectScreen({ snapshot: null, nav: "join", notFound: false })).toBe("join");
    expect(selectScreen({ snapshot: null, nav: "join", notFound: true })).toBe("notfound");
  });
  it("snapshot varsa aşama ekranı seçilir", () => {
    for (const phase of ["lobby", "briefing", "countdown", "playing", "results", "final"] as const) {
      expect(selectScreen({ snapshot: snapshot(phase), nav: "home", notFound: true })).toBe(phase);
    }
  });
  it("maç verisi yoksa oyun aşamaları lobiye düşer, final düşmez", () => {
    expect(
      selectScreen({ snapshot: snapshot("playing", { match: null }), nav: "home", notFound: false }),
    ).toBe("lobby");
    expect(selectScreen({ snapshot: snapshot("final", { match: null }), nav: "home", notFound: false })).toBe(
      "final",
    );
  });
});
