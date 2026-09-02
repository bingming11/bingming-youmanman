/* 邮满满云仓报价 · 货币实时转换（基础币种 CNY）
 * 浏览器端拉取 @fawazahmed0/currency-api（jsDelivr CDN，免费免密钥、CORS 友好）；
 * 拉取失败（离线 / CDN 不可达）时回退到本地快照 assets/rates.fallback.json（由本文件内联 FALLBACK 兜底）。
 * API 返回 {date, cny:{usd:.., eur:..}}，即「1 CNY = ? 目标币种」。
 * 对外接口：FX.base / FX.list / FX.rate(code) / FX.sym(code) / FX.name(code,lang)
 *          FX.convert(nCny, code) / FX.ready() / FX.onReady(cb) / FX.refresh()
 */
window.FX = (function () {
  "use strict";
  var BASE = "CNY";

  // 币种元数据：符号 + 三语名称（展示用）
  var META = {
    CNY: { s: "¥", n: { zh: "人民币", en: "CNY", ko: "위안" } },
    USD: { s: "$", n: { zh: "美元", en: "US Dollar", ko: "미국 달러" } },
    EUR: { s: "€", n: { zh: "欧元", en: "Euro", ko: "유로" } },
    GBP: { s: "£", n: { zh: "英镑", en: "British Pound", ko: "영국 파운드" } },
    JPY: { s: "¥", n: { zh: "日元", en: "Japanese Yen", ko: "일본 엔" } },
    KRW: { s: "₩", n: { zh: "韩元", en: "Korean Won", ko: "한국 원" } },
    HKD: { s: "HK$", n: { zh: "港币", en: "HKD", ko: "홍콩 달러" } },
    AUD: { s: "A$", n: { zh: "澳元", en: "Australian Dollar", ko: "호주 달러" } },
    CAD: { s: "C$", n: { zh: "加元", en: "Canadian Dollar", ko: "캐나다 달러" } },
    SGD: { s: "S$", n: { zh: "新加坡元", en: "Singapore Dollar", ko: "싱가포르 달러" } },
    CHF: { s: "Fr", n: { zh: "瑞士法郎", en: "Swiss Franc", ko: "스위스 프랑" } },
    THB: { s: "฿", n: { zh: "泰铢", en: "Thai Baht", ko: "태국 바트" } },
    MYR: { s: "RM", n: { zh: "马来西亚令吉", en: "Malaysian Ringgit", ko: "말레이시아 링깃" } },
    NZD: { s: "NZ$", n: { zh: "新西兰元", en: "NZ Dollar", ko: "뉴질랜드 달러" } },
    RUB: { s: "₽", n: { zh: "卢布", en: "Russian Ruble", ko: "러시아 루블" } },
    INR: { s: "₹", n: { zh: "印度卢比", en: "Indian Rupee", ko: "인도 루피" } },
    BRL: { s: "R$", n: { zh: "巴西雷亚尔", en: "Brazilian Real", ko: "브라질 레알" } },
    ZAR: { s: "R", n: { zh: "南非兰特", en: "South African Rand", ko: "남아공 랜드" } },
    AED: { s: "د.إ", n: { zh: "阿联酋迪拉姆", en: "UAE Dirham", ko: "UAE 디르함" } },
    SAR: { s: "﷼", n: { zh: "沙特里亚尔", en: "Saudi Riyal", ko: "사우디 리얄" } },
    MXN: { s: "$", n: { zh: "墨西哥比索", en: "Mexican Peso", ko: "멕시코 페소" } },
    PHP: { s: "₱", n: { zh: "菲律宾比索", en: "Philippine Peso", ko: "필리핀 페소" } },
    IDR: { s: "Rp", n: { zh: "印尼盾", en: "Indonesian Rupiah", ko: "인도네시아 루피아" } },
    VND: { s: "₫", n: { zh: "越南盾", en: "Vietnamese Dong", ko: "베트남 동" } },
    PLN: { s: "zł", n: { zh: "波兰兹罗提", en: "Polish Zloty", ko: "폴란드 즈워티" } },
    TRY: { s: "₺", n: { zh: "土耳其里拉", en: "Turkish Lira", ko: "터키 리라" } },
    NOK: { s: "kr", n: { zh: "挪威克朗", en: "Norwegian Krone", ko: "노르웨이 크로네" } },
    SEK: { s: "kr", n: { zh: "瑞典克朗", en: "Swedish Krona", ko: "스웨덴 크로나" } },
    DKK: { s: "kr", n: { zh: "丹麦克朗", en: "Danish Krone", ko: "덴마크 크로네" } }
  };

  // 本地兜底汇率快照（1 CNY = ? 目标币），仅当 CDN 不可达时使用（近似值）
  var FALLBACK = {
    "date": "2026-09-02",
    "cny": {
      usd: 0.1395, eur: 0.1275, gbp: 0.1095, jpy: 20.8, krw: 190.5, hkd: 1.09,
      aud: 0.214, cad: 0.192, sgd: 0.187, chf: 0.122, thb: 4.7, myr: 0.62,
      nzd: 0.233, rub: 13.2, inr: 11.7, brl: 0.78, zar: 2.55, aed: 0.512,
      sar: 0.523, mxn: 2.62, php: 8.0, idr: 2280, vnd: 3580, pln: 0.555,
      try: 4.55, nok: 1.48, sek: 1.45, dkk: 0.95
    }
  };

  var rates = FALLBACK.cny;     // 当前生效汇率（默认兜底）
  var liveDate = FALLBACK.date;
  var ready = false;
  var cbs = [];

  function fire() { for (var i = 0; i < cbs.length; i++) { try { cbs[i](); } catch (e) {} } }
  function onReady(cb) { if (ready) { try { cb(); } catch (e) {} } else cbs.push(cb); }

  function applyLive(d) {
    if (d && d.cny && typeof d.cny === "object") {
      rates = d.cny;
      if (d.date) liveDate = d.date;
      ready = true;
      fire();
      return true;
    }
    return false;
  }

  function fetchRates() {
    // 用兜底先占位，再尝试实时拉取覆盖
    rates = FALLBACK.cny;
    var url = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cny.min.json";
    var settled = false;
    var timer = setTimeout(function () { settled = true; }, 6500); // 超时则保持兜底
    if (typeof fetch !== "function") { ready = true; fire(); return; }
    fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (d) {
        if (settled) return;
        clearTimeout(timer);
        if (applyLive(d)) { /* ok */ }
        else { ready = true; fire(); }
      })
      .catch(function () { /* 保持兜底汇率 */ ready = true; fire(); });
  }

  // 对外接口
  return {
    base: BASE,
    list: Object.keys(META),
    meta: META,
    liveDate: function () { return liveDate; },
    rate: function (code) {
      if (code === BASE) return 1;
      var c = String(code).toLowerCase();
      if (rates[c] != null) return rates[c];
      return FALLBACK.cny[c] != null ? FALLBACK.cny[c] : 1;
    },
    sym: function (code) { return (META[code] && META[code].s) || ""; },
    name: function (code, lang) {
      lang = lang || "zh";
      var m = META[code];
      if (m && m.n && m.n[lang]) return m.n[lang];
      return code;
    },
    convert: function (nCny, code) {
      var n = Number(nCny);
      if (isNaN(n)) return n;
      return n * this.rate(code);
    },
    ready: function () { return ready; },
    onReady: onReady,
    refresh: fetchRates
  };
})();

// 立即触发拉取（静态站点无后端，纯浏览器端）
(function () { try { window.FX.refresh(); } catch (e) {} })();
