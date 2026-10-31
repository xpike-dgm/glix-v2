/** Elle yedek: `node dist/yedekAl.js` (kap içinde; URETIM_YEDEK_DIR gerekli). Gece yedeği sunucu içinden de alınır. */
import { yerelZaman } from "./bildirim.js";
import { readConfig } from "./config.js";
import { openDb } from "./db.js";
import { Depo } from "./depo.js";
import { yedekAl } from "./yedek.js";

const c = readConfig();
if (!c.yedekDir) {
  console.error("URETIM_YEDEK_DIR ayarlı değil.");
  process.exit(1);
}
const db = openDb(c.db);
const r = await yedekAl(db, new Depo(c.depoDir, db), c.yedekDir, yerelZaman(Date.now(), c.saatDilimi).tarih);
console.log(JSON.stringify({ olay: "yedek", ...r }));
db.close();
