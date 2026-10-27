import { render } from "solid-js/web";
import "../fonts.js";
import "../styles/tokens.css";
import "./admin.css";
import { AdminApp } from "./AdminApp.js";

// Yönetici paneli oyundan ayrı bir giriş noktasıdır: oyun paketine ve hizmet çalışanı önbelleğine girmez.
const root = document.getElementById("root");
if (root) render(() => <AdminApp />, root);
