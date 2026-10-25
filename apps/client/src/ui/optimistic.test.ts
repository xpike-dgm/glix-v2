import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionAck } from "../net/client.js";
import { OptimisticCore } from "./optimistic.js";

function make(initial: number | null = null) {
  const changes: number[] = [];
  const rejects: Array<string | undefined> = [];
  const core = new OptimisticCore<number | null>(initial, {
    timeoutMs: 1000,
    graceMs: 200,
    onChange: () => changes.push(1),
    onReject: (r) => rejects.push(r),
  });
  return { core, changes, rejects };
}
const later =
  (ack: ActionAck, ms = 0) =>
  () =>
    new Promise<ActionAck>((res) => setTimeout(() => res(ack), ms));

describe("OptimisticCore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the local value immediately, before any ack", () => {
    const { core } = make(null);
    core.set(3, later({ ok: true }, 200));
    expect(core.get()).toBe(3);
    expect(core.pending).toBe(true);
  });

  it("drops the local value once the server view matches", () => {
    const { core } = make(null);
    core.set(3, later({ ok: true }, 200));
    core.sync(3);
    expect(core.pending).toBe(false);
    expect(core.get()).toBe(3);
  });

  it("keeps the local value while the server view still shows the old one", () => {
    const { core } = make(1);
    core.set(3, later({ ok: true }, 500));
    core.sync(1);
    expect(core.get()).toBe(3);
  });

  it("rolls back and reports a rejected action", async () => {
    const { core, rejects } = make(1);
    core.set(3, later({ ok: false, reason: "closed" }, 50));
    await vi.advanceTimersByTimeAsync(60);
    expect(core.get()).toBe(1);
    expect(rejects).toEqual(["closed"]);
  });

  it("falls back to the server value on timeout without an error", async () => {
    const { core, rejects } = make(1);
    core.set(3, later({ ok: false, reason: "timeout" }, 50));
    await vi.advanceTimersByTimeAsync(60);
    expect(core.get()).toBe(1);
    expect(rejects).toEqual([]);
  });

  it("falls back after the max wait when no ack ever arrives", async () => {
    const { core } = make(1);
    core.set(3, () => new Promise<ActionAck>(() => {}));
    await vi.advanceTimersByTimeAsync(999);
    expect(core.get()).toBe(3);
    await vi.advanceTimersByTimeAsync(2);
    expect(core.get()).toBe(1);
  });

  it("releases a corrected value shortly after an accepted ack", async () => {
    const { core } = make(1);
    core.set(99, later({ ok: true }, 10));
    core.sync(1);
    await vi.advanceTimersByTimeAsync(20);
    expect(core.get()).toBe(99);
    await vi.advanceTimersByTimeAsync(250);
    expect(core.get()).toBe(1);
  });

  it("ignores the ack of an older action when a newer one is pending", async () => {
    const { core, rejects } = make(null);
    core.set(1, later({ ok: false, reason: "closed" }, 100));
    core.set(2, later({ ok: true }, 300));
    await vi.advanceTimersByTimeAsync(150);
    expect(core.get()).toBe(2);
    expect(rejects).toEqual([]);
    core.sync(2);
    expect(core.pending).toBe(false);
  });

  it("treats a thrown send as offline", async () => {
    const { core, rejects } = make(5);
    core.set(7, () => Promise.reject(new Error("x")));
    await vi.advanceTimersByTimeAsync(1);
    expect(core.get()).toBe(5);
    expect(rejects).toEqual(["offline"]);
  });

  it("reset clears pending value", () => {
    const { core } = make(1);
    core.set(2, later({ ok: true }, 100));
    core.reset();
    expect(core.get()).toBe(1);
  });
});
