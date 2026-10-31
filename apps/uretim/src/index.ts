/** Üretim Merkezi sunucusu: başlatma ve düzgün kapanış. */
import { readConfig } from "./config.js";
import { uretimKur } from "./sunucu.js";

const config = readConfig();
const u = uretimKur(config);
u.server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      seviye: "bilgi",
      olay: "basladi",
      port: config.port,
      sahip: config.sahipEpostalar.length,
      oyun: u.merkez.oyun.acik,
    }),
  );
});
u.zamanlayicilariBaslat();
const kapan = (): void => {
  void u.kapat().finally(() => process.exit(0));
};
process.on("SIGTERM", kapan);
process.on("SIGINT", kapan);
