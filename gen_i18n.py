#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成 assets/i18n.js ：UI 三语文案 + 国家名映射（英名取自参考 CLIST，韩名手写）。"""
import re, json, os

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- 1) 英文名：从参考文件 CLIST 抽取 ----
REF = r'D:/微信聊天数据/xwechat_files/wxid_o7ikn6vo6ky022_615c/temp/RWTemp/2026-08/3c2ae6589d6b080cfc4ca18ce4761d69/YunExpress_08.2026.html'
en_map = {}
if os.path.exists(REF):
    rt = open(REF, encoding='utf-8', errors='replace').read()
    i = rt.find('window.CLIST')
    if i >= 0:
        j = rt.find('[', i); k = rt.find('];', j)
        arr = json.loads(rt[j:k+1])
        for row in arr:
            if len(row) >= 4 and row[3]:
                en_map.setdefault(row[3], row[2])

# ---- 2) 韩文名（手写，覆盖本站真实国家） ----
KO = {
    "美国":"미국","英国":"영국","德国":"독일","法国":"프랑스","意大利":"이탈리아","西班牙":"스페인",
    "荷兰":"네덜란드","波兰":"폴란드","比利时":"벨기에","瑞典":"스웨덴","丹麦":"덴마크","奥地利":"오스트리아",
    "挪威":"노르웨이","瑞士":"스위스","爱尔兰":"아일랜드","葡萄牙":"포르투갈","希腊":"그리스","芬兰":"핀란드",
    "捷克":"체코","捷克共和国":"체코","匈牙利":"헝가리","斯洛伐克":"슬로바키아","斯洛文尼亚":"슬로베니아",
    "爱沙尼亚":"에스토니아","拉脱维亚":"라트비아","立陶宛":"리투아니아","保加利亚":"불가리아","克罗地亚":"크로아티아",
    "罗马尼亚":"루마니아","塞浦路斯":"키프로스","马耳他":"몰타","卢森堡":"룩셈부르크","日本":"일본","韩国":"한국",
    "新加坡":"싱가포르","马来西亚":"말레이시아","泰国":"태국","越南":"베트남","印度尼西亚":"인도네시아","菲律宾":"필리핀",
    "澳大利亚":"호주","新西兰":"뉴질랜드","以色列":"이스라엘","沙特阿拉伯":"사우디아라비아","阿拉伯联合酋长国":"아랍에미리트",
    "卡塔尔":"카타르","科威特":"쿠웨이트","巴林":"바레인","约旦":"요르단","摩洛哥":"모로코","南非":"남아프리카공화국",
    "尼日利亚":"나이지리아","加纳":"가나","肯尼亚":"케냐","乌干达":"우간다","坦桑尼亚":"탄자니아","卢旺达":"르완다",
    "安哥拉":"앙골라","塞内加尔":"세네갈","毛里求斯":"모리셔스","留尼汪":"레위니옹","马达加斯加":"마다가스카르",
    "塞舌尔":"세이셸","赞比亚":"잠비아","马约特":"마요트","阿塞拜疆":"아제르바이잔","巴基斯坦":"파키스탄","墨西哥":"멕시코",
    "巴西":"브라질","智利":"칠레","哥伦比亚":"콜롬비아","秘鲁":"페루","阿根廷":"아르헨티나","加拿大":"캐나다",
    "中国香港":"홍콩","中国澳门":"마카오",
}

# 合并国家映射（en 优先 CLIST，缺的用 zh 原名兜底）
COUNTRY = {}
all_zh = set(en_map.keys()) | set(KO.keys())
for zh in all_zh:
    COUNTRY[zh] = {"en": en_map.get(zh, zh), "ko": KO.get(zh, zh)}

