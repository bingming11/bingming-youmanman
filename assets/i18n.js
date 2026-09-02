/* 邮满满云仓报价 · 三语（中/英/韩）字典 + 国家名映射
 * 由 gen_i18n.py 生成，请勿手改。window.I18N[lang][key]；window.COUNTRY_MAP[中文名]={en,ko}
 */
window.I18N = {
  "zh": {
    "site.title": "邮满满云仓 · 报价查询中心",
    "brand.sub": "跨境集运 · 云仓代发",
    "hero.title1": "邮满满云仓报价",
    "hero.title2": "一站式查询中心",
    "hero.sub": "集运线路、云仓服务与参考规则集中展示。支持按线路 / 仓库 / 服务类型分类，关键词搜索、条件筛选与排序，金额与单位统一格式化。",
    "chip.updated": "更新于",
    "chip.currency": "币种",
    "chip.source": "数据源",
    "stat.route": "线路报价表",
    "stat.warehouse": "云仓服务表",
    "stat.rule": "参考规则表",
    "stat.rows": "报价条目总数",
    "cat.all": "全部",
    "cat.route": "线路报价",
    "cat.warehouse": "云仓服务",
    "cat.rule": "参考规则",
    "search.ph": "搜索：美国、普货、挂号费、0.1、分区…",
    "btn.calc": "🧮 运费试算",
    "btn.clear": "清除",
    "btn.refresh": "↻ 刷新数据",
    "btn.refreshing": "刷新中…",
    "tag.product": "产品代码",
    "tag.effective": "生效",
    "tag.rows": "条",
    "tag.lexiangExcel": "乐享·Excel",
    "tag.lexiangDoc": "乐享·文档",
    "tag.source": "来源",
    "empty.nomatch": "没有匹配…的报价条目，试试更换关键词或清除筛选条件。",
    "empty.cat": "该分类下暂无可展示的报价表。",
    "note.filtered": "显示 {a} / 共 {b} 条（已应用搜索 / 筛选）",
    "banner.err": "解析失败，已回退至上一版本。",
    "banner.warn": "部分工作表解析存在异常，已跳过：",
    "footer.text": "邮满满云仓报价查询中心 · 数据来自 邮满满云仓报价表 文件夹，新增 / 替换报价表后重新运行解析脚本即可同步。",
    "footer.copy": "© 邮满满国际物流（深圳）有限公司",
    "calc.title": "🧮 运费试算",
    "calc.channel": "渠道 / 线路",
    "calc.dest": "目的地 / 产品",
    "calc.weight": "重量 (KG)",
    "calc.len": "长 (cm)",
    "calc.wid": "宽 (cm)",
    "calc.hei": "高 (cm)",
    "calc.decl": "申报价值 (¥)",
    "calc.feeDetail": "费用明细（仅供参考）",
    "calc.go": "计算预估运费",
    "calc.note": "体积系数按线路/目的地不同（÷5000 / ÷6000 / ÷8000）；计费重 = max(实重, 体积重)，并按线路最低计费重封底。结果随报价表更新，仅供参考。",
    "calc.hint": "请输入包裹重量（KG）后自动估算。",
    "calc.realW": "实重",
    "calc.volW": "体积重",
    "calc.chargeW": "计费重",
    "calc.tier": "匹配重量段",
    "calc.rate": "费率",
    "calc.regfee": "挂号费",
    "calc.procfee": "处理费",
    "calc.time": "参考时效",
    "calc.total": "预估运费合计",
    "calc.capped": "超出台阶·按最高档估算",
    "calc.minfloor": "已按最低计费重封底",
    "calc.noRoute": "暂无可用线路报价"
  },
  "en": {
    "site.title": "Yumanman Cloud Warehouse · Quote Center",
    "brand.sub": "Cross-border Consolidation · Cloud Fulfillment",
    "hero.title1": "Yumanman Cloud Warehouse Quotes",
    "hero.title2": "All-in-one Quote Center",
    "hero.sub": "Consolidation routes, cloud-warehouse services and reference rules in one place. Browse by route / warehouse / service, search, filter and sort; all amounts and units normalized.",
    "chip.updated": "Updated",
    "chip.currency": "Currency",
    "chip.source": "Data source",
    "stat.route": "Route Sheets",
    "stat.warehouse": "Warehouse Sheets",
    "stat.rule": "Reference Sheets",
    "stat.rows": "Total Quote Items",
    "cat.all": "All",
    "cat.route": "Route Quotes",
    "cat.warehouse": "Warehouse",
    "cat.rule": "Reference",
    "search.ph": "Search: USA, general cargo, registration fee, 0.1, zone…",
    "btn.calc": "🧮 Shipping Calculator",
    "btn.clear": "Clear",
    "btn.refresh": "↻ Refresh",
    "btn.refreshing": "Refreshing…",
    "tag.product": "Product Code",
    "tag.effective": "Effective",
    "tag.rows": "items",
    "tag.lexiangExcel": "Lexiang·Excel",
    "tag.lexiangDoc": "Lexiang·Doc",
    "tag.source": "Source",
    "empty.nomatch": "No quote items match … Try another keyword or clear filters.",
    "empty.cat": "No quote sheets in this category yet.",
    "note.filtered": "Showing {a} / {b} total (search / filter applied)",
    "banner.err": "Parse failed; rolled back to previous version.",
    "banner.warn": "Some sheets failed to parse and were skipped:",
    "footer.text": "Yumanman Cloud Warehouse Quote Center · Data from the Yumanman quote folder. Re-run the parser after adding/replacing sheets to sync.",
    "footer.copy": "© Yumanman International Logistics (Shenzhen) Co., Ltd.",
    "calc.title": "🧮 Shipping Calculator",
    "calc.channel": "Channel / Route",
    "calc.dest": "Destination / Product",
    "calc.weight": "Weight (KG)",
    "calc.len": "Length (cm)",
    "calc.wid": "Width (cm)",
    "calc.hei": "Height (cm)",
    "calc.decl": "Declared value (¥)",
    "calc.feeDetail": "Fee detail (for reference)",
    "calc.go": "Calculate Estimate",
    "calc.note": "Volumetric divisor varies by route/destination (÷5000 / ÷6000 / ÷8000); chargeable weight = max(actual, volumetric), floored by the route's minimum. Updates with the quote table; for reference only.",
    "calc.hint": "Enter package weight (KG) to estimate.",
    "calc.realW": "Actual weight",
    "calc.volW": "Volumetric weight",
    "calc.chargeW": "Chargeable weight",
    "calc.tier": "Matched weight tier",
    "calc.rate": "Rate",
    "calc.regfee": "Registration fee",
    "calc.procfee": "Handling fee",
    "calc.time": "Est. delivery",
    "calc.total": "Estimated total shipping",
    "calc.capped": "Exceeds tiers · estimated at top tier",
    "calc.minfloor": "Floored to minimum chargeable weight",
    "calc.noRoute": "No route quotes available"
  },
  "ko": {
    "site.title": "우만만 클라우드 창고 · 견적 조회센터",
    "brand.sub": "해외 통합배송 · 클라우드 풀필먼트",
    "hero.title1": "우만만 클라우드 창고 견적",
    "hero.title2": "올인원 견적 조회센터",
    "hero.sub": "해외 통합배송 노선, 클라우드 창고 서비스, 참고 규정을 한곳에서 확인할 수 있습니다. 노선·창고·서비스별 분류, 키워드 검색, 조건 필터, 정렬을 지원하며 금액과 단위를 통일해 표시합니다.",
    "chip.updated": "업데이트",
    "chip.currency": "통화",
    "chip.source": "데이터 출처",
    "stat.route": "노선 견적표",
    "stat.warehouse": "창고 서비스표",
    "stat.rule": "참고 규정표",
    "stat.rows": "총 견적 항목",
    "cat.all": "전체",
    "cat.route": "노선 견적",
    "cat.warehouse": "클라우드 창고",
    "cat.rule": "참고 규정",
    "search.ph": "검색: 미국, 일반화물, 등기비, 0.1, 구역…",
    "btn.calc": "🧮 배송비 계산기",
    "btn.clear": "초기화",
    "btn.refresh": "↻ 새로고침",
    "btn.refreshing": "새로고침 중…",
    "tag.product": "상품 코드",
    "tag.effective": "적용",
    "tag.rows": "건",
    "tag.lexiangExcel": "렉시앙·Excel",
    "tag.lexiangDoc": "렉시앙·문서",
    "tag.source": "출처",
    "empty.nomatch": "…에 일치하는 견적 항목이 없습니다. 다른 키워드를 시도하거나 필터를 초기화하세요.",
    "empty.cat": "이 분류에는 표시할 견적표가 없습니다.",
    "note.filtered": "{a} / 총 {b}건 표시됨 (검색·필터 적용)",
    "banner.err": "구문 분석 실패, 이전 버전으로 되돌렸습니다.",
    "banner.warn": "일부 시트 구문 분석 오류로 건너뛰었습니다:",
    "footer.text": "우만만 클라우드 창고 견적 조회센터 · 데이터는 우만만 견적 폴더에서 가져옵니다. 시트 추가·교체 후 파서를 다시 실행하면 동기화됩니다.",
    "footer.copy": "© 우만만 국제물류(선전) 유한회사",
    "calc.title": "🧮 배송비 계산기",
    "calc.channel": "채널 / 노선",
    "calc.dest": "목적지 / 상품",
    "calc.weight": "중량 (KG)",
    "calc.len": "길이 (cm)",
    "calc.wid": "너비 (cm)",
    "calc.hei": "높이 (cm)",
    "calc.decl": "신고 가액 (¥)",
    "calc.feeDetail": "요금 내역 (참고용)",
    "calc.go": "예상 배송비 계산",
    "calc.note": "부피 환산 계수는 노선/목적지에 따라 다름(÷5000 / ÷6000 / ÷8000); 과금중량 = max(실중량, 부피중량)이며 노선 최소 과금중량으로 하한 적용. 견적표 업데이트에 따라 변동되며 참고용입니다.",
    "calc.hint": "패키지 중량(KG)을 입력하면 자동 계산됩니다.",
    "calc.realW": "실중량",
    "calc.volW": "부피중량",
    "calc.chargeW": "과금중량",
    "calc.tier": "일치 중량 구간",
    "calc.rate": "요율",
    "calc.regfee": "등기비",
    "calc.procfee": "취급수수료",
    "calc.time": "예상 소요시간",
    "calc.total": "예상 배송비 합계",
    "calc.capped": "구간 초과·최상위 구간으로 계산",
    "calc.minfloor": "최소 과금중량으로 하한 적용",
    "calc.noRoute": "사용 가능한 노선 견적 없음"
  }
};

