# Aşama 2 — Karakterler (48 görsel)

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki "Görsel üreten araca talimat" ve "Ortak kurallar" bölümlerini uygula.
Stil kilitlendi: **her üretimde** `referans/secilen/` altındaki ilgili görseli referans olarak ver.
Kayıt yeri: `/srv/glix/gorsel/gelen/asama-2/` (dosya adları aşağıda, tam olarak bu adlarla). Bitince `TAMAM`.
Bu aşamada **her görselden tek** sürüm yeterli (stil kilitli); beğenmediğin olursa o dosyayı yeniden üret.

## Genel kurallar
- Boyut: kare (1024×1024), **şeffaf arka plan**, karakter ortada, yarım beden (bel üstü), kenarlarda boşluk.
- Kamera, ışık, kontur kalınlığı ve oran **`stil-avatar-p1-cyan-happy.png` ile aynı**.
- Yüz yok: maske (visor) her karakterin kendi sembolünü taşır; duygu **duruş + maske parlaklığı** ile anlatılır.
- Yazı, harf, rakam yok.

## 2.1 Avatar ifadeleri (32 görsel)
Her karakter için iki referans ver: **kendi büstü** (`referans/avatarlar/p<N>-<renk>-bust-v1.webp`) + duruş/stil için
`referans/secilen/stil-avatar-p1-cyan-happy.png`. Tarif: "Same character as the first reference (same outfit, hair,
colors and visor symbol), drawn in exactly the same style, camera and lighting as the second reference, <ifade>,
half-body, transparent background, no text."

| İfade | Dosya eki | <ifade> |
|---|---|---|
| Bekliyor | `idle` | relaxed calm pose, arms crossed, visor glowing softly |
| Seviniyor | `happy` | celebrating with both fists raised, visor glowing bright, small sparkles around |
| Şaşırdı | `shock` | leaning back in surprise, both hands raised near the head, visor flickering with a jagged glow |
| Elendi | `out` | slumped shoulders and lowered head, visor cracked and dim, colors slightly desaturated, small wisps of smoke |

Karakterler ve dosya adları (`2.1-<karakter>-<ek>.png`):
p1-cyan (ok), p2-magenta (kalp), p3-amber (şimşek), p4-lime (çubuklar), p5-violet (dalga), p6-orange (uyarı üçgeni),
p7-emerald (elmas), p8-cobalt (artı).
Örnek: `2.1-p3-amber-shock.png`. Not: `2.1-p1-cyan-happy.png` için seçilen stil görselini yeniden üretme, kopyalamak yeterli
değil — yönetici onu doğrudan kullanır; bu yüzden p1-cyan için yalnız `idle`, `shock`, `out` üret (toplam 31 görsel).

## 2.2 Maskot pozları (6 görsel)
Referans: `referans/secilen/stil-maskot.png`. Tarif: "The same robot mascot as the reference (same body, colors,
antenna, screen face), same style, <poz>, full body, transparent background, no text."

| Dosya | <poz> |
|---|---|
| `2.2-maskot-merhaba.png` | waving hello with one hand, happy screen face |
| `2.2-maskot-dusunuyor.png` | thinking, one hand on chin, screen face showing a curious look |
| `2.2-maskot-saskin.png` | jumping back in surprise, screen face showing wide round eyes |
| `2.2-maskot-kutluyor.png` | celebrating with arms up, colorful confetti pieces around |
| `2.2-maskot-bekliyor.png` | sitting and dozing, screen face with closed sleepy eyes, small floating "z"-like curved shapes (not letters) |
| `2.2-maskot-tamir.png` | holding a glowing wrench, fixing a loose cable, screen face focused |

## 2.3 Unvan rozetleri (10 görsel)
Referans: `referans/secilen/stil-nesne-kadeh.png` (malzeme, kontur ve parlama dili için). Tarif: "A round neon badge
emblem with a metallic dark rim and glowing edge, <sembol> in the center, same illustration style as the reference,
centered, transparent background, no text, no letters."

| Dosya | <sembol> |
|---|---|
| `2.3-rozet-blof-krali.png` | a small crown resting on a theatre mask |
| `2.3-rozet-laf-ustasi.png` | a microphone with a lightning bolt |
| `2.3-rozet-sogukkanli.png` | a stopwatch covered in frost |
| `2.3-rozet-son-kacan.png` | a running figure slipping through a closing door |
| `2.3-rozet-hayatta-kalan.png` | a heart with a shield in front |
| `2.3-rozet-acgozlu.png` | an overflowing stack of coins |
| `2.3-rozet-dedektif.png` | a magnifying glass over an eye |
| `2.3-rozet-sanatci.png` | a paint brush crossing a palette |
| `2.3-rozet-hafiza-ustasi.png` | a glowing brain with circuit lines |
| `2.3-rozet-turun-yildizi.png` | a five-pointed star with light rays |

Toplam: 31 + 6 + 10 = **47 görsel**.
