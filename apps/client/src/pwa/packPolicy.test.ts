import { describe, expect, it } from "vitest";
import {
  fraction,
  type LaunchInput,
  mayRun,
  megabytes,
  planLaunch,
  type RunGate,
  readNetwork,
} from "./packPolicy.js";

const launch = (o: Partial<LaunchInput> = {}): LaunchInput => ({
  standalone: true,
  guest: false,
  firstTime: true,
  optedOut: false,
  dataSaver: false,
  net: { cellular: false, saveData: false },
  complete: false,
  ...o,
});

describe("planLaunch", () => {
  it("paket tamamsa hiçbir şey yapılmaz", () => {
    expect(planLaunch(launch({ complete: true }))).toBe("none");
  });
  it("ana ekrandan ilk açılışta ekran gösterilir", () => {
    expect(planLaunch(launch())).toBe("screen");
  });
  it("mobil veride ya da veri tasarrufunda önce sorar", () => {
    expect(planLaunch(launch({ net: { cellular: true, saveData: false } }))).toBe("ask");
    expect(planLaunch(launch({ dataSaver: true }))).toBe("ask");
    expect(planLaunch(launch({ net: { cellular: false, saveData: true } }))).toBe("ask");
  });
  it("tarayıcı sekmesinde (ana ekran değil) ekran çıkmaz", () => {
    expect(planLaunch(launch({ standalone: false }))).toBe("none");
  });
  it("link/QR misafiri asla beklemez: arka plan", () => {
    expect(planLaunch(launch({ guest: true }))).toBe("background");
    expect(planLaunch(launch({ guest: true, standalone: false }))).toBe("background");
  });
  it("güncellemede (daha önce tamamlanmış) sessizce arka planda", () => {
    expect(planLaunch(launch({ firstTime: false }))).toBe("background");
  });
  it("önbelleği kendisi temizleyen için kendiliğinden indirme yok", () => {
    expect(planLaunch(launch({ firstTime: false, optedOut: true }))).toBe("none");
  });
});

describe("mayRun", () => {
  const gate = (o: Partial<RunGate> = {}): RunGate => ({
    foreground: false,
    dataSaver: false,
    wifiOnly: true,
    requireWifi: false,
    net: { cellular: false, saveData: false },
    online: true,
    screen: "home",
    cooledDown: true,
    ...o,
  });
  it("Wi-Fi'de güvenli ekranda arka plan çalışır", () => {
    expect(mayRun(gate())).toBe(true);
    expect(mayRun(gate({ screen: "lobby" }))).toBe(true);
  });
  it("maç sürerken durur (foreground dahil)", () => {
    for (const screen of ["briefing", "countdown", "playing", "results"] as const) {
      expect(mayRun(gate({ screen }))).toBe(false);
      expect(mayRun(gate({ screen, foreground: true }))).toBe(false);
    }
  });
  it("çevrimdışıyken ve bekleme süresindeyken çalışmaz", () => {
    expect(mayRun(gate({ online: false }))).toBe(false);
    expect(mayRun(gate({ cooledDown: false }))).toBe(false);
  });
  it("veri tasarrufunda arka plan çalışmaz, kullanıcı isterse çalışır", () => {
    expect(mayRun(gate({ dataSaver: true }))).toBe(false);
    expect(mayRun(gate({ net: { cellular: false, saveData: true } }))).toBe(false);
    expect(mayRun(gate({ dataSaver: true, foreground: true }))).toBe(true);
  });
  it("mobil veride yalnız Wi-Fi ayarı kapalıysa arka plan çalışır; 'Wi-Fi'yi bekle' her zaman engeller", () => {
    const cellular = { cellular: true, saveData: false };
    expect(mayRun(gate({ net: cellular }))).toBe(false);
    expect(mayRun(gate({ net: cellular, wifiOnly: false }))).toBe(true);
    expect(mayRun(gate({ net: cellular, wifiOnly: false, requireWifi: true }))).toBe(false);
    expect(mayRun(gate({ net: cellular, foreground: true }))).toBe(true);
  });
});

describe("yardımcılar", () => {
  it("readNetwork: bilgi yoksa kısıtlı sayılmaz", () => {
    expect(readNetwork({})).toEqual({ cellular: false, saveData: false });
    expect(readNetwork({ connection: { type: "cellular", saveData: true } })).toEqual({
      cellular: true,
      saveData: true,
    });
    expect(readNetwork({ connection: { type: "wifi" } }).cellular).toBe(false);
  });
  it("megabytes Türkçe ondalık yazar", () => {
    expect(megabytes(3.2 * 1024 * 1024)).toBe("3,2");
    expect(megabytes(16.4 * 1024 * 1024)).toBe("16");
    expect(megabytes(-5)).toBe("0,0");
  });
  it("fraction 0–1 arasında kalır", () => {
    expect(fraction(5, 10)).toBe(0.5);
    expect(fraction(20, 10)).toBe(1);
    expect(fraction(1, 0)).toBe(0);
  });
});