# ---- 3) UI 三语文案 ----
UI = {
    "site.title":    {"zh":"邮满满云仓 · 报价查询中心", "en":"Yumanman Cloud Warehouse · Quote Center", "ko":"우만만 클라우드 창고 · 견적 조회센터"},
    "brand.sub":     {"zh":"跨境集运 · 云仓代发", "en":"Cross-border Consolidation · Cloud Fulfillment", "ko":"해외 통합배송 · 클라우드 풀필먼트"},
    "hero.title1":   {"zh":"邮满满云仓报价", "en":"Yumanman Cloud Warehouse Quotes", "ko":"우만만 클라우드 창고 견적"},
    "hero.title2":   {"zh":"一站式查询中心", "en":"All-in-one Quote Center", "ko":"올인원 견적 조회센터"},
    "hero.sub":      {"zh":"集运线路、云仓服务与参考规则集中展示。支持按线路 / 仓库 / 服务类型分类，关键词搜索、条件筛选与排序，金额与单位统一格式化。",
                      "en":"Consolidation routes, cloud-warehouse services and reference rules in one place. Browse by route / warehouse / service, search, filter and sort; all amounts and units normalized.",
                      "ko":"해외 통합배송 노선, 클라우드 창고 서비스, 참고 규정을 한곳에서 확인할 수 있습니다. 노선·창고·서비스별 분류, 키워드 검색, 조건 필터, 정렬을 지원하며 금액과 단위를 통일해 표시합니다."},
    "chip.updated":  {"zh":"更新于", "en":"Updated", "ko":"업데이트"},
    "chip.currency": {"zh":"币种", "en":"Currency", "ko":"통화"},
    "chip.source":   {"zh":"数据源", "en":"Data source", "ko":"데이터 출처"},
    "stat.route":    {"zh":"线路报价表", "en":"Route Sheets", "ko":"노선 견적표"},
    "stat.warehouse": {"zh":"云仓服务表", "en":"Warehouse Sheets", "ko":"창고 서비스표"},
    "stat.rule":     {"zh":"参考规则表", "en":"Reference Sheets", "ko":"참고 규정표"},
    "stat.rows":     {"zh":"报价条目总数", "en":"Total Quote Items", "ko":"총 견적 항목"},
    "cat.all":       {"zh":"全部", "en":"All", "ko":"전체"},
    "cat.route":     {"zh":"线路报价", "en":"Route Quotes", "ko":"노선 견적"},
    "cat.warehouse": {"zh":"云仓服务", "en":"Warehouse", "ko":"클라우드 창고"},
    "cat.rule":      {"zh":"参考规则", "en":"Reference", "ko":"참고 규정"},
    "search.ph":     {"zh":"搜索：美国、普货、挂号费、0.1、分区…", "en":"Search: USA, general cargo, registration fee, 0.1, zone…", "ko":"검색: 미국, 일반화물, 등기비, 0.1, 구역…"},
    "btn.calc":      {"zh":"🧮 运费试算", "en":"🧮 Shipping Calculator", "ko":"🧮 배송비 계산기"},
    "btn.clear":     {"zh":"清除", "en":"Clear", "ko":"초기화"},
    "btn.refresh":   {"zh":"↻ 刷新数据", "en":"↻ Refresh", "ko":"↻ 새로고침"},
    "btn.refreshing": {"zh":"刷新中…", "en":"Refreshing…", "ko":"새로고침 중…"},
    "tag.product":   {"zh":"产品代码", "en":"Product Code", "ko":"상품 코드"},
    "tag.effective": {"zh":"生效", "en":"Effective", "ko":"적용"},
    "tag.rows":      {"zh":"条", "en":"items", "ko":"건"},
    "tag.lexiangExcel": {"zh":"乐享·Excel", "en":"Lexiang·Excel", "ko":"렉시앙·Excel"},
    "tag.lexiangDoc": {"zh":"乐享·文档", "en":"Lexiang·Doc", "ko":"렉시앙·문서"},
    "tag.source":    {"zh":"来源", "en":"Source", "ko":"출처"},
    "empty.nomatch": {"zh":"没有匹配…的报价条目，试试更换关键词或清除筛选条件。", "en":"No quote items match … Try another keyword or clear filters.", "ko":"…에 일치하는 견적 항목이 없습니다. 다른 키워드를 시도하거나 필터를 초기화하세요."},
    "empty.cat":     {"zh":"该分类下暂无可展示的报价表。", "en":"No quote sheets in this category yet.", "ko":"이 분류에는 표시할 견적표가 없습니다."},
    "note.filtered": {"zh":"显示 {a} / 共 {b} 条（已应用搜索 / 筛选）", "en":"Showing {a} / {b} total (search / filter applied)", "ko":"{a} / 총 {b}건 표시됨 (검색·필터 적용)"},
    "banner.err":    {"zh":"解析失败，已回退至上一版本。", "en":"Parse failed; rolled back to previous version.", "ko":"구문 분석 실패, 이전 버전으로 되돌렸습니다."},
    "banner.warn":   {"zh":"部分工作表解析存在异常，已跳过：", "en":"Some sheets failed to parse and were skipped:", "ko":"일부 시트 구문 분석 오류로 건너뛰었습니다:"},
    "footer.text":   {"zh":"邮满满云仓报价查询中心 · 数据来自 邮满满云仓报价表 文件夹，新增 / 替换报价表后重新运行解析脚本即可同步。", "en":"Yumanman Cloud Warehouse Quote Center · Data from the Yumanman quote folder. Re-run the parser after adding/replacing sheets to sync.", "ko":"우만만 클라우드 창고 견적 조회센터 · 데이터는 우만만 견적 폴더에서 가져옵니다. 시트 추가·교체 후 파서를 다시 실행하면 동기화됩니다."},
    "footer.copy":   {"zh":"© 邮满满国际物流（深圳）有限公司", "en":"© Yumanman International Logistics (Shenzhen) Co., Ltd.", "ko":"© 우만만 국제물류(선전) 유한회사"},
    "calc.title":    {"zh":"🧮 运费试算", "en":"🧮 Shipping Calculator", "ko":"🧮 배송비 계산기"},
    "calc.channel":  {"zh":"渠道 / 线路", "en":"Channel / Route", "ko":"채널 / 노선"},
    "calc.dest":     {"zh":"目的地 / 产品", "en":"Destination / Product", "ko":"목적지 / 상품"},
    "calc.weight":   {"zh":"重量 (KG)", "en":"Weight (KG)", "ko":"중량 (KG)"},
    "calc.len":      {"zh":"长 (cm)", "en":"Length (cm)", "ko":"길이 (cm)"},
    "calc.wid":      {"zh":"宽 (cm)", "en":"Width (cm)", "ko":"너비 (cm)"},
    "calc.hei":      {"zh":"高 (cm)", "en":"Height (cm)", "ko":"높이 (cm)"},
    "calc.go":       {"zh":"计算预估运费", "en":"Calculate Estimate", "ko":"예상 배송비 계산"},
    "calc.note":     {"zh":"体积重 = 长×宽×高 ÷ 6000；计费重 = max(实重, 体积重)，并按线路最低计费重封底。结果随报价表更新，仅供参考。",
                      "en":"Volumetric weight = L×W×H ÷ 6000; chargeable weight = max(actual, volumetric), floored by the route's minimum. Updates with the quote table; for reference only.",
                      "ko":"부피중량 = 가로×세로×높이 ÷ 6000; 과금중량 = max(실중량, 부피중량)이며 노선 최소 과금중량으로 하한 적용. 견적표 업데이트에 따라 변동되며 참고용입니다."},
    "calc.hint":     {"zh":"请输入包裹重量（KG）后自动估算。", "en":"Enter package weight (KG) to estimate.", "ko":"패키지 중량(KG)을 입력하면 자동 계산됩니다."},
    "calc.realW":    {"zh":"实重", "en":"Actual weight", "ko":"실중량"},
    "calc.volW":     {"zh":"体积重", "en":"Volumetric weight", "ko":"부피중량"},
    "calc.chargeW":  {"zh":"计费重", "en":"Chargeable weight", "ko":"과금중량"},
    "calc.tier":     {"zh":"匹配重量段", "en":"Matched weight tier", "ko":"일치 중량 구간"},
    "calc.rate":     {"zh":"费率", "en":"Rate", "ko":"요율"},
    "calc.regfee":   {"zh":"挂号费", "en":"Registration fee", "ko":"등기비"},
    "calc.procfee":  {"zh":"处理费", "en":"Handling fee", "ko":"취급수수료"},
    "calc.time":     {"zh":"参考时效", "en":"Est. delivery", "ko":"예상 소요시간"},
    "calc.total":    {"zh":"预估运费合计", "en":"Estimated total shipping", "ko":"예상 배송비 합계"},
    "calc.capped":   {"zh":"超出台阶·按最高档估算", "en":"Exceeds tiers · estimated at top tier", "ko":"구간 초과·최상위 구간으로 계산"},
    "calc.minfloor": {"zh":"已按最低计费重封底", "en":"Floored to minimum chargeable weight", "ko":"최소 과금중량으로 하한 적용"},
    "calc.noRoute":  {"zh":"暂无可用线路报价", "en":"No route quotes available", "ko":"사용 가능한 노선 견적 없음"},
}

# ---- 4) 转置为嵌套结构：I18N[lang][key] （与 app.js / calc.js 的 T() 对齐） ----
NESTED = {"zh": {}, "en": {}, "ko": {}}
for k, v in UI.items():
    for lang in ("zh", "en", "ko"):
        NESTED[lang][k] = v.get(lang, v.get("zh"))

out = []
out.append("/* 邮满满云仓报价 · 三语（中/英/韩）字典 + 国家名映射")
out.append(" * 由 gen_i18n.py 生成，请勿手改。window.I18N[lang][key]；window.COUNTRY_MAP[中文名]={en,ko}")
out.append(" */")
out.append("window.I18N = " + json.dumps(NESTED, ensure_ascii=False, indent=2) + ";")
out.append("")
out.append("window.COUNTRY_MAP = " + json.dumps(COUNTRY, ensure_ascii=False, indent=2) + ";")
out.append("")
out.append("/* 当前界面语言（zh/en/ko），读取/写入 localStorage */")
out.append("(function(){")
out.append("  window.I18N_LANG = (function(){ try { return localStorage.getItem('ym_lang') || 'zh'; } catch(e){ return 'zh'; } })();")
out.append("  window.I18N_OK = true;")
out.append("})();")

open(os.path.join(HERE, "assets", "i18n.js"), "w", encoding="utf-8").write("\n".join(out))
print("i18n.js written. UI keys:", len(UI), "| countries:", len(COUNTRY))