window.COUNTRY_MAP = {
  "波兰": {
    "en": "Poland",
    "ko": "폴란드"
  },
  "卢森堡": {
    "en": "Luxembourg",
    "ko": "룩셈부르크"
  },
  "安哥拉": {
    "en": "Angola",
    "ko": "앙골라"
  },
  "巴西": {
    "en": "Brazil",
    "ko": "브라질"
  },
  "马耳他": {
    "en": "Malta",
    "ko": "몰타"
  },
  "泰国": {
    "en": "Thailand",
    "ko": "태국"
  },
  "新西兰": {
    "en": "New Zealand",
    "ko": "뉴질랜드"
  },
  "葡萄牙": {
    "en": "Portugal",
    "ko": "포르투갈"
  },
  "立陶宛": {
    "en": "Lithuania",
    "ko": "리투아니아"
  },
  "巴基斯坦": {
    "en": "Pakistan",
    "ko": "파키스탄"
  },
  "德国": {
    "en": "Germany",
    "ko": "독일"
  },
  "美国": {
    "en": "United States",
    "ko": "미국"
  },
  "菲律宾": {
    "en": "Philippines",
    "ko": "필리핀"
  },
  "智利": {
    "en": "Chile",
    "ko": "칠레"
  },
  "西班牙": {
    "en": "Spain",
    "ko": "스페인"
  },
  "赞比亚": {
    "en": "Zambia",
    "ko": "잠비아"
  },
  "拉脱维亚": {
    "en": "Latvia",
    "ko": "라트비아"
  },
  "秘鲁": {
    "en": "Peru",
    "ko": "페루"
  },
  "澳大利亚": {
    "en": "Australia",
    "ko": "호주"
  },
  "保加利亚": {
    "en": "Bulgaria",
    "ko": "불가리아"
  },
  "英国": {
    "en": "United Kingdom",
    "ko": "영국"
  },
  "马来西亚": {
    "en": "Malaysia",
    "ko": "말레이시아"
  },
  "韩国": {
    "en": "South Korea",
    "ko": "한국"
  },
  "奥地利": {
    "en": "Austria",
    "ko": "오스트리아"
  },
  "塞内加尔": {
    "en": "Senegal",
    "ko": "세네갈"
  },
  "中国澳门": {
    "en": "Macao",
    "ko": "마카오"
  },
  "马约特": {
    "en": "Mayotte",
    "ko": "마요트"
  },
  "希腊": {
    "en": "Greece",
    "ko": "그리스"
  },
  "荷兰": {
    "en": "Netherlands",
    "ko": "네덜란드"
  },
  "以色列": {
    "en": "Israel",
    "ko": "이스라엘"
  },
  "塞浦路斯": {
    "en": "Cyprus",
    "ko": "키프로스"
  },
  "瑞典": {
    "en": "Sweden",
    "ko": "스웨덴"
  },
  "瑞士": {
    "en": "Switzerland",
    "ko": "스위스"
  },
  "巴林": {
    "en": "Bahrain",
    "ko": "바레인"
  },
  "罗马尼亚": {
    "en": "Romania",
    "ko": "루마니아"
  },
  "斯洛文尼亚": {
    "en": "Slovenia",
    "ko": "슬로베니아"
  },
  "尼日利亚": {
    "en": "Nigeria",
    "ko": "나이지리아"
  },
  "乌干达": {
    "en": "Uganda",
    "ko": "우간다"
  },
  "阿拉伯联合酋长国": {
    "en": "UAE",
    "ko": "아랍에미리트"
  },
  "印度尼西亚": {
    "en": "Indonesia",
    "ko": "인도네시아"
  },
  "墨西哥": {
    "en": "Mexico",
    "ko": "멕시코"
  },
  "匈牙利": {
    "en": "Hungary",
    "ko": "헝가리"
  },
  "马达加斯加": {
    "en": "Madagascar",
    "ko": "마다가스카르"
  },
  "中国香港": {
    "en": "Hong Kong",
    "ko": "홍콩"
  },
  "爱尔兰": {
    "en": "Ireland",
    "ko": "아일랜드"
  },
  "比利时": {
    "en": "Belgium",
    "ko": "벨기에"
  },
  "捷克": {
    "en": "Czechia",
    "ko": "체코"
  },
  "爱沙尼亚": {
    "en": "Estonia",
    "ko": "에스토니아"
  },
  "哥伦比亚": {
    "en": "Colombia",
    "ko": "콜롬비아"
  },
  "意大利": {
    "en": "Italy",
    "ko": "이탈리아"
  },
  "克罗地亚": {
    "en": "Croatia",
    "ko": "크로아티아"
  },
  "肯尼亚": {
    "en": "Kenya",
    "ko": "케냐"
  },
  "留尼汪": {
    "en": "Réunion",
    "ko": "레위니옹"
  },
  "沙特阿拉伯": {
    "en": "Saudi Arabia",
    "ko": "사우디아라비아"
  },
  "摩洛哥": {
    "en": "Morocco",
    "ko": "모로코"
  },
  "挪威": {
    "en": "Norway",
    "ko": "노르웨이"
  },
  "南非": {
    "en": "South Africa",
    "ko": "남아프리카공화국"
  },
  "塞舌尔": {
    "en": "Seychelles",
    "ko": "세이셸"
  },
  "斯洛伐克": {
    "en": "Slovakia",
    "ko": "슬로바키아"
  },
  "阿塞拜疆": {
    "en": "Azerbaijan",
    "ko": "아제르바이잔"
  },
  "卡塔尔": {
    "en": "Qatar",
    "ko": "카타르"
  },
  "毛里求斯": {
    "en": "Mauritius",
    "ko": "모리셔스"
  },
  "芬兰": {
    "en": "Finland",
    "ko": "핀란드"
  },
  "科威特": {
    "en": "Kuwait",
    "ko": "쿠웨이트"
  },
  "加拿大": {
    "en": "Canada",
    "ko": "캐나다"
  },
  "阿根廷": {
    "en": "Argentina",
    "ko": "아르헨티나"
  },
  "越南": {
    "en": "Vietnam",
    "ko": "베트남"
  },
  "法国": {
    "en": "France",
    "ko": "프랑스"
  },
  "坦桑尼亚": {
    "en": "Tanzania",
    "ko": "탄자니아"
  },
  "丹麦": {
    "en": "Denmark",
    "ko": "덴마크"
  },
  "加纳": {
    "en": "Ghana",
    "ko": "가나"
  },
  "卢旺达": {
    "en": "Rwanda",
    "ko": "르완다"
  },
  "约旦": {
    "en": "Jordan",
    "ko": "요르단"
  },
  "捷克共和国": {
    "en": "捷克共和国",
    "ko": "체코"
  },
  "日本": {
    "en": "Japan",
    "ko": "일본"
  },
  "新加坡": {
    "en": "Singapore",
    "ko": "싱가포르"
  }
};

/* 当前界面语言（zh/en/ko），读取/写入 localStorage */
(function(){
  window.I18N_LANG = (function(){ try { return localStorage.getItem('ym_lang') || 'zh'; } catch(e){ return 'zh'; } })();
  window.I18N_OK = true;
})();