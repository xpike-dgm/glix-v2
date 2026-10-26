import { describe, expect, it } from "vitest";
import { resumeContext } from "./sound.js";

function fakeCtx(state: string) {
  const c = {
    state,
    resumes: 0,
    done: () => {},
    resume(): Promise<void> {
      c.resumes += 1;
      return new Promise((r) => {
        c.done = () => {
          c.state = "running";
          r();
        };
      });
    },
  };
  return c;
}

describe("resumeContext", () => {
  it("askıdaki ya da kesilmiş bağlamı sürdürür", () => {
    for (const st of ["suspended", "interrupted"]) {
      const c = fakeCtx(st);
      expect(resumeContext(c as unknown as AudioContext)).toBe(true);
      expect(c.resumes).toBe(1);
    }
  });

  it("çalan bağlama dokunmaz", () => {
    const c = fakeCtx("running");
    expect(resumeContext(c as unknown as AudioContext)).toBe(false);
    expect(c.resumes).toBe(0);
  });

  it("art arda çağrılınca tek resume havada kalır; bitince yine sürdürülebilir", async () => {
    const c = fakeCtx("suspended");
    resumeContext(c as unknown as AudioContext);
    resumeContext(c as unknown as AudioContext);
    resumeContext(c as unknown as AudioContext);
    expect(c.resumes).toBe(1);
    c.done();
    await Promise.resolve();
    await Promise.resolve();
    c.state = "interrupted";
    expect(resumeContext(c as unknown as AudioContext)).toBe(true);
    expect(c.resumes).toBe(2);
  });

  it("resume hata verirse sonraki denemeyi engellemez", async () => {
    const c = { state: "suspended", resume: () => Promise.reject(new Error("x")) };
    resumeContext(c as unknown as AudioContext);
    await Promise.resolve();
    await Promise.resolve();
    expect(resumeContext(c as unknown as AudioContext)).toBe(true);
  });
});
