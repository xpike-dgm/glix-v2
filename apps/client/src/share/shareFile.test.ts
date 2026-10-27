import { describe, expect, it, vi } from "vitest";
import { canShareFiles, cardFile, shareCard } from "./shareFile.js";

const file = cardFile(new Blob(["x"]), "glix-an-1");

describe("shareFile", () => {
  it("dosya adı .jpg ve türü image/jpeg", () => {
    expect(file.name).toBe("glix-an-1.jpg");
    expect(file.type).toBe("image/jpeg");
  });
  it("canShare yoksa ya da false ise dosyalı paylaşım yok", () => {
    expect(canShareFiles(undefined, file)).toBe(false);
    expect(canShareFiles({ share: async () => {} }, file)).toBe(false);
    expect(canShareFiles({ share: async () => {}, canShare: () => false }, file)).toBe(false);
    expect(canShareFiles({ share: async () => {}, canShare: () => true }, file)).toBe(true);
  });
  it("paylaşır; vazgeçmeyi ayırt eder; desteklenmiyorsa unsupported", async () => {
    const share = vi.fn(async () => {});
    expect(await shareCard({ share, canShare: () => true }, file)).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    const abort = async () => {
      throw new DOMException("x", "AbortError");
    };
    expect(await shareCard({ share: abort, canShare: () => true }, file)).toBe("cancelled");
    expect(await shareCard({}, file)).toBe("unsupported");
  });
});
