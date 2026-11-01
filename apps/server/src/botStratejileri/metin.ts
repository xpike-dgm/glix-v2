/**
 * Oda botlarının yazdığı metinler: kısa, temiz, Türkçe. Hepsi elle yazılmış listelerden ve kalıplardan gelir; rastgele
 * karakter, görünmez karakter ya da uzun metin üretilmez. `isCleanBotText` her giden metni son kez denetler.
 */
import { moderateText, type Rng } from "@glix/engine";

/** Bot metninin üst sınırı (kod noktası). Oyunların kendi sınırları bundan büyük ya da eşittir (kelime oyunları hariç). */
export const BOT_TEXT_MAX = 70;

const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Cn}\p{Zl}\p{Zp}]/u;
const LETTER = /\p{L}/u;

/** Bot metni gösterilebilir mi: kırpılmış, tek boşluklu, görünmez/denetim karakteri yok, harf var, kısa, denetimden geçer. */
export function isCleanBotText(text: string): boolean {
  if (text !== text.trim() || text.length === 0 || /\s{2,}/u.test(text)) return false;
  if (FORBIDDEN.test(text) || !LETTER.test(text)) return false;
  if (Array.from(text).length > BOT_TEXT_MAX) return false;
  return moderateText(text).ok;
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  const item = list[rng.int(list.length)];
  if (item === undefined) throw new Error("boş liste");
  return item;
}

/** Türkçe büyük harf. */
export const upper = (s: string): string => s.toLocaleUpperCase("tr-TR");

/** Türkçe cümle başı: ilk harf büyük. */
export const sentence = (s: string): string => (s === "" ? s : upper(s.slice(0, 1)) + s.slice(1));

// ——— Sözlük Blöfü: inandırıcı sahte tanımlar ———

const ALET = ["sepet", "kepçe", "tokmak", "süzgeç", "kanca", "çengel", "kalıp", "tahta kaşık", "bakır tas"];
const YEMEK = ["çorba", "börek", "helva", "hamur tatlısı", "pilav", "pekmezli tatlı", "gözleme"];
const GIYSI = ["yelek", "şal", "başlık", "yün çorap", "önlük", "kuşak"];
const YORE = ["Ege", "Karadeniz", "Trakya", "İç Anadolu", "Doğu Anadolu", "Akdeniz"];
const YER = ["köylerde", "kasabalarda", "yaylalarda", "eski konaklarda", "çarşılarda"];
const MESLEK = ["çobanların", "denizcilerin", "değirmencilerin", "demircilerin", "dokumacıların"];
const SIFAT_A = ["çabuk alınan", "her işe karışan", "sözünde durmayan", "çok konuşan", "işi ağırdan alan"];
const SIFAT_B = ["huysuz", "aceleci", "inatçı", "meraklı", "titiz", "gösterişli", "dalgın"];
const FIIL_A = [
  "bir işi yarım bırakıp",
  "sesini çıkarmadan",
  "gereksiz yere",
  "kimseye sormadan",
  "acele ederek",
];
const FIIL_B = ["oyalanmak", "söylenmek", "ortalığı karıştırmak", "bir yerden ayrılmak", "eşyaları toplamak"];
const ZARF = [
  "Gizlice ve sessizce",
  "Telaşla, acele ederek",
  "Ağır ağır, isteksizce",
  "Bir anda, hiç beklemeden",
  "Yan gözle, çaktırmadan",
  "Kıvrılarak, dolambaçlı biçimde",
];

/** Kelime türüne göre bir sahte tanım (tek cümle, en çok 70 karakter). */
export function sozlukBluff(rng: Rng, wordType: string | null): string {
  const kalip: (() => string)[] =
    wordType === "sıfat"
      ? [
          () => `${sentence(pick(rng, SIFAT_A))} kimse için söylenir.`,
          () => `${sentence(pick(rng, SIFAT_B))} ve ${pick(rng, SIFAT_B)} olan.`,
          () => `Huyu ${pick(rng, SIFAT_B)} olan, ${pick(rng, SIFAT_A)}.`,
        ]
      : wordType === "fiil"
        ? [
            () => `${sentence(pick(rng, FIIL_A))} ${pick(rng, FIIL_B)}.`,
            () => `${sentence(pick(rng, FIIL_B))}, ${pick(rng, FIIL_B)}.`,
          ]
        : wordType === "zarf"
          ? [() => `${pick(rng, ZARF)}.`]
          : [
              () => `Eskiden ${pick(rng, YER)} kullanılan bir tür ${pick(rng, ALET)}.`,
              () => `${pick(rng, YORE)} yöresine özgü bir ${pick(rng, YEMEK)}.`,
              () => `Kışın giyilen kalın, yünlü bir ${pick(rng, GIYSI)}.`,
              () => `${sentence(pick(rng, MESLEK))} kullandığı küçük bir ${pick(rng, ALET)}.`,
              () => `Düğünlerde ikram edilen bir çeşit ${pick(rng, YEMEK)}.`,
            ];
  for (let i = 0; i < 6; i++) {
    const text = pick(rng, kalip)();
    if (isCleanBotText(text)) return text;
  }
  return "Eskiden kullanılan bir tür sepet.";
}

