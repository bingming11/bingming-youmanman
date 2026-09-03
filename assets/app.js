/* 邮满满云仓报价展示网站 —— 前端逻辑（含三语 i18n + 货币实时换算）
 * 数据来自 window.YUNMANMAN_DATA (data/data.js) 与 window.YUNMANMAN_STATUS (data/status.js)。
 * 兼容 file:// 直接打开（数据以 <script> 全局变量注入，无需 fetch）。
 */
(function () {
  "use strict";

  var DATA = window.YUNMANMAN_DATA || { version: 0, sheets: [], sheetCount: 0, totalRows: 0, updatedAt: "" };
  var STATUS = window.YUNMANMAN_STATUS || { ok: true, version: DATA.version, updatedAt: DATA.updatedAt };

  // ===================== 三语 i18n =====================
  var LANG = (function () {
    try { var v = localStorage.getItem("ym_lang"); if (v) return v; } catch (e) {}
    return "zh";
  })();
  if (LANG !== "zh" && LANG !== "en" && LANG !== "ko") LANG = "zh";

  function T(k) {
    var z = (window.I18N && window.I18N.zh) || {};
    var d = (window.I18N && window.I18N[LANG]) || {};
    var v = d[k];
    if (v == null) v = z[k];
    return v == null ? k : v;
  }
  function applyStaticI18n() {
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var eln = nodes[i], key = eln.getAttribute("data-i18n");
      var txt = T(key), mode = eln.getAttribute("data-i18n-mode");
      if (mode === "placeholder") eln.setAttribute("placeholder", txt);
      else if (mode === "title") eln.setAttribute("title", txt);
      else if (mode === "html") eln.innerHTML = txt;
      else eln.textContent = txt;
    }
    document.title = T("site.title");
    document.documentElement.lang = (LANG === "zh" ? "zh-CN" : LANG);
    document.body.setAttribute("data-lang", LANG);
  }
  function setLang(lang) {
    if (lang !== "zh" && lang !== "en" && lang !== "ko") lang = "zh";
    LANG = lang;
    try { localStorage.setItem("ym_lang", lang); } catch (e) {}
    applyStaticI18n();
    var lb = document.getElementById("langbar");
    if (lb) {
      var bs = lb.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle("active", bs[i].getAttribute("data-lang") === lang);
    }
    renderHero(); renderTabs(); renderPills(); renderSheet();
    try { window.dispatchEvent(new CustomEvent("ym:langchange")); } catch (e) {}
  }

  // ===================== 货币 =====================
  var CUR = (function () {
    try { var v = localStorage.getItem("ym_cur"); if (v) return v; } catch (e) {}
    return "CNY";
  })();
  function money(nCny, code) {
    code = code || CUR;
    var val = (code === "CNY") ? nCny : (window.FX ? window.FX.convert(nCny, code) : nCny);
    var sym = (code === "CNY") ? "¥" : (window.FX ? window.FX.sym(code) : "");
    return (sym ? sym + " " : "") + fmtNum(val);
  }
  function setCurrency(code) {
    CUR = code;
    try { localStorage.setItem("ym_cur", code); } catch (e) {}
    updateCurChip();
    renderSheet();
    try { window.dispatchEvent(new CustomEvent("ym:currencychange")); } catch (e) {}
  }
  function updateCurChip() {
    var c = document.getElementById("cur-chip");
    if (!c) return;
    c.textContent = (CUR === "CNY") ? "CNY ¥" : ((window.FX ? window.FX.sym(CUR) : "") + " " + CUR);
  }

  // ===================== 国家名 / 备注列 =====================
  var COUNTRY_COLS = ["国家/地区", "国家"];
  function isCountryCol(h) { return COUNTRY_COLS.indexOf(h) >= 0; }
  function countryText(v) {
    if (window.COUNTRY_MAP && window.COUNTRY_MAP[v] && window.COUNTRY_MAP[v][LANG]) return window.COUNTRY_MAP[v][LANG];
    return v;
  }
  var NOTE_KW = ["备注", "说明", "内容", "品目", "类目"];
  function isNoteHeader(h) {
    if (!h) return false;
    for (var i = 0; i < NOTE_KW.length; i++) if (h.indexOf(NOTE_KW[i]) >= 0) return true;
    return false;
  }

  // ===================== 现有工具 =====================
  var CURRENCY_KW = ["RMB", "元", "价格", "运费", "挂号", "服务费", "附加费",
    "处理费", "单价", "金额", "成本", "保价"];
  var WEIGHT_KW = ["KG", "kg", "重量", "计费重", "克", "g/"];
  var CAT_ORDER = ["线路报价", "云仓服务", "参考规则"];

  var state = {
    cat: "全部", sheet: null, q: "", filters: {}, sort: null
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function isCurrencyHeader(h) {
    if (!h) return false;
    for (var i = 0; i < CURRENCY_KW.length; i++) if (h.indexOf(CURRENCY_KW[i]) >= 0) return true;
    if (h.indexOf("费") >= 0) {
      for (var k = 0; k < WEIGHT_KW.length; k++) if (h.indexOf(WEIGHT_KW[k]) >= 0) return false;
      var LABEL_KW = ["项目", "依据", "类别", "类型", "品类", "标准", "说明", "备注", "清单", "范围", "名称"];
      for (var l = 0; l < LABEL_KW.length; l++) if (h.indexOf(LABEL_KW[l]) >= 0) return false;
      return true;
    }
    return false;
  }
  function toNum(v) {
    if (v == null || v === "") return null;
    var s = String(v).replace(/[, ¥$₽\s]/g, "");
    if (s === "" || isNaN(Number(s))) return null;
    return Number(s);
  }
  function fmtNum(n) {
    if (Number.isInteger(n)) return n.toLocaleString("zh-CN");
    return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function categories() {
    var present = {};
    DATA.sheets.forEach(function (s) { present[s.category] = true; });
    var cats = ["全部"];
    CAT_ORDER.forEach(function (c) { if (present[c]) cats.push(c); });
    DATA.sheets.forEach(function (s) { if (cats.indexOf(s.category) < 0) cats.push(s.category); });
    return cats;
  }
  function sheetsInCat(cat) {
    return DATA.sheets.filter(function (s) { return cat === "全部" || s.category === cat; });
  }

  // ===================== HERO =====================
  function renderHero() {
    var counts = { "线路报价": 0, "云仓服务": 0, "参考规则": 0 };
    DATA.sheets.forEach(function (s) { if (counts[s.category] != null) counts[s.category]++; });
    $("#st-route").textContent = counts["线路报价"];
    $("#st-ware").textContent = counts["云仓服务"];
    $("#st-ref").textContent = counts["参考规则"];
    $("#st-rows").textContent = DATA.totalRows != null ? DATA.totalRows.toLocaleString("zh-CN") : "—";
    $("#ver-v").textContent = "v" + (STATUS.version || DATA.version || 0);
    $("#ver-d").textContent = STATUS.updatedAt || DATA.updatedAt || "—";
    $("#ver-d2").textContent = STATUS.updatedAt || DATA.updatedAt || "—";

    var b = $("#banner");
    b.innerHTML = "";
    if (STATUS.ok === false) {
      b.className = "banner err";
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
        '<div><b>' + esc(T("banner.err")) + '</b> ' + esc(STATUS.error || "") +
        (STATUS.fallbackVersion ? "（" + T("tag.rows") + " v" + STATUS.fallbackVersion + "）" : "") +
        '。</div>';
    } else if (STATUS.errors && STATUS.errors.length) {
      b.className = "banner warn";
      var names = STATUS.errors.map(function (e) { return e.file + (e.sheet ? " › " + e.sheet : ""); }).join("、");
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
        '<div><b>' + esc(T("banner.warn")) + '</b>' + esc(names) + '。</div>';
    } else {
      b.className = "banner hidden";
    }
    updateCurChip();
  }

  // ===================== TABS =====================
  function renderTabs() {
    var row = $("#tabrow");
    row.innerHTML = "";
    categories().forEach(function (cat) {
      var n = sheetsInCat(cat).length;
      var t = el("button", "tab", T("cat." + cat));
      t.setAttribute("role", "tab");
      t.setAttribute("aria-selected", cat === state.cat ? "true" : "false");
      if (n) { t.classList.add("has-hits"); var h = el("span", "hits", n); t.appendChild(h); }
      t.addEventListener("click", function () {
        state.cat = cat;
        var list = sheetsInCat(cat);
        state.sheet = list.length ? list[0].name : null;
        state.filters = {}; state.sort = null;
        renderTabs(); renderPills(); renderSheet();
      });
      row.appendChild(t);
    });
  }

  // ===================== SHEET PILLS =====================
  function renderPills() {
    var box = $("#pills");
    box.innerHTML = "";
    var list = sheetsInCat(state.cat);
    if (list.length <= 1) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    list.forEach(function (s) {
      var p = el("button", "pill");
      p.setAttribute("aria-pressed", s.name === state.sheet ? "true" : "false");
      p.appendChild(el("span", null, s.name));
      var c = el("span", "cnt", (s.type === "table" ? s.rowCount : (s.blocks ? s.blocks.length : 0)));
      p.appendChild(c);
      p.addEventListener("click", function () {
        state.sheet = s.name; state.filters = {}; state.sort = null;
        renderPills(); renderSheet();
      });
      box.appendChild(p);
    });
  }

  // ===================== 当前表 =====================
  function activeSheet() {
    return DATA.sheets.filter(function (s) { return s.name === state.sheet; })[0] || null;
  }
  function colRole(sheet, ci) {
    var h = sheet.headers[ci];
    if (isCurrencyHeader(h)) return "cur";
    var num = 0, tot = 0;
    sheet.rows.forEach(function (r) {
      var v = r[ci];
      if (v == null || v === "") return;
      tot++;
      if (toNum(v) != null) num++;
    });
    if (tot > 0 && num / tot >= 0.6) return "num";
    return "text";
  }
  function filterableCols(sheet) {
    var out = [];
    sheet.headers.forEach(function (h, ci) {
      if (isCurrencyHeader(h)) return;
      var set = {};
      sheet.rows.forEach(function (r) { var v = (r[ci] || "").trim(); if (v) set[v] = 1; });
      var vals = Object.keys(set);
      if (vals.length >= 2 && vals.length <= 40) {
        var hasText = vals.some(function (v) { return toNum(v) == null; });
        if (hasText) out.push({ ci: ci, header: h, vals: vals });
      }
    });
    return out;
  }

  // ===================== 跨渠道公共说明检测 =====================
  // 遍历所有“线路报价”表格，若某段说明文字在每个渠道表格中都完全相同，
  // 则把它提取为“渠道说明”，不再在每个表格里重复渲染。
  function normalizeNoteText(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }
  function getNoteRows(sheet) {
    var noteCis = [];
    sheet.headers.forEach(function (h, ci) { if (isNoteHeader(h)) noteCis.push(ci); });
    var out = [];
    sheet.rows.forEach(function (r, ri) {
      var maxNoteLen = 0, nonNoteLen = 0;
      sheet.headers.forEach(function (h, ci) {
        var t = String(r[ci] || "");
        if (noteCis.indexOf(ci) >= 0) { if (t.length > maxNoteLen) maxNoteLen = t.length; }
        else if (t.trim() !== "") nonNoteLen += t.length;
      });
      var gMax = 0, gCi = -1, gOthers = 0, gNonEmpty = 0, gPrice = false;
      sheet.headers.forEach(function (h, ci) {
        var t = String(r[ci] || "").trim();
        if (!t) return;
        gNonEmpty++;
        var role = colRole(sheet, ci);
        if (role === "cur" && t !== "/") gPrice = true;
        if (t.length > gMax) { gMax = t.length; gCi = ci; }
        else gOthers += t.length;
      });
      var noteCi = -1;
      if (maxNoteLen > 60 && nonNoteLen <= 80) {
        noteCis.forEach(function (ci) {
          if (noteCi < 0 || String(r[ci] || "").length > String(r[noteCi] || "").length) noteCi = ci;
        });
      }
      if (noteCi < 0 && !gPrice && gMax > 60 && gOthers <= 100 && gNonEmpty <= 3) noteCi = gCi;
      if (noteCi >= 0) out.push({ row: ri, ci: noteCi, text: String(r[noteCi] || "").trim() });
    });
    return out;
  }
  function computeCommonChannelNotices() {
    var routeSheets = DATA.sheets.filter(function (s) { return s.type === "table" && s.category === "线路报价"; });
    if (!routeSheets.length) return [];
    var maps = routeSheets.map(function (s) {
      var map = {};
      getNoteRows(s).forEach(function (n) { map[normalizeNoteText(n.text)] = n.text; });
      return map;
    });
    var common = [];
    for (var key in maps[0]) {
      var allHave = maps.every(function (m) { return m[key]; });
      if (allHave) common.push(maps[0][key]);
    }
    return common;
  }
  var COMMON_CHANNEL_NOTICES = computeCommonChannelNotices();
  var COMMON_CHANNEL_NOTICE_SET = {};
  COMMON_CHANNEL_NOTICES.forEach(function (t) { COMMON_CHANNEL_NOTICE_SET[normalizeNoteText(t)] = true; });

  // ===================== 过滤 + 排序 =====================
  function visibleRows(sheet) {
    var q = state.q.trim().toLowerCase();
    var rows = sheet.rows.filter(function (r) {
      if (q) {
        var hit = false;
        for (var i = 0; i < r.length; i++) {
          if (r[i] != null && String(r[i]).toLowerCase().indexOf(q) >= 0) { hit = true; break; }
        }
        if (!hit) return false;
      }
      for (var k in state.filters) {
        if (state.filters[k] && (r[k] || "").trim() !== state.filters[k]) return false;
      }
      return true;
    });
    if (state.sort) {
      var col = state.sort.col, dir = state.sort.dir === "asc" ? 1 : -1;
      var role = colRole(sheet, col);
      rows = rows.slice().sort(function (a, b) {
        var av = a[col], bv = b[col];
        if (role === "cur" || role === "num") {
          var na = toNum(av), nb = toNum(bv);
          if (na == null && nb == null) return 0;
          if (na == null) return 1; if (nb == null) return -1;
          return (na - nb) * dir;
        }
        return String(av == null ? "" : av).localeCompare(String(bv == null ? "" : bv), "zh") * dir;
      });
    }
    return rows;
  }

  function highlight(text) {
    text = String(text == null ? "" : text);
    var q = state.q.trim();
    if (!q) return esc(text);
    var lower = text.toLowerCase(), qi = lower.indexOf(q.toLowerCase());
    if (qi < 0) return esc(text);
    return esc(text.slice(0, qi)) + "<mark>" + esc(text.slice(qi, qi + q.length)) + "</mark>" + esc(text.slice(qi + q.length));
  }

  // ===================== 渲染表格 =====================
  function renderTable(sheet) {
    var wrap = el("div", "card");
    var head = el("div", "sec-head");
    head.appendChild(el("h2", null, sheet.name));
    var meta = el("div", "meta");
    if (sheet.meta && sheet.meta.productCode) meta.appendChild(el("span", "tag a", T("tag.product") + " " + sheet.meta.productCode));
    if (sheet.meta && sheet.meta.effectiveDate) meta.appendChild(el("span", "tag", T("tag.effective") + " " + sheet.meta.effectiveDate));
    meta.appendChild(el("span", "tag g", (sheet.rowCount || 0) + " " + T("tag.rows")));
    if (sheet.source === "lexiang") meta.appendChild(el("span", "tag b", sheet.sourceKind === "excel" ? T("tag.lexiangExcel") : T("tag.lexiangDoc")));
    if (sheet.sourceFile) meta.appendChild(el("span", "tag", T("tag.source") + " " + sheet.sourceFile));
    head.appendChild(meta);
    // 存在跨渠道公共说明时，在头部显示切换按钮
    if (COMMON_CHANNEL_NOTICES.length && sheet.category === "线路报价") {
      var cnBtn = el("button", "channel-notice-toggle", T("btn.channelNotice"));
      cnBtn.type = "button";
      cnBtn.setAttribute("aria-expanded", "false");
      cnBtn.addEventListener("click", function () {
        var box = document.getElementById("channel-notice");
        if (!box) return;
        var hidden = box.classList.toggle("hidden");
        cnBtn.setAttribute("aria-expanded", String(!hidden));
        cnBtn.textContent = hidden ? T("btn.channelNotice") : T("sheet.collapse");
      });
      head.appendChild(cnBtn);
    }
    wrap.appendChild(head);

    var fcols = filterableCols(sheet);
    if (fcols.length) {
      var filt = el("div", "filt");
      fcols.forEach(function (f) {
        var shortH = f.header.replace(/\s*\(.*\)/, "");
        var lab = el("label", null, shortH);
        var sel = el("select");
        sel.appendChild(new Option(T("cat.all") === "全部" ? "全部 · " + shortH : "All · " + shortH, ""));
        f.vals.slice().sort(function (a, b) { return a.localeCompare(b, "zh"); }).forEach(function (v) {
          sel.appendChild(new Option(v, v));
        });
        if (state.filters[f.ci]) sel.value = state.filters[f.ci];
        sel.addEventListener("change", function () {
          if (sel.value) state.filters[f.ci] = sel.value; else delete state.filters[f.ci];
          renderSheet();
        });
        filt.appendChild(lab); filt.appendChild(sel);
      });
      wrap.appendChild(filt);
    }

    var rows = visibleRows(sheet);
    // 若存在跨渠道公共说明，把它们从当前表格中移除，统一在上方“渠道说明”区域展示
    if (COMMON_CHANNEL_NOTICES.length && sheet.category === "线路报价") {
      rows = rows.filter(function (r) {
        return !getNoteRows({ headers: sheet.headers, rows: [r] }).some(function (n) {
          return COMMON_CHANNEL_NOTICE_SET[normalizeNoteText(n.text)];
        });
      });
    }
    if (!rows.length) {
      wrap.appendChild(el("div", "empty", T("empty.nomatch").replace("…", state.q ? "「" + state.q + "」" : "…")));
      return wrap;
    }

    var tw = el("div", "tw");
    var table = el("table");
    var thead = el("thead");
    var trh = el("tr");
    sheet.headers.forEach(function (h, ci) {
      var th = el("th", null, h || "—");
      var role = colRole(sheet, ci);
      if (role !== "text") th.classList.add("num");
      var ar = "";
      if (state.sort && state.sort.col === ci) ar = state.sort.dir === "asc" ? "▲" : "▼";
      var hint = (role === "cur" && CUR !== "CNY") ? ' <span class="conv">≈' + CUR + "</span>" : "";
      th.innerHTML = esc(h || "—") + hint + '<span class="ar">' + ar + "</span>";
      th.addEventListener("click", function () {
        if (state.sort && state.sort.col === ci) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else state.sort = { col: ci, dir: "asc" };
        renderSheet();
      });
      trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);

    var noteCis = [];
    sheet.headers.forEach(function (h, ci) { if (isNoteHeader(h)) noteCis.push(ci); });
    var tb = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      var maxNoteLen = 0, nonNoteLen = 0;
      sheet.headers.forEach(function (h, ci) {
        var t = String(r[ci] || "");
        if (noteCis.indexOf(ci) >= 0) { if (t.length > maxNoteLen) maxNoteLen = t.length; }
        else if (t.trim() !== "") nonNoteLen += t.length;
      });
      // 通用说明行轨道：某单元格超长、其余列基本为空且无价格（覆盖"渠道使用说明"类政策段）
      var gMax = 0, gCi = -1, gOthers = 0, gNonEmpty = 0, gPrice = false;
      sheet.headers.forEach(function (h, ci) {
        var t = String(r[ci] || "").trim();
        if (!t) return;
        gNonEmpty++;
        var role = colRole(sheet, ci);
        if (role === "cur" && t !== "/") gPrice = true;
        if (t.length > gMax) { gMax = t.length; gCi = ci; }
        else gOthers += t.length;
      });
      var noteCi = -1;
      if (maxNoteLen > 60 && nonNoteLen <= 80) {
        noteCis.forEach(function (ci) {
          if (noteCi < 0 || String(r[ci] || "").length > String(r[noteCi] || "").length) noteCi = ci;
        });
      }
      if (noteCi < 0 && !gPrice && gMax > 60 && gOthers <= 100 && gNonEmpty <= 3) noteCi = gCi;
      var isNoteRow = noteCi >= 0;
      sheet.headers.forEach(function (h, ci) {
        var role = colRole(sheet, ci);
        var v = r[ci];
        var td = el("td");
        if (role === "cur") {
          td.className = "cur";
          var n = toNum(v);
          td.innerHTML = n != null ? money(n) : highlight(v);
        } else if (role === "num") {
          td.className = "num";
          var nn = toNum(v);
          td.innerHTML = nn != null ? fmtNum(nn) : highlight(v);
        } else {
          var disp = isCountryCol(h) ? countryText(v) : v;
          if (ci === noteCi) {
            td.className = "td-note";
            var nb = el("div", "note-body");
            nb.innerHTML = highlight(disp);
            var bar = el("div", "note-collbar");
            var nbtn = el("button", "note-collbar-btn");
            nbtn.type = "button";
            bar.appendChild(nbtn);
            td.appendChild(nb);
            td.appendChild(bar);
          } else {
            td.innerHTML = highlight(disp);
          }
        }
        tr.appendChild(td);
      });
      if (isNoteRow) tr.classList.add("note-row");
      tb.appendChild(tr);
    });
    table.appendChild(tb); tw.appendChild(table); wrap.appendChild(tw);

    if (rows.length !== sheet.rowCount) {
      wrap.appendChild(el("div", "empty", T("note.filtered").replace("{a}", rows.length).replace("{b}", sheet.rowCount)));
    }
    return wrap;
  }

  // ===================== 渲染文本 =====================
  function renderText(sheet) {
    var wrap = el("div", "card");
    wrap.setAttribute("data-sheet-type", "text");
    var head = el("div", "sec-head");
    head.appendChild(el("h2", null, sheet.name));
    var meta = el("div", "meta");
    if (sheet.source === "lexiang") meta.appendChild(el("span", "tag b", sheet.sourceKind === "excel" ? T("tag.lexiangExcel") : T("tag.lexiangDoc")));
    if (sheet.sourceFile) meta.appendChild(el("span", "tag", T("tag.source") + " " + sheet.sourceFile));
    head.appendChild(meta);
    wrap.appendChild(head);
    var body = el("div", "sheet-body");
    body.setAttribute("data-k", "text");
    (sheet.blocks || []).forEach(function (blk) {
      var p = el("p", "plain", blk);
      body.appendChild(p);
    });
    wrap.appendChild(body);
    return wrap;
  }

  // ===================== 说明区：铺满 + 收起/展开 =====================
  // 超过阈值高度的长说明自动折叠，点击按钮在「铺满全部内容」与「仅留按钮条」之间切换。
  var COLLAPSE_MAX = 320; // px，内容超出则初始折叠
  function wireCollapsibles() {
    var cards = document.querySelectorAll("#sheet-area .card[data-sheet-type='text']");
    cards.forEach(function (card) {
      if (card.getAttribute("data-collapse-wired")) return;
      card.setAttribute("data-collapse-wired", "1");
      var body = card.querySelector(".sheet-body");
      if (!body) return;
      var bar = el("div", "collbar");
      var btn = el("button", "collbar-btn");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "true");
      bar.appendChild(btn);
      card.appendChild(bar);

      function setCollapsed(c) {
        if (c) {
          body.classList.add("collapsed");
          card.classList.remove("open");
          btn.innerHTML = T("sheet.expand");
          btn.setAttribute("aria-expanded", "false");
        } else {
          body.classList.remove("collapsed");
          card.classList.add("open");
          btn.innerHTML = T("sheet.collapse");
          btn.setAttribute("aria-expanded", "true");
        }
      }
      btn.addEventListener("click", function () {
        setCollapsed(!body.classList.contains("collapsed"));
      });
      // 初始：长内容折叠（短内容直接铺满，按钮仍可收起）
      setCollapsed(body.scrollHeight > COLLAPSE_MAX);
    });
  }

  // ===================== 表格超长备注：折叠 + 展开铺满 =====================
  // 超长的备注单元格默认折叠（限高 + 渐隐 + 展开按钮），点击后展开铺满下方。
  // 对"说明行"（非备注列全空、备注列很长）额外做整行跨列展开：展开时 colSpan 铺满整行，隐藏同排其他 td。
  var NOTE_COLLAPSE_MAX = 90; // px，内容超出此高度则初始折叠（约 4.4 行）
  function wireNoteCollapsibles() {
    var notes = document.querySelectorAll("#sheet-area td.td-note");
    notes.forEach(function (td) {
      var nb = td.querySelector(".note-body");
      var btn = td.querySelector(".note-collbar-btn");
      var bar = td.querySelector(".note-collbar");
      if (!nb || !btn || !bar) return;
      var tr = td.parentNode;
      var isNoteRow = tr && tr.classList.contains("note-row");
      var siblings = isNoteRow ? [].slice.call(tr.children).filter(function (c) { return c !== td; }) : [];
      function getTotalCols() {
        var thead = tr && tr.parentNode && tr.parentNode.parentNode && tr.parentNode.parentNode.querySelector("thead tr");
        return thead ? thead.children.length : (siblings.length + 1);
      }
      function setCollapsed(c) {
        if (c) {
          nb.classList.add("collapsed");
          btn.innerHTML = T("sheet.expand");
          btn.setAttribute("aria-expanded", "false");
          bar.classList.remove("hidden");
          if (isNoteRow) {
            tr.classList.remove("open");
            if (td.colSpan > 1) {
              td.removeAttribute("colspan");
              siblings.forEach(function (s) { s.classList.remove("hidden"); });
            }
          }
        } else {
          nb.classList.remove("collapsed");
          btn.innerHTML = T("sheet.collapse");
          btn.setAttribute("aria-expanded", "true");
          bar.classList.remove("hidden");
          if (isNoteRow) {
            tr.classList.add("open");
            td.colSpan = getTotalCols();
            siblings.forEach(function (s) { s.classList.add("hidden"); });
          }
        }
      }
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        setCollapsed(!nb.classList.contains("collapsed"));
      });
      // 初始：仅超长才折叠并显示按钮；短备注直接铺满，隐藏按钮条
      if (nb.scrollHeight > NOTE_COLLAPSE_MAX) setCollapsed(true);
      else { nb.classList.remove("collapsed"); bar.classList.add("hidden"); }
    });
  }

  // ===================== 渲染当前 sheet =====================
  function renderSheet() {
    var main = $("#sheet-area");
    main.innerHTML = "";
    var s = activeSheet();
    if (!s) { main.appendChild(el("div", "empty", T("empty.cat"))); return; }
    // 在当前表格上方渲染跨渠道公共说明区域（默认折叠）
    if (COMMON_CHANNEL_NOTICES.length && s.type === "table" && s.category === "线路报价") {
      var box = el("div", "channel-notice hidden");
      box.id = "channel-notice";
      box.appendChild(el("h3", null, T("channelNotice.title")));
      var body = el("div", "channel-notice-body");
      COMMON_CHANNEL_NOTICES.forEach(function (txt) {
        var p = el("p", "channel-notice-item");
        p.style.whiteSpace = "pre-line";
        p.textContent = txt;
        body.appendChild(p);
      });
      box.appendChild(body);
      main.appendChild(box);
    }
    if (s.type === "text") main.appendChild(renderText(s));
    else main.appendChild(renderTable(s));
    wireCollapsibles();
    wireNoteCollapsibles();
  }

  // ===================== 工具栏绑定 =====================
  function populateCurrency() {
    var sel = document.getElementById("cur-sel");
    if (!sel) return;
    sel.innerHTML = "";
    var list = (window.FX && window.FX.list) || ["CNY"];
    list.forEach(function (code) {
      var o = document.createElement("option");
      o.value = code;
      var sym = window.FX ? window.FX.sym(code) : "";
      var nm = window.FX ? window.FX.name(code, LANG) : code;
      o.textContent = (sym ? sym + " " : "") + code + " · " + nm;
      sel.appendChild(o);
    });
    sel.value = CUR;
    sel.addEventListener("change", function () { setCurrency(sel.value); });
  }

  function bindTools() {
    var q = $("#q");
    q.addEventListener("input", function () { state.q = q.value; renderSheet(); });
    $("#clear").addEventListener("click", function () {
      state.q = ""; q.value = ""; state.filters = {}; renderSheet();
    });
    var nav = $("#navbar");
    window.addEventListener("scroll", function () {
      if (window.scrollY > 8) nav.classList.add("stuck"); else nav.classList.remove("stuck");
    });
    $("#btn-refresh").addEventListener("click", function () {
      var btn = this;
      if (btn.disabled) return;
      btn.classList.add("busy"); btn.disabled = true;
      btn.textContent = T("btn.refreshing");
      var u = new URL(window.location.href);
      u.searchParams.set("_r", Date.now());
      window.location.href = u.toString();
    });
    // 语言栏
    var lb = document.getElementById("langbar");
    if (lb) {
      lb.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
      });
    }
  }

  // ===================== URL 状态 =====================
  function readUrl() {
    var p = new URLSearchParams(location.search);
    var qc = p.get("cat"), qs = p.get("sheet"), qq = p.get("q");
    if (qs) {
      var found = DATA.sheets.filter(function (s) { return s.name === qs; })[0];
      if (found) { state.cat = found.category; state.sheet = qs; }
    }
    if (qc) state.cat = qc;
    if (qq != null) state.q = qq;
    if (state.sheet && !activeSheet()) {
      var list = sheetsInCat(state.cat);
      if (list.length) state.sheet = list[0].name; else state.sheet = null;
    }
  }

  // ===================== 启动 =====================
  function init() {
    readUrl();
    applyStaticI18n();
    renderHero();
    renderTabs();
    var list = sheetsInCat(state.cat);
    if (!state.sheet && list.length) state.sheet = list[0].name;
    $("#q").value = state.q || "";
    renderPills();
    renderSheet();
    bindTools();
    populateCurrency();
    updateCurChip();
    document.body.classList.add("js");
    if (window.FX && window.FX.onReady) {
      window.FX.onReady(function () { if (CUR !== "CNY") { updateCurChip(); renderSheet(); } });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
