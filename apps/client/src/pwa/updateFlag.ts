const FLAG = "glix.updated";

/** Yenilemeden hemen önce yazılır; yeni sürümde bir kez "Yeni sürüm yüklendi" gösterilsin diye. */
export function markUpdated(store: Pick<Storage, "setItem"> | null = safeSession()): void {
  try {
    store?.setItem(FLAG, "1");
  } catch {
    // yazılamadı: bildirim gösterilmez
  }
}

/** Bayrak varsa siler ve true döner (bir kez). */
export function consumeUpdated(
  store: Pick<Storage, "getItem" | "removeItem"> | null = safeSession(),
): boolean {
  try {
    if (store?.getItem(FLAG) !== "1") return false;
    store.removeItem(FLAG);
    return true;
  } catch {
    return false;
  }
}

function safeSession(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}