// ——— Çağrışım Ağı: kelime → çağrışımlar (ilki en yaygın) ———

const CAGRISIM_RAW = `
DENİZ:mavi,dalga,tatil|KIŞ:kar,soğuk,atkı|YAZ:tatil,sıcak,deniz|GÜZ:yaprak,sonbahar,yağmur|BAHAR:çiçek,yeşil,nisan
GÜNEŞ:sıcak,sarı,yaz|AY:gece,dolunay,yıldız|YILDIZ:gece,gökyüzü,parlak|YAĞMUR:şemsiye,bulut,ıslak|KAR:kış,beyaz,soğuk
RÜZGAR:esinti,fırtına,uçurtma|BULUT:gökyüzü,yağmur,beyaz|GÖKKUŞAĞI:renkler,yağmur,yedi|ŞİMŞEK:gök gürültüsü,fırtına,yıldırım
FIRTINA:rüzgar,yağmur,şimşek|SİS:puslu,sabah,görünmez|BUZ:soğuk,kış,kaygan|ORMAN:ağaç,yeşil,doğa|DAĞ:zirve,kar,yüksek
NEHİR:su,akıntı,köprü|GÖL:su,ördek,sakin|ŞELALE:su,doğa,yüksek|MAĞARA:karanlık,yarasa,taş|ÇÖL:kum,sıcak,deve
VOLKAN:lav,ateş,dağ|ADA:deniz,tatil,kumsal|SAHİL:kum,deniz,yaz|KUM:plaj,çöl,sahil|DALGA:deniz,sörf,köpük
ÇİÇEK:gül,bahar,koku|GÜL:kırmızı,çiçek,diken|YAPRAK:ağaç,yeşil,sonbahar|AĞAÇ:yaprak,orman,gölge|TOPRAK:bahçe,çamur,tohum
TAŞ:sert,kaya,duvar|ŞAFAK:sabah,güneş,erken|GECE:karanlık,uyku,yıldız|SABAH:kahvaltı,güneş,uyanmak|AKŞAM:gün batımı,yemek,eve dönüş
ATEŞ:sıcak,alev,kamp|SU:içmek,serin,deniz|HAVA:nefes,rüzgar,oksijen|OKYANUS:mavi,balina,derin
KEDİ:miyav,tüy,süt|KÖPEK:havlamak,sadık,kemik|KUŞ:uçmak,kanat,yuva|ARI:bal,vızıltı,çiçek|KELEBEK:kanat,renkli,çiçek
BALIK:deniz,yüzmek,olta|AT:koşu,nal,çiftlik|İNEK:süt,çiftlik,çayır|KOYUN:yün,kuzu,çoban|TAVUK:yumurta,kümes,civciv
HOROZ:sabah,ötmek,kümes|ÖRDEK:göl,vak,yüzmek|KURBAĞA:vırak,göl,zıplamak|KAPLUMBAĞA:yavaş,kabuk,deniz|YILAN:zehir,tıslamak,uzun
AYI:bal,orman,kış uykusu|ASLAN:kral,yele,orman|KAPLAN:çizgili,orman,hızlı|FİL:hortum,büyük,gri|ZÜRAFA:uzun boyun,benekli,Afrika
MAYMUN:muz,ağaç,şaklaban|TAVŞAN:havuç,kulak,zıplamak|TİLKİ:kurnaz,kızıl,orman|KURT:ulumak,sürü,orman|SİNCAP:fındık,ağaç,kuyruk
KİRPİ:diken,gece,elma|YUNUS:deniz,akıllı,zıplamak|BALİNA:büyük,okyanus,mavi|PENGUEN:buz,soğuk,siyah beyaz|KARINCA:çalışkan,yuva,küçük
DEVE:çöl,hörgüç,kum|PANDA:bambu,siyah beyaz,sevimli|ELMA:kırmızı,meyve,ağaç|MUZ:sarı,maymun,meyve|ÇİLEK:kırmızı,tatlı,yaz
KARPUZ:yaz,kırmızı,çekirdek|LİMON:ekşi,sarı,limonata|PORTAKAL:turuncu,meyve suyu,vitamin|ZEYTİN:kahvaltı,yeşil,yağ
DOMATES:kırmızı,salata,sebze|PATATES:kızartma,cips,sebze|EKMEK:fırın,sıcak,kahvaltı|SİMİT:susam,çay,kahvaltı
ÇORBA:sıcak,kaşık,mercimek|PİLAV:pirinç,tereyağı,yemek|PİZZA:peynir,İtalya,dilim|DONDURMA:yaz,soğuk,külah|PASTA:doğum günü,mum,krema
ÇİKOLATA:tatlı,kakao,kahverengi|BAL:arı,tatlı,kahvaltı|PEYNİR:kahvaltı,beyaz,süt|YUMURTA:kahvaltı,tavuk,omlet|SÜT:beyaz,inek,kahvaltı
ÇAY:demlik,sıcak,bardak|KAHVE:fincan,sabah,köpük|ŞEKER:tatlı,beyaz,çay|TUZ:yemek,beyaz,deniz|BAKLAVA:şerbet,fıstık,bayram
OKUL:öğretmen,sınıf,ders|HASTANE:doktor,hemşire,ilaç|KÜTÜPHANE:kitap,sessiz,okumak|PAZAR:sebze,meyve,alışveriş|SİNEMA:film,patlamış mısır,perde
MÜZE:tarih,sergi,tablo|HAVALİMANI:uçak,bavul,yolculuk|İSTASYON:tren,bilet,bekleme|LİMAN:gemi,deniz,yük|KÖY:tarla,huzur,ahır
ŞEHİR:kalabalık,trafik,bina|KAMP:çadır,ateş,doğa|KÖPRÜ:nehir,geçmek,boğaz|BAHÇE:çiçek,çim,ağaç|MUTFAK:yemek,tencere,ocak
PARK:salıncak,çocuk,yeşil|HAVUZ:yüzmek,su,yaz|ÇİFTLİK:hayvan,traktör,tarla|MASA:sandalye,yemek,ahşap|SANDALYE:oturmak,masa,ahşap
YASTIK:uyku,yatak,yumuşak|AYNA:yansıma,cam,bakmak|SAAT:zaman,dakika,kol|GÖZLÜK:göz,cam,okumak|ŞEMSİYE:yağmur,ıslak,açmak
ÇANTA:okul,omuz,eşya|ANAHTAR:kapı,kilit,ev|KİTAP:okumak,sayfa,hikaye|KALEM:yazmak,defter,kurşun|MAKAS:kesmek,kağıt,keskin
SABUN:köpük,temizlik,el|ŞAPKA:baş,güneş,moda|BİSİKLET:pedal,tekerlek,gezmek|ARABA:yol,tekerlek,sürmek|UÇAK:uçmak,bulut,tatil
GEMİ:deniz,kaptan,liman|TREN:ray,istasyon,vagon|TELEFON:aramak,mesaj,ekran|BİLGİSAYAR:klavye,internet,ekran|GİTAR:tel,müzik,şarkı
PİYANO:tuşlar,müzik,konser|DAVUL:ritim,ses,bayram|ÇADIR:kamp,doğa,uyku|BALON:uçmak,parti,renkli|DÜĞÜN:gelin,halay,davul
BAYRAM:şeker,harçlık,ziyaret|PARTİ:müzik,dans,eğlence|KONSER:müzik,sahne,şarkı|SINAV:ders,heyecan,not|TATİL:deniz,dinlenmek,yaz
MAÇ:futbol,gol,taraftar|PİKNİK:çimen,mangal,doğa|DOKTOR:hastane,ilaç,muayene|ÖĞRETMEN:okul,ders,tahta|AŞÇI:yemek,mutfak,önlük
PİLOT:uçak,gökyüzü,kokpit|İTFAİYECİ:yangın,hortum,kırmızı|ASTRONOT:uzay,roket,ay|SEVİNÇ:mutluluk,gülmek,neşe|KORKU:karanlık,titremek,çığlık
MUTLULUK:gülmek,neşe,sevinç|ÖFKE:kızgın,bağırmak,kırmızı|HEYECAN:kalp,merak,sürpriz|UMUT:gelecek,ışık,dilek|FUTBOL:gol,top,maç
BASKETBOL:pota,top,smaç|YÜZME:havuz,deniz,su|KAYAK:kar,dağ,kış|TENİS:raket,top,file|SATRANÇ:şah,piyon,strateji
İNTERNET:bilgisayar,bağlantı,site|ROBOT:makine,metal,yapay zeka|ROKET:uzay,hızlı,fırlatmak|UZAY:yıldız,gezegen,astronot|OYUNCAK:çocuk,oyun,bebek
`;

