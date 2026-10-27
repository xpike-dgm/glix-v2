#!/usr/bin/env node
// Web bildirimleri için VAPID anahtar çifti üretir (yalnız node:crypto). Çıktıyı sunucunun .env dosyasına ekle.
// Kullanım: node scripts/vapid-keys.mjs [mailto:adres@alanadi.com | https://site]
import { createECDH } from "node:crypto";

const subject = process.argv[2] ?? "mailto:admin@example.com";
const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const b64u = (buf) => buf.toString("base64url");

console.log(`GLIX_VAPID_PUBLIC=${b64u(ecdh.getPublicKey())}`);
console.log(`GLIX_VAPID_PRIVATE=${b64u(ecdh.getPrivateKey())}`);
console.log(`GLIX_VAPID_SUBJECT=${subject}`);
