# Avatar çerçeveleri — süslü sürüm (5 görsel)

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki talimat ve ortak kuralları uygula (stil öneki dahil).
Kayıt: `/srv/glix/gorsel/gelen/cerceve-suslu/` (tam olarak aşağıdaki dosya adlarıyla). Bitince `TAMAM` bırak.

## Ne bu?
Sahip, senin mağaza maketindeki çerçeveleri (`gelen/magaza/tasarim/magaza-1.png` ve `dolabim.png`) çok beğendi,
ama oyuna konacak gerçek çerçeveler (`gelen/magaza/cerceve/`) onlardan **daha sade** kaldı. Bu sefer çerçeveleri
**maketteki gösterişli hâllerine** yakın üret: aynı süsleme düzeyi, aynı ışık ve parıltı, aynı karakter.

## Kurallar (öncekiyle aynı ölçüler)
- 1024×1024, saydam arka plan. Ortada avatar için **tam yuvarlak saydam delik**, çapı görselin **%62'si**, tam ortada.
- Süsler halkanın üstünde ve dışında; görselin dışına taşmasın (kenarlarda ~%3 boşluk).
- Telefonda 44–96 px görünür: süslü olsun ama küçükte de çamur gibi görünmesin (net konturlar, sınırlı parçacık).
- **Taç/kanat/yıldız gibi üst süsler artık serbest** (oyun, kazanan tacını gerektiğinde çerçevenin üstüne taşır).
  Yalnız **alt orta** (~%15) bölgesini sade tut: oraya "Sen" etiketi gelir.

| Dosya | Ad | Nadirlik | Maketteki hâline göre tarif |
|---|---|---|---|
| `camgobegi-halka.png` | Camgöbeği Halka | Sıradan | Camgöbeği neon halka, dışında küçük üçgen/ok süsleri ve ışık kıvılcımları |
| `pembe-halka.png` | Pembe Halka | Sıradan | Pembe/macenta neon halka, etrafında küçük neon kalpler ve parıltı |
| `cift-halka.png` | Çift Halka | Nadir | İç içe iki mor neon halka, aralarında enerji akışı, dışta mor kıvılcımlar |
| `donen-neon.png` | Dönen Neon | Nadir | Dönerek gösterilir: **dönme simetrili** pembe-mavi-mor neon yaylar ve ışık izleri (simetri şart) |
| `altin-tac-halkasi.png` | Altın Taç Halkası | Efsanevi | Altın neon, en gösterişli: üstte mücevherli taç, yanlarda kanat/ışın, altın kıvılcımlar |

## Kayıt
Dosya yazma aracında `encoding: base64` kullan. Her PNG'nin saydam olduğunu, 1024×1024 olduğunu ve ortadaki
deliğin tam saydam, tam ortada ve %62 çapında olduğunu ölç; Dönen Neon'un dönme simetrisini kontrol et.
Ayrıca `kontrol/onizleme.png` yap: her çerçeveyi bir avatarla 96 px ve 44 px boyutta göster.
Yalnız `/srv/glix/gorsel/gelen/cerceve-suslu/` klasörüne yaz; başka yere dokunma, paket kurma.
Bitince `TAMAM` dosyasına her dosya için "yaptım / yapamadım / şu kısmı eksik" yaz.