const CAGRISIM_TABLE: ReadonlyMap<string, readonly string[]> = new Map(
  CAGRISIM_RAW.split(/[|\n]/u)
    .map((part) => part.trim())
    .filter((part) => part.includes(":"))
    .map((part) => {
      const [word, rest] = part.split(":") as [string, string];
      return [word, rest.split(",").map((s) => s.trim())] as const;
    }),
);

const CAGRISIM_FALLBACK = ["güzel", "büyük", "renkli", "eski", "küçük", "eğlenceli"];

/** Ana kelime için bir çağrışım: çoğunlukla ilk (en yaygın) cevap, ki botlar gruplaşabilsin. */
export function cagrisimAnswer(rng: Rng, word: string): string {
  const list = CAGRISIM_TABLE.get(upper(word.trim()));
  if (!list || list.length === 0) return pick(rng, CAGRISIM_FALLBACK);
  const roll = rng.int(10);
  return (roll < 5 ? list[0] : roll < 8 ? list[1] : list[2]) ?? (list[0] as string);
}

/** Tabloda karşılığı olan kelimeler (testler için). */
export const CAGRISIM_KNOWN: readonly string[] = [...CAGRISIM_TABLE.keys()];

// ——— Yazı Yaz: konu → kelimeler ———

const YAZI_RAW = `
MEYVE:ELMA,ARMUT,MUZ,ÇİLEK,KİRAZ,KARPUZ|SEBZE:HAVUÇ,PATATES,DOMATES,ISPANAK,BİBER|MESLEK:DOKTOR,ÖĞRETMEN,AŞÇI,PİLOT,BERBER
HAYVAN:KEDİ,KÖPEK,ASLAN,FİL,TAVŞAN|EVCİL HAYVAN:KEDİ,KÖPEK,MUHABBET KUŞU,BALIK,HAMSTER|DENİZ CANLISI:YUNUS,AHTAPOT,BALİNA,YENGEÇ,DENİZYILDIZI
KUŞ:SERÇE,KARTAL,GÜVERCİN,PAPAĞAN,BAYKUŞ|BÖCEK:ARI,KARINCA,UĞUR BÖCEĞİ,KELEBEK,ÇEKİRGE|ÇİÇEK:GÜL,LALE,PAPATYA,MENEKŞE,ORKİDE
AĞAÇ:ÇINAR,MEŞE,ÇAM,SÖĞÜT,ZEYTİN|RENK:MAVİ,KIRMIZI,YEŞİL,MOR,TURUNCU|ŞEHİR:İZMİR,ANKARA,BURSA,TRABZON,ANTALYA
ÜLKE:İTALYA,JAPONYA,BREZİLYA,MISIR,KANADA|SPOR DALI:FUTBOL,VOLEYBOL,YÜZME,TENİS,KOŞU|TAKIM SPORU:FUTBOL,BASKETBOL,VOLEYBOL,HENTBOL
KIŞ SPORU:KAYAK,SNOWBOARD,BUZ PATENİ,KIZAK|MÜZİK ALETİ:GİTAR,PİYANO,DAVUL,KEMAN,BAĞLAMA|MÜZİK TÜRÜ:ROCK,CAZ,POP,RAP
DANS TÜRÜ:HALAY,TANGO,VALS,SALSA|FİLM TÜRÜ:KOMEDİ,KORKU,DRAM,ANİMASYON|İÇECEK:ÇAY,KAHVE,AYRAN,LİMONATA,SÜT
TATLI:BAKLAVA,SÜTLAÇ,KÜNEFE,LOKUM,HELVA|KAHVALTILIK:PEYNİR,ZEYTİN,BAL,REÇEL,YUMURTA|ÇORBA:MERCİMEK,EZOGELİN,DOMATES,TARHANA
HAMUR İŞİ:BÖREK,POĞAÇA,SİMİT,PİDE|TÜRK YEMEĞİ:MANTI,KEBAP,DOLMA,KÖFTE,LAHMACUN|SOKAK LEZZETİ:SİMİT,KOKOREÇ,MİDYE,KUMPİR
BAHARAT:KİMYON,NANE,PUL BİBER,TARÇIN|ATIŞTIRMALIK:CİPS,KRAKER,FINDIK,PATLAMIŞ MISIR|GİYSİ:KAZAK,GÖMLEK,ETEK,PANTOLON,MONT
AYAKKABI TÜRÜ:BOT,TERLİK,SANDALET,ÇİZME|AKSESUAR:ŞAPKA,KEMER,ATKI,GÖZLÜK|TAKI:YÜZÜK,KOLYE,KÜPE,BİLEZİK|KUMAŞ:PAMUK,İPEK,YÜN,KETEN
EV EŞYASI:LAMBA,HALI,PERDE,YASTIK|MOBİLYA:KOLTUK,MASA,DOLAP,SANDALYE|ELEKTRONİK ALET:TELEFON,TABLET,KULAKLIK,FIRIN
MUTFAK ALETİ:TENCERE,TAVA,RENDE,KEPÇE|EL ALETİ:ÇEKİÇ,TORNAVİDA,PENSE,TESTERE|OYUNCAK:BEBEK,TOP,UÇURTMA,LEGO
ÇOCUK OYUNU:SAKLAMBAÇ,SEKSEK,YAKAN TOP,KÖŞE KAPMACA|MASA OYUNU:SATRANÇ,TAVLA,OKEY,MONOPOLY|TAŞIT:OTOBÜS,TREN,BİSİKLET,VAPUR
VÜCUT PARÇASI:EL,KULAK,BURUN,DİZ|DUYGU:SEVİNÇ,KORKU,ÖFKE,ÖZLEM|HAVA OLAYI:YAĞMUR,KAR,DOLU,FIRTINA|DOĞA OLAYI:DEPREM,ÇIĞ,SEL,TSUNAMİ
MADEN:ALTIN,GÜMÜŞ,BAKIR,DEMİR|DEĞERLİ TAŞ:ELMAS,YAKUT,ZÜMRÜT,SAFİR|ŞEKİL:KARE,DAİRE,ÜÇGEN,YILDIZ|OKUL DERSİ:MATEMATİK,TARİH,MÜZİK,RESİM
OKULDA BULUNUR:TAHTA,SIRA,TEBEŞİR,ZİL|MUTFAKTA BULUNUR:BUZDOLABI,OCAK,TABAK,ÇATAL|BANYODA BULUNUR:HAVLU,SABUN,AYNA,DİŞ FIRÇASI
YATAK ODASINDA BULUNUR:YATAK,YASTIK,DOLAP,ABAJUR|BAHÇEDE BULUNUR:ÇİÇEK,HORTUM,ÇİM,SALINCAK|PLAJDA BULUNUR:ŞEMSİYE,HAVLU,KUM,KOVA
ÇANTADA BULUNUR:CÜZDAN,ANAHTAR,TELEFON,KALEM|HASTANEDE BULUNUR:DOKTOR,SEDYE,İLAÇ,ŞIRINGA|ORMANDA BULUNUR:AĞAÇ,MANTAR,SİNCAP,AYI
ÇİFTLİKTE BULUNUR:İNEK,TRAKTÖR,AHIR,TAVUK|UZAYDA BULUNUR:YILDIZ,GEZEGEN,UYDU,ASTRONOT|DENİZİN DİBİNDE:MERCAN,AHTAPOT,BATIK GEMİ,İSTRİDYE
KIRMIZI ŞEYLER:ÇİLEK,DOMATES,KİRAZ,İTFAİYE|SARI ŞEYLER:MUZ,LİMON,GÜNEŞ,CİVCİV|YEŞİL ŞEYLER:ÇİM,YAPRAK,KURBAĞA,SALATALIK
YUVARLAK ŞEYLER:TOP,PORTAKAL,TEKERLEK,SAAT|SİVRİ ŞEYLER:İĞNE,KALEM,BIÇAK,DİKEN|YUMUŞAK ŞEYLER:YASTIK,PAMUK,BATTANİYE,PELUŞ
SICAK ŞEYLER:ÇAY,SOBA,GÜNEŞ,ÇORBA|SOĞUK ŞEYLER:BUZ,DONDURMA,KAR,BUZDOLABI|UÇAN ŞEYLER:KUŞ,UÇAK,BALON,UÇURTMA
`;

