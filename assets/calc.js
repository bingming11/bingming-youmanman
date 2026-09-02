/* 邮满满云仓报价查询中心 —— 运费试算器
 * 直接读取 window.YUNMANMAN_DATA（与报价表同源，新增/替换文件后自动同步）。
 * 支持两种线路报价格式：
 *   A. 云途系列： 国家/地区 | 重量(KG)分段 | 最低计费重(KG) | 运费(RMB/KG) | 挂号费(RMB/票)
 *   B. 欧洲/美国系列：国家 | 重量段（kg） | 运费（RMB/KG） | 挂号费/处理费（RMB/票）
 * 体积重 = 长×宽×高 ÷ 6000；计费重 = max(实重, 体积重) 并取最低计费重封底。
 */
(function () {
  "use strict";

  var DATA = window.YUNMANMAN_DATA || { sheets: [] };

  // ---------- 语言 / 货币（与 app.js 同源） ----------
  var LANG = (window.I18N_LANG || "zh");
  if (LANG !== "zh" && LANG !== "en" && LANG !== "ko") LANG = "zh";
  function T(k) {
    var z = (window.I18N && window.I18N.zh) || {};
    var d = (window.I18N && window.I18N[LANG]) || {};
    var v = d[k];
    if (v == null) v = z[k];
    return v == null ? k : v;
  }
  function getCur() {
    try { var v = localStorage.getItem("ym_cur"); if (v) return v; } catch (e) {}
    return "CNY";
  }
  // 把 RMB 数值换算为当前币种并显示（CNY 直接显示 ¥）
  function money(nCny) {
    var code = getCur();
    var val = (code === "CNY") ? nCny : (window.FX ? window.FX.convert(nCny, code) : nCny);
    var sym = (code === "CNY") ? "¥" : (window.FX ? window.FX.sym(code) : "");
    return (sym ? sym + " " : "") + fmt(val);
  }

  // ---------- 工具 ----------
  function toNum(v) {
    if (v == null || v === "") return null;
    var s = String(v).replace(/[, ¥$₽\s]/g, "");
    if (s === "" || isNaN(Number(s))) return null;
    return Number(s);
  }
  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    if (Number.isInteger(n)) return n.toLocaleString("zh-CN");
    return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function findCol(headers, kws) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i] || "";
      for (var j = 0; j < kws.length; j++) if (h.indexOf(kws[j]) >= 0) return i;
    }
    return -1;
  }
  // 解析重量段字符串为 {lo, hi}，如 "0＜W≤0.1" / "0.05-0.3" / "0-0.1" / "1.001-2"
  function parseTier(str) {
    if (!str) return null;
    var nums = String(str).match(/[0-9]*\.?[0-9]+/g);
    if (!nums || nums.length === 0) return null;
    var arr = nums.map(Number);
    var lo = arr[0];
    var hi = arr.length > 1 ? arr[arr.length - 1] : arr[0];
    if (lo > hi) { var t = lo; lo = hi; hi = t; }
    return { lo: lo, hi: hi };
  }

  // ---------- 构建各渠道的费率表 ----------
  var CHANNELS = []; // {name, dests: {dest: [tier,...]}}
  (function build() {
    DATA.sheets.forEach(function (s) {
      if (s.category !== "线路报价" || s.type !== "table") return;
      var H = s.headers || [];
      var destCol = 0;
      var tierCol = findCol(H, ["重量(KG)", "重量段"]);
      var rateCol = findCol(H, ["运费"]);
      if (tierCol < 0 || rateCol < 0) return; // 非标准费率表，跳过
      var feeCol = findCol(H, ["挂号费", "处理费"]);
      var minCol = findCol(H, ["最低计费重"]);
      var timeCol = findCol(H, ["时效", "工作日"]);
      var dests = {};
      var order = [];
      var lastDest = "";
      var lastTime = "";
      (s.rows || []).forEach(function (r) {
        var d = (r[destCol] != null && String(r[destCol]).trim() !== "") ? String(r[destCol]).trim() : lastDest;
        if (d === "") return;
        lastDest = d;
        var tier = parseTier(r[tierCol]);
        if (!tier) return;
        var rate = toNum(r[rateCol]);
        if (rate == null) return;
        var fee = feeCol >= 0 ? toNum(r[feeCol]) : null;
        var min = minCol >= 0 ? toNum(r[minCol]) : null;
        var time = (timeCol >= 0 && r[timeCol] != null && String(r[timeCol]).trim() !== "") ? String(r[timeCol]).trim() : lastTime;
        lastTime = time;
        if (order.indexOf(d) < 0) { order.push(d); dests[d] = []; }
        dests[d].push({ lo: tier.lo, hi: tier.hi, rate: rate, fee: fee, min: min, time: time });
      });
      if (order.length === 0) return;
      // 每个目的地的费率档按上限升序
      order.forEach(function (d) { dests[d].sort(function (a, b) { return a.hi - b.hi; }); });
      CHANNELS.push({ name: s.name, dests: dests, order: order });
    });
  })();

  // 在费率档中定位计费重所属档
  function matchTier(tiers, w) {
    for (var i = 0; i < tiers.length; i++) {
      if (w <= tiers[i].hi) return { tier: tiers[i], capped: false };
    }
    return { tier: tiers[tiers.length - 1], capped: true }; // 超出台阶，按最高档估算
  }

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var modal = $("calc-modal");
  var btn = $("btn-calc");
  var selCh = $("calc-channel");
  var selD = $("calc-dest");
  var inW = $("calc-w");
  var inL = $("calc-l");
  var inWi = $("calc-wi");
  var inH = $("calc-h");
  var resBox = $("calc-result");

  function openModal() {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("calc-lock");
    if (selCh.options.length) compute();
    setTimeout(function () { inW.focus(); }, 60);
  }
  function closeModal() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("calc-lock");
  }

  function fillChannels() {
    selCh.innerHTML = "";
    if (!CHANNELS.length) {
      var o = document.createElement("option");
      o.textContent = T("calc.noRoute");
      selCh.appendChild(o);
      selCh.disabled = true;
      btn.disabled = true;
      btn.title = "数据源中暂无线路报价表";
      return;
    }
    CHANNELS.forEach(function (c, i) {
      var o = document.createElement("option");
      o.value = i; o.textContent = c.name;
      selCh.appendChild(o);
    });
    fillDests();
  }
  function fillDests() {
    selD.innerHTML = "";
    var c = CHANNELS[+selCh.value];
    if (!c) return;
    c.order.forEach(function (d) {
      var o = document.createElement("option");
      o.value = d; o.textContent = d;
      selD.appendChild(o);
    });
  }

  function compute() {
    if (!CHANNELS.length) { resBox.classList.add("hidden"); return; }
    var c = CHANNELS[+selCh.value];
    var dest = selD.value;
    var tiers = c && c.dests[dest];
    if (!tiers || !tiers.length) { resBox.classList.add("hidden"); return; }

    var weight = toNum(inW.value);
    if (weight == null || weight <= 0) {
      resBox.classList.remove("hidden");
      resBox.className = "calc-result calc-hint";
      resBox.innerHTML = T("calc.hint");
      return;
    }
    var L = toNum(inL.value), W = toNum(inWi.value), Hh = toNum(inH.value);
    var volW = (L && W && Hh) ? (L * W * Hh) / 6000 : 0;
    var chargeW = Math.max(weight, volW);
    var m = matchTier(tiers, chargeW);
    var tier = m.tier;
    var minW = (tier.min != null) ? Math.max(chargeW, tier.min) : chargeW;
    var billableW = Math.max(chargeW, minW);
    var shipFee = (billableW * tier.rate);
    var regFee = (tier.fee != null) ? tier.fee : 0;
    var total = shipFee + regFee;

    var rows = "";
    rows += row(T("calc.realW"), fmt(weight) + " KG");
    if (volW > 0) rows += row(T("calc.volW"), fmt(volW) + " KG <span class='sub'>(L×W×H÷6000)</span>");
    rows += row(T("calc.chargeW"), fmt(billableW) + " KG" + (tier.min != null && chargeW < tier.min ? " <span class='sub'>" + T("calc.minfloor") + "</span>" : ""));
    rows += row(T("calc.tier"), esc(tier.lo) + " ~ " + esc(tier.hi) + " KG" + (m.capped ? " <span class='warn'>" + T("calc.capped") + "</span>" : ""));
    rows += row(T("calc.rate"), money(tier.rate) + " /KG");
    if (regFee > 0) rows += row(feeLabel(c.name), money(regFee));
    if (tier.time) rows += row(T("calc.time"), esc(tier.time));
    resBox.className = "calc-result calc-ok";
    resBox.innerHTML =
      "<div class='calc-total'><span>" + T("calc.total") + "</span><b>" + money(total) + "</b></div>" +
      "<div class='calc-break'>" + rows + "</div>";
  }
  function row(k, v) {
    return "<div class='calc-r'><span class='k'>" + k + "</span><span class='v'>" + v + "</span></div>";
  }
  function feeLabel(name) {
    var isProc = (name && name.indexOf("美国") >= 0 && (name.indexOf("商派") >= 0 || name.indexOf("标准") >= 0));
    return T(isProc ? "calc.procfee" : "calc.regfee");
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // ---------- 事件 ----------
  if (btn) {
    btn.addEventListener("click", openModal);
    $("calc-x").addEventListener("click", closeModal);
    $("calc-backdrop").addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });
    selCh.addEventListener("change", function () { fillDests(); compute(); });
    selD.addEventListener("change", compute);
    [inW, inL, inWi, inH].forEach(function (inp) { inp.addEventListener("input", compute); });
    $("calc-go").addEventListener("click", compute);
    fillChannels();
    // 货币 / 语言 切换时，若弹窗已打开则重算（金额随币种实时换算）
    window.addEventListener("ym:currencychange", function () {
      if (!modal.classList.contains("hidden")) compute();
    });
    window.addEventListener("ym:langchange", function () {
      LANG = window.I18N_LANG || "zh";
      if (!modal.classList.contains("hidden")) compute();
    });
  }
})();
