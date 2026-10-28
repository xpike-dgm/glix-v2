# Kürsü karakteri denemesi (onaylandı, Ekim 2026)

Sahip bu yöntemi onayladı; U18 M4 bu denemeden üretime taşınacak. Oyun kodu değildir, derlemeye girmez.

- `mesh.html`: PixiJS `MeshSimple` ile tek parça esneyen karakter. Her parça kendi (gizli bölgesi tamamlanmış) görseliyle
  atlasa girer; köşe ağırlıkları yalnız konuma ve kemiğe bağlıdır, böylece eklemlerde ebeveyn ve çocuk köşeleri aynı
  hareket eder (dikiş/kesik yok). Görseller: VDS `/srv/glix/gorsel/gelen/karakter/` (ChatGPT, `docs/gorsel/KARAKTER.md`).
- `bvh2dance.py`: CMU hareket kaydı (BVH) → `glix-dance-2` (önden görünüm, bizim iskelete göre yerel açılar, 30 fps,
  döngü karışımı). Kaynak: github.com/una-dinosauria/cmu-mocap (Bruce Hahne BVH dönüşümü).
  Lisans: "This data is free for use in research and commercial projects worldwide" (mocap.cs.cmu.edu);
  teşekkür metni: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with
  funding from NSF EIA-0196217."
- `*.json`: dönüştürülmüş danslar (makarena 143_35, tavuk 143_34, charleston 93_03, twist 141_12, sevinc 79_69,
  mickey 120_05).
- `index.html`: eski parçalı yöntem (karşılaştırma için).