const YAZI_TABLE: ReadonlyMap<string, readonly string[]> = new Map(
  YAZI_RAW.split(/[|\n]/u)
    .map((part) => part.trim())
    .filter((part) => part.includes(":"))
    .map((part) => {
      const [topic, rest] = part.split(":") as [string, string];
      return [topic, rest.split(",").map((s) => s.trim())] as const;
    }),
);

const YAZI_FALLBACK = ["TOP", "KUTU", "ÇANTA", "BALON", "KALEM", "ŞAPKA"];

/** Konuya uyan bir kelime (büyük harf, 24 karakteri aşmaz). Bilinmeyen konuda genel bir eşya. */
export function yaziWord(rng: Rng, topic: string | null): string {
  const list = topic ? YAZI_TABLE.get(upper(topic.trim())) : undefined;
  return pick(rng, list && list.length > 0 ? list : YAZI_FALLBACK);
}

export const YAZI_KNOWN: readonly string[] = [...YAZI_TABLE.keys()];

// ——— Kendim: konuya göre tek kelimelik cevaplar ———

const KENDIM_BY_KEY: readonly [string, readonly string[]][] = [
  ["hayvan sesi", ["Miyav", "Hav-hav", "Vızz", "Mööö"]],
  ["hayvan", ["Kedi", "Yunus", "Baykuş", "Panda", "Tilki", "Sincap"]],
  ["renk", ["Mavi", "Turuncu", "Mor", "Yeşil", "Sarı"]],
  ["meyve", ["Karpuz", "Çilek", "Muz", "Kiraz", "Nar"]],
  ["tatlı", ["Baklava", "Sütlaç", "Künefe", "Profiterol"]],
  ["içecek", ["Çay", "Limonata", "Ayran", "Kahve"]],
  ["yemek", ["Mantı", "Pizza", "Makarna", "Lahmacun", "Menemen"]],
  ["mevsim", ["Yaz", "Sonbahar", "İlkbahar", "Kış"]],
  ["hava", ["Güneşli", "Yağmurlu", "Rüzgarlı", "Sisli"]],
  ["şehir", ["İzmir", "Mardin", "Eskişehir", "Trabzon"]],
  ["ülke", ["İtalya", "Japonya", "Norveç", "Meksika"]],
  ["müzik aleti", ["Davul", "Gitar", "Keman", "Bağlama"]],
  ["müzik", ["Caz", "Rock", "Pop", "Türkü"]],
  ["film", ["Komedi", "Macera", "Animasyon", "Dram"]],
  ["spor", ["Yüzme", "Basketbol", "Yoga", "Koşu"]],
  ["çiçek", ["Papatya", "Lale", "Gül", "Ayçiçeği"]],
  ["ağaç", ["Çınar", "Meşe", "Söğüt", "Zeytin"]],
  ["kuş", ["Kartal", "Baykuş", "Papağan", "Serçe"]],
  ["deniz", ["Yunus", "Ahtapot", "Denizatı", "Balina"]],
  ["böcek", ["Kelebek", "Arı", "Sivrisinek"]],
  ["meslek", ["Aşçı", "Pilot", "Ressam", "Öğretmen"]],
  ["ders", ["Resim", "Müzik", "Beden", "Matematik"]],
  ["taşıt", ["Bisiklet", "Vapur", "Tren", "Balon"]],
  ["araba", ["Cabrio", "Minibüs", "Jip", "Klasik"]],
  ["oyuncak", ["Lego", "Uçurtma", "Topaç", "Yapboz"]],
  ["oyun", ["Saklambaç", "Tavla", "Satranç", "Okey"]],
  ["eşya", ["Lamba", "Yastık", "Şemsiye", "Kupa"]],
  ["mobilya", ["Koltuk", "Kitaplık", "Puf", "Salıncak"]],
  ["kıyafet", ["Kazak", "Pijama", "Hırka", "Tulum"]],
  ["ayakkabı", ["Terlik", "Patik", "Bot", "Sandalet"]],
  ["gezegen", ["Mars", "Satürn", "Jüpiter", "Venüs"]],
  ["sabah", ["Uykulu", "Sessiz", "Enerjik", "Yavaş"]],
  ["parti", ["Dansçı", "Seyirci", "Neşeli", "Sohbetçi"]],
  ["sınav", ["Gergin", "Hazırlıklı", "Sakin", "Telaşlı"]],
  ["kızınca", ["Sessiz", "Somurtkan", "Kırmızı", "Dalgın"]],
  ["mutlu", ["Kahkaha", "Şarkı", "Dans", "Gülümseme"]],
  ["fiil", ["Gülmek", "Koşmak", "Uyumak", "Düşünmek"]],
  ["yer", ["Kütüphane", "Sahil", "Mutfak", "Bahçe"]],
];

