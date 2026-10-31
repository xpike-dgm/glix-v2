import { describe, expect, it } from "vitest";
import { KENDIM_TOPIC_POOL } from "./pool.js";
import { KENDIM_TOPICS } from "./topics.js";

describe("kendim: yerleşik konular", () => {
  it("100 konu; hepsi havuz kurallarına uyar ve tekrarsızdır", () => {
    expect(KENDIM_TOPICS).toHaveLength(100);
    const keys = new Set<string>();
    for (const t of KENDIM_TOPICS) {
      const r = KENDIM_TOPIC_POOL.fromFields(KENDIM_TOPIC_POOL.toFields(t));
      expect(r.ok, t.topic).toBe(true);
      keys.add(KENDIM_TOPIC_POOL.key(t));
    }
    expect(keys.size).toBe(KENDIM_TOPICS.length);
  });
});
