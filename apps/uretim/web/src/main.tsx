import { render } from "solid-js/web";
import "./stil/belirtecler.css";
import "./stil/temel.css";
import "./stil/bilesenler.css";
import "./stil/ekranlar.css";
import "./stil/uretim2.css";
import { App } from "./App.js";
import { tercihleriUygula } from "./durum.js";

tercihleriUygula();
const kok = document.getElementById("kok");
if (kok) render(() => <App />, kok);

// Hizmet çalışanı: yalnız bildirimler ve kabuğun çevrimdışı açılışı (taslak dosyalar önbelleğe alınmaz).
if ("serviceWorker" in navigator && location.protocol === "https:")
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