const KENDIM_FALLBACK = ["Neşeli", "Meraklı", "Sakin", "Uykucu", "Sabırlı", "Dalgın", "Konuşkan", "Pratik"];

/** Konuya uyan TEK kelime (oyun boşluklu yazıyı reddeder; 24 karakteri aşmaz). Anahtar kelime yoksa bir sıfat. */
export function kendimAnswer(rng: Rng, topic: string): string {
  const t = topic.toLocaleLowerCase("tr-TR");
  for (const [key, list] of KENDIM_BY_KEY) if (t.includes(key)) return pick(rng, list);
  return pick(rng, KENDIM_FALLBACK);
}

// ——— Laf Sokma: her soruya uyabilen kısa, aile dostu esprili cevaplar ———

export const LAF_ANSWERS: readonly string[] = [
  "Bir kutu mandalina",
  "Pijamayla toplantıya girmek",
  "Uzaktan kumandayı saklamak",
  "Annemin terliği",
  "Sabah alarmının sesi",
  "Bayatlamış simit",
  "Tek kalmış çorap",
  "Şarjı yüzde bir olan telefon",
  "Kayıp anahtarlar",
  "Dondurmayı tabakla yemek",
  "Yarın başlarım demek",
  "Komşunun papağanı",
  "Gereğinden fazla tuz",
  "Kimsenin okumadığı kullanım kılavuzu",
  "Islak kumda yürümek",
  "Akşam beşte çay keyfi",
  "Kendi kendine şarkı söylemek",
  "Bir tepsi baklava",
  "Hiç bitmeyen bulaşık",
  "Yanlış otobüse binmek",
  "Kapı çalınca saklanmak",
  "Buzdolabını yirminci kez açmak",
  "Gizli çikolata zulası",
  "Kuşlarla sohbet etmek",
  "Uykuda konuşmak",
  "Tavandaki örümcek",
  "Rüzgarda uçan şemsiye",
  "Yanlış kişiye el sallamak",
  "Bitmeyen grup mesajları",
  "Sonsuz reklam arası",
];

