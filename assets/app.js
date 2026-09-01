/* 邮满满云仓报价展示网站 —— 前端逻辑
 * 数据来自 window.YUNMANMAN_DATA (data/data.js) 与 window.YUNMANMAN_STATUS (data/status.js)。
 * 兼容 file:// 直接打开（数据以 <script> 全局变量注入，无需 fetch）。
 */
(function () {
  "use strict";

  var DATA = window.YUNMANMAN_DATA || { version: 0, sheets: [], sheetCount: 0, totalRows: 0, updatedAt: "" };
  var STATUS = window.YUNMANMAN_STATUS || { ok: true, version: DATA.version, updatedAt: DATA.updatedAt };

  var CURRENCY_KW = ["RMB", "元", "价格", "运费", "挂号", "服务费", "附加费",
    "处理费", "单价", "金额", "成本", "保价"];
  var FEE_KW = ["费"];          // 辅助判断，但需排除重量列
  var WEIGHT_KW = ["KG", "kg", "重量", "计费重", "克", "g/"];
  var CAT_ORDER = ["线路报价", "云仓服务", "参考规则"];

  // ---------- 状态 ----------
  var state = {
    cat: "全部",
    sheet: null,
    q: "",
    filters: {},   // {colIndex: value}
    sort: null     // {col, dir: 'asc'|'desc'}
  };

  // ---------- 工具 ----------
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
    // 有明确货币单位 RMB / 元 / 价格 / 运费 / 挂号 / 服务费 / 附加费 / 处理费 / 单价 / 金额 / 成本 / 保价
    for (var i = 0; i < CURRENCY_KW.length; i++) if (h.indexOf(CURRENCY_KW[i]) >= 0) return true;
    // 含“费”字时：先排除重量列（KG/计费重等），再排除标签类列（收费项目/计费依据等）
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
    // 兜底：出现未预期分类也展示
    DATA.sheets.forEach(function (s) { if (cats.indexOf(s.category) < 0) cats.push(s.category); });
    return cats;
  }
  function sheetsInCat(cat) {
    return DATA.sheets.filter(function (s) { return cat === "全部" || s.category === cat; });
  }

  // ---------- HERO / 状态 ----------
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

    // 服务状态横幅
    var b = $("#banner");
    b.innerHTML = "";
    if (STATUS.ok === false) {
      b.className = "banner err";
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
        '<div><b>解析失败，已回退至上一版本。</b> ' + esc(STATUS.error || "未知错误") +
        (STATUS.fallbackVersion ? "（当前展示 v" + STATUS.fallbackVersion + "）" : "") +
        '。请检查数据源文件后重新运行解析脚本。</div>';
    } else if (STATUS.errors && STATUS.errors.length) {
      b.className = "banner warn";
      var names = STATUS.errors.map(function (e) { return e.file + (e.sheet ? " › " + e.sheet : ""); }).join("、");
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
        '<div><b>部分工作表解析存在异常，已跳过：</b>' + esc(names) + '。其余报价表正常展示。</div>';
    } else {
      b.className = "banner hidden";
    }

    // 刷新按钮可用性
    var btn = $("#btn-refresh");
    var served = location.protocol.indexOf("http") === 0;
    if (served) {
      btn.disabled = false;
      btn.title = "刷新报价数据：数据由乐享自动同步，点击重新加载最新版本";
    } else {
      btn.disabled = true;
      btn.title = "当前为离线模式（file://），请通过在线网址访问方可刷新";
    }
  }

  // ---------- TABS ----------
  function renderTabs() {
    var row = $("#tabrow");
    row.innerHTML = "";
    categories().forEach(function (cat) {
      var n = sheetsInCat(cat).length;
      var t = el("button", "tab", cat);
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

  // ---------- SHEET PILLS ----------
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

  // ---------- 当前表的可筛选列 ----------
  function activeSheet() {
    return DATA.sheets.filter(function (s) { return s.name === state.sheet; })[0] || null;
  }
  function colRole(sheet, ci) {
    var h = sheet.headers[ci];
    if (isCurrencyHeader(h)) return "cur";
    // 数值列判定：多数非空值可解析为数字
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
        // 至少有一个非纯数字值才算分类列
        var hasText = vals.some(function (v) { return toNum(v) == null; });
        if (hasText) out.push({ ci: ci, header: h, vals: vals });
      }
    });
    return out;
  }

  // ---------- 过滤 + 排序后的行 ----------
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
    // 仅高亮首个匹配，避免长文本过度标记
    return esc(text.slice(0, qi)) + "<mark>" + esc(text.slice(qi, qi + q.length)) + "</mark>" + esc(text.slice(qi + q.length));
  }

  // ---------- 渲染表格 ----------
  function renderTable(sheet) {
    var wrap = el("div", "card");

    // 标题 + 元信息
    var head = el("div", "sec-head");
    head.appendChild(el("h2", null, sheet.name));
    var meta = el("div", "meta");
    if (sheet.meta && sheet.meta.productCode) meta.appendChild(el("span", "tag a", "产品代码 " + sheet.meta.productCode));
    if (sheet.meta && sheet.meta.effectiveDate) meta.appendChild(el("span", "tag", "生效 " + sheet.meta.effectiveDate));
    meta.appendChild(el("span", "tag g", (sheet.rowCount || 0) + " 条"));
    if (sheet.source === "lexiang") meta.appendChild(el("span", "tag b", sheet.sourceKind === "excel" ? "乐享·Excel" : "乐享·文档"));
    if (sheet.sourceFile) meta.appendChild(el("span", "tag", "来源 " + sheet.sourceFile));
    head.appendChild(meta);
    wrap.appendChild(head);

    // 筛选下拉
    var fcols = filterableCols(sheet);
    if (fcols.length) {
      var filt = el("div", "filt");
      fcols.forEach(function (f) {
        var shortH = f.header.replace(/\s*\(.*\)/, "");
        var lab = el("label", null, shortH);
        var sel = el("select");
        sel.appendChild(new Option("全部 · " + shortH, ""));
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

    // 过滤 + 排序后的行
    var rows = visibleRows(sheet);

    if (!rows.length) {
      var em = el("div", "empty", "没有匹配" +
        (state.q ? "「" + state.q + "」" : "") +
        "的报价条目，试试更换关键词或清除筛选条件。");
      wrap.appendChild(em);
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
      th.innerHTML = esc(h || "—") + '<span class="ar">' + ar + "</span>";
      th.addEventListener("click", function () {
        if (state.sort && state.sort.col === ci) {
          state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        } else { state.sort = { col: ci, dir: "asc" }; }
        renderSheet();
      });
      trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);

    var tb = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      sheet.headers.forEach(function (h, ci) {
        var role = colRole(sheet, ci);
        var v = r[ci];
        var td = el("td");
        if (role === "cur") {
          td.className = "cur";
          var n = toNum(v);
          td.innerHTML = n != null ? "¥" + fmtNum(n) : highlight(v);
        } else if (role === "num") {
          td.className = "num";
          var nn = toNum(v);
          td.innerHTML = nn != null ? fmtNum(nn) : highlight(v);
        } else {
          td.innerHTML = highlight(v);
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb); tw.appendChild(table); wrap.appendChild(tw);

    // 行数提示
    if (rows.length !== sheet.rowCount) {
      var note = el("div", "empty",
        "显示 " + rows.length + " / 共 " + sheet.rowCount + " 条" +
        (state.q || Object.keys(state.filters).length ? "（已应用搜索 / 筛选）" : ""));
      wrap.appendChild(note);
    }
    return wrap;
  }

  // ---------- 渲染文本 ----------
  function renderText(sheet) {
    var wrap = el("div", "card");
    var head = el("div", "sec-head");
    head.appendChild(el("h2", null, sheet.name));
    var meta = el("div", "meta");
    if (sheet.source === "lexiang") meta.appendChild(el("span", "tag b", sheet.sourceKind === "excel" ? "乐享·Excel" : "乐享·文档"));
    if (sheet.sourceFile) meta.appendChild(el("span", "tag", "来源 " + sheet.sourceFile));
    head.appendChild(meta);
    wrap.appendChild(head);
    (sheet.blocks || []).forEach(function (blk) {
      var p = el("p", "plain", blk);
      wrap.appendChild(p);
    });
    return wrap;
  }

  // ---------- 渲染当前 sheet ----------
  function renderSheet() {
    var main = $("#sheet-area");
    main.innerHTML = "";
    var s = activeSheet();
    if (!s) { main.appendChild(el("div", "empty", "该分类下暂无可展示的报价表。")); return; }
    if (s.type === "text") main.appendChild(renderText(s));
    else main.appendChild(renderTable(s));
  }

  // ---------- 绑定工具栏 ----------
  function bindTools() {
    var q = $("#q");
    q.addEventListener("input", function () { state.q = q.value; renderSheet(); });
    $("#clear").addEventListener("click", function () {
      state.q = ""; q.value = ""; state.filters = {}; renderSheet();
    });
    // 滚动时给 navbar 加阴影
    var nav = $("#navbar");
    window.addEventListener("scroll", function () {
      if (window.scrollY > 8) nav.classList.add("stuck"); else nav.classList.remove("stuck");
    });
    // 刷新
    $("#btn-refresh").addEventListener("click", function () {
      var btn = this;
      if (btn.disabled) return;
      btn.classList.add("busy"); btn.disabled = true;
      btn.textContent = "刷新中…";
      fetch("/refresh", { method: "POST" })
        .then(function (r) {
          if (!r.ok) throw new Error("no-backend");
          return r.json();
        })
        .then(function (j) {
          if (j.ok) { location.reload(true); }
          else { throw new Error(j.error || "fail"); }
        })
        .catch(function () {
          // 静态托管场景：无 /refresh 后端。重新加载页面以拉取已发布的最新 data.js
          // （数据由乐享每小时自动同步；若刚更新过，重新发布后此刷新即可见最新）
          var u = new URL(window.location.href);
          u.searchParams.set("_r", Date.now());
          window.location.href = u.toString();
        });
    });
  }

  // ---------- URL 状态同步 ----------
  function readUrl() {
    var p = new URLSearchParams(location.search);
    var qc = p.get("cat"), qs = p.get("sheet"), qq = p.get("q");
    if (qs) {
      var found = DATA.sheets.filter(function (s) { return s.name === qs; })[0];
      if (found) { state.cat = found.category; state.sheet = qs; }
    }
    if (qc) state.cat = qc;
    if (qq != null) state.q = qq;
    // 校验 sheet 是否在分类内
    if (state.sheet && !activeSheet()) {
      var list = sheetsInCat(state.cat);
      if (list.length) state.sheet = list[0].name; else state.sheet = null;
    }
  }

  // ---------- 启动 ----------
  function init() {
    readUrl();
    renderHero();
    renderTabs();
    var list = sheetsInCat(state.cat);
    if (!state.sheet && list.length) state.sheet = list[0].name;
    $("#q").value = state.q || "";
    renderPills();
    renderSheet();
    bindTools();
    document.body.classList.add("js");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