// ——— Bozuk Telefon: kısa cümleler ve çizim tahminleri ———

export const BOZUK_SENTENCES: readonly string[] = [
  "Kedi şapkayla bisiklete biniyor",
  "Penguen plajda dondurma yiyor",
  "Robot mutfakta kek yapıyor",
  "Fil balonla uçmaya çalışıyor",
  "Ayı ormanda gitar çalıyor",
  "Uzaylı otobüs bekliyor",
  "Tavşan havuçla resim yapıyor",
  "Balina denizde şarkı söylüyor",
  "Dede kaykayla parka gidiyor",
  "Kardan adam güneşte eriyor",
];

export const BOZUK_GUESSES: readonly string[] = [
  "Bir ev ve güneş",
  "Gülen bir yüz",
  "Bir yıldız parlıyor",
  "Büyük bir daire",
  "Çatısı olan bir kutu",
  "Gökyüzünde bir şey uçuyor",
  "Bir çiçek açıyor",
  "Kocaman bir top",
];

// ——— Genel tahmin sözcükleri (Karalama Defteri son şans, Sızma) ———

export const GUESS_WORDS: readonly string[] = [
  "ELMA",
  "KEDİ",
  "TOP",
  "EV",
  "GÜNEŞ",
  "ARABA",
  "ÇİÇEK",
  "KİTAP",
];
