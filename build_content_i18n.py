# -*- coding: utf-8 -*-
"""
构建 assets/content-i18n.js —— 表格单元格/文本块内容的三语翻译映射表。
流程：
  1. 从 data/data.js 抽取所有唯一中文字符串（表格单元格 + 文本块）。
  2. 排除：纯数字、国家名（COUNTRY_MAP 已覆盖）、可模式规则推导的（时效/分区/纯价格）。
  3. 优先用手工精译词典 HAND_DICT（领域术语 + 章节标题 + 渠道名模板）。
  4. 剩余走 MyMemory 机器翻译（zh->en / zh->ko），结果缓存到 content_cache.json，可重复运行补齐。
输出：window.CONTENT_MAP = { "中文": {"en": "...", "ko": "..."} }
"""
import json, re, os, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_JS = os.path.join(HERE, "data", "data.js")
I18N_JS = os.path.join(HERE, "assets", "i18n.js")
OUT_JS = os.path.join(HERE, "assets", "content-i18n.js")
CACHE_JSON = os.path.join(HERE, "content_cache.json")

CJK = re.compile(r'[\u4e00-\u9fff]')

# ---------------- 手工精译词典（领域术语 / 章节标题 / 渠道名） ----------------
HAND_DICT = {
    # ---- 核心走货属性 ----
    "普货": ("General cargo", "일반화물"),
    "P货": ("General cargo", "일반화물"),
    "P普货": ("General cargo", "일반화물"),
    "敏感": ("Sensitive goods", "민감품"),
    "特敏": ("Highly sensitive goods", "특수민감품"),
    "特货": ("Special goods", "특수화물"),
    "禁运": ("Prohibited", "운송금지"),
    "限制物品": ("Restricted items", "제한품목"),
    "带电": ("Battery-containing", "배터리 포함"),
    "纯电": ("Pure battery", "순수 배터리"),
    "内电": ("Built-in battery", "내장 배터리"),
    "带磁": ("Magnetic", "자성 포함"),
    "液体": ("Liquid", "액체"),
    "粉末": ("Powder", "분말"),
    "膏体": ("Paste", "페이스트"),
    "膏状": ("Paste", "페이스트"),
    "化妆品": ("Cosmetics", "화장품"),
    "食品": ("Food", "식품"),
    "药品": ("Medicine", "의약품"),
    "医药品": ("Medicine", "의약품"),
    "保健品": ("Health supplements", "건강보조식품"),
    "刀具": ("Knives", "도검"),
    "玩具枪": ("Toy gun", "장난감 총"),
    "电子烟": ("E-cigarette", "전자담배"),
    # ---- 产品类别 ----
    "手机": ("Mobile phone", "휴대폰"),
    "智能手机": ("Smartphone", "스마트폰"),
    "平板": ("Tablet", "태블릿"),
    "笔记本电脑": ("Laptop", "노트북"),
    "无人机": ("Drone", "드론"),
    "投影仪": ("Projector", "프로젝터"),
    "摄像机": ("Video camera", "캠코더"),
    "摄影灯": ("Photography light", "촬영용 조명"),
    "摄影器材": ("Photography equipment", "촬영 장비"),
    "扫地机": ("Robot vacuum", "로봇청소기"),
    "运动相机": ("Action camera", "액션캠"),
    "智能手表": ("Smart watch", "스마트워치"),
    "稳定器": ("Gimbal stabilizer", "짐벌 스태빌라이저"),
    "闪光灯": ("Flash light", "플래시 조명"),
    "三脚架": ("Tripod", "삼각대"),
    "车载播放器": ("Car media player", "차량용 플레이어"),
    "液晶手写板": ("LCD writing tablet", "LCD 필기 태블릿"),
    "激光雕刻机": ("Laser engraver", "레이저 각인기"),
    "3D打印机": ("3D printer", "3D 프린터"),
    "医疗器械": ("Medical device", "의료기기"),
    "医疗用品": ("Medical supplies", "의료용품"),
    "器具器械": ("Instruments & devices", "기구·기기"),
    "齿科材料": ("Dental materials", "치과 재료"),
    "医药部外品": ("Quasi-drug", "의약부외품"),
    # ---- 化妆品细分 ----
    "口红类": ("Lipstick category", "립스틱류"),
    "粉底类": ("Foundation category", "파운데이션류"),
    "粉饼类": ("Pressed powder category", "팩트류"),
    "洁面类": ("Cleanser category", "클렌저류"),
    "洗发类": ("Shampoo category", "샴푸류"),
    "面膜类": ("Face mask category", "마스크팩류"),
    "香水类": ("Perfume category", "향수류"),
    "香皂类": ("Soap category", "비누류"),
    "美发类": ("Hair care category", "헤어케어류"),
    "化妆水类": ("Toner category", "토너류"),
    "化妆油类": ("Facial oil category", "페이스 오일류"),
    "口腔清洁类": ("Oral care category", "구강청결류"),
    "指甲化妆品类": ("Nail cosmetics category", "네일 화장품류"),
    "沐浴化妆品类": ("Bath cosmetics category", "바디 화장품류"),
    "面霜乳液类": ("Cream & lotion category", "크림·로션류"),
    # ---- 计费 / 重量 ----
    "运费": ("Freight", "운임"),
    "首重": ("First weight charge", "최초중량 요금"),
    "续重": ("Additional weight charge", "추가중량 요금"),
    "分区": ("Zone", "구역"),
    "参考时效": ("Reference transit time", "참고 배송기간"),
    "申报价值": ("Declared value", "신고가액"),
    "最低计费重(KG)": ("Min chargeable weight (KG)", "최저 과금 중량(KG)"),
    "进位制(KG)": ("Weight rounding (KG)", "중량 반올림(KG)"),
    "重量(KG)": ("Weight (KG)", "중량(KG)"),
    "重量（KG）": ("Weight (KG)", "중량(KG)"),
    "保价服务费(RMB/票)": ("Insurance fee (RMB/shipment)", "보험료(RMB/건)"),
    "签名服务费(RMB/票)": ("Signature fee (RMB/shipment)", "서명 수수료(RMB/건)"),
    "抽真空操作费": ("Vacuum packing fee", "진공포장 수수료"),
    "按照实际使用计费": ("Billed by actual usage", "실제 사용량 기준 과금"),
    "以上为含油价格": ("Prices above include fuel surcharge", "위 가격은 유류할증료 포함"),
    "以上为含油价格；": ("Prices above include fuel surcharge", "위 가격은 유류할증료 포함"),
    "7KG以上": ("Over 7KG", "7KG 초과"),
    # ---- 仓储服务 ----
    "入库卸货": ("Inbound unloading", "입고 하역"),
    "入库套袋": ("Inbound bagging", "입고 봉투포장"),
    "入库装盒": ("Inbound boxing", "입고 박스포장"),
    "入库质检": ("Inbound quality check", "입고 검품"),
    "入库贴sku标签": ("Inbound SKU labeling", "입고 SKU 라벨 부착"),
    "退仓下架": ("Warehouse removal", "창고 하차"),
    "退仓装箱": ("Warehouse repacking", "창고 재포장"),
    "入库清点上架（必选项）": ("Inbound counting & shelving (required)", "입고 수량확인·진열(필수)"),
    "入库剪尺码标/吊牌": ("Inbound size-label/tag cutting", "입고 사이즈라벨/택 제거"),
    "入库商品退仓下架，二次清点数量": ("Removal & re-count of inbound goods", "입고 상품 하차 후 재수량 확인"),
    "到货产品详情拍照": ("Product detail photo on arrival", "도착 상품 상세 촬영"),
    "代打印文件（A4）": ("Document printing (A4)", "서류 대리 인쇄(A4)"),
    "剪标数量": ("Label-cut quantity", "라벨 제거 수량"),
    "标签数量": ("Label quantity", "라벨 수량"),
    "新装吊牌": ("New hang tag", "신규 행택 부착"),
    "更换吊牌": ("Replace hang tag", "행택 교체"),
    "来货加装吊牌": ("Hang tag attachment on arrival", "도착 상품 행택 부착"),
    "商品体积": ("Product volume", "상품 부피"),
    "商品数量": ("Product quantity", "상품 수량"),
    "订单数量": ("Order quantity", "주문 수량"),
    "文件数量": ("Document quantity", "서류 수량"),
    "装箱数量": ("Boxed quantity", "박스 수량"),
    "库龄阶梯（天）": ("Storage age tier (days)", "보관일수 구간(일)"),
    "纸箱": ("Carton", "골판지 상자"),
    "气泡袋": ("Bubble bag", "에어캡 봉투"),
    "免费提供": ("Provided free", "무료 제공"),
    # ---- 地区 ----
    "东马": ("East Malaysia", "동말레이시아"),
    "西马": ("West Malaysia", "서말레이시아"),
    "偏远区域": ("Remote area", "원격지역"),
    "偏远地区": ("Remote area", "원격지역"),
    "其他区域": ("Other areas", "기타 지역"),
    "不可达": ("Not deliverable", "배송 불가"),
    "韩国偏远地区": ("Remote areas in South Korea", "한국 원격지역"),
    "美国偏远邮编地区": ("Remote ZIP areas in the US", "미국 원격우편지역"),
    "英国偏远地区邮编": ("UK remote postcodes", "영국 원격우편번호"),
    "日本偏远地区邮编": ("Japan remote postcodes", "일본 원격우편번호"),
    "智利可达邮编": ("Chile serviceable postcodes", "칠레 배송가능 우편번호"),
    "澳大利亚分区邮编": ("Australia zone postcodes", "호주 구역 우편번호"),
    "阿根廷分区邮编": ("Argentina zone postcodes", "아르헨티나 구역 우편번호"),
    "不可到地区清单": ("Undeliverable areas list", "배송불가 지역 목록"),
    "国家/地区": ("Country / Region", "국가/지역"),
    # ---- 品名申报 ----
    "中文品名": ("Chinese product name", "중국어 품명"),
    "英文品名": ("English product name", "영문 품명"),
    "标品品名以及建议申报价值": ("Standard product names & suggested declared value", "표준 품명 및 권장 신고가액"),
    "渠道说明": ("Channel notes", "채널 설명"),
    "渠道使用说明": ("Channel usage notes", "채널 사용 안내"),
    "尺寸表": ("Size table", "사이즈 표"),
    # ---- 清单 ----
    "禁运品清单": ("Prohibited items list", "운송금지품 목록"),
    "禁限运物品": ("Prohibited / restricted items", "금지·제한 운송물품"),
    "主要禁限运品清单": ("Main prohibited / restricted items list", "주요 금지·제한 운송물품 목록"),
    "日本线路禁运品清单": ("Japan line prohibited items list", "일본 노선 운송금지품 목록"),
    "墨西哥违禁品清单": ("Mexico prohibited items list", "멕시코 금지품 목록"),
    "航空限制品": ("Air-restricted items", "항공 제한품"),
    "清关禁运品": ("Customs-prohibited items", "통관 금지품"),
    "清关限制品": ("Customs-restricted items", "통관 제한품"),
    "知识产权网": ("IP rights website", "지식재산권 사이트"),
    "监管对象": ("Regulated subject", "규제 대상"),
    "法律定义": ("Legal definition", "법적 정의"),
    # ---- 章节标题（一~十二） ----
    "一、计费方式": ("1. Billing method", "1. 과금 방식"),
    "一、计费重量": ("1. Chargeable weight", "1. 과금 중량"),
    "二、是否包油": ("2. Fuel surcharge included", "2. 유류할증료 포함 여부"),
    "二、走货属性": ("2. Shipping attributes", "2. 운송 속성"),
    "三、服务国家": ("3. Service countries", "3. 서비스 국가"),
    "三、清关禁运品": ("3. Customs-prohibited items", "3. 통관 금지품"),
    "三、禁限运物品": ("3. Prohibited / restricted items", "3. 금지·제한 운송물품"),
    "四、尺寸限制": ("4. Size limits", "4. 사이즈 제한"),
    "四、申报价值": ("4. Declared value", "4. 신고가액"),
    "四、申报价值与注意事项": ("4. Declared value & notes", "4. 신고가액 및 유의사항"),
    "四、申报价值和注意事项": ("4. Declared value & notes", "4. 신고가액 및 유의사항"),
    "五、服务范围": ("5. Service coverage", "5. 서비스 범위"),
    "五、走货属性": ("5. Shipping attributes", "5. 운송 속성"),
    "五、走货属性和包装要求": ("5. Shipping attributes & packaging requirements", "5. 운송 속성 및 포장 요건"),
    "六、重量要求": ("6. Weight requirements", "6. 중량 요건"),
    "六、附加费说明": ("6. Surcharge notes", "6. 추가요금 안내"),
    "七、下单要求": ("7. Order requirements", "7. 주문 요건"),
    "七、尺寸要求": ("7. Size requirements", "7. 사이즈 요건"),
    "八、赔偿说明": ("8. Compensation notes", "8. 보상 안내"),
    "八、退件重派": ("8. Return & redelivery", "8. 반송·재배송"),
    "八、派送地址要求": ("8. Delivery address requirements", "8. 배송 주소 요건"),
    "九、赔偿标准": ("9. Compensation standard", "9. 보상 기준"),
    "九、退件重派": ("9. Return & redelivery", "9. 반송·재배송"),
    "十、查询网址": ("10. Tracking website", "10. 조회 웹사이트"),
    "十、赔偿标准": ("10. Compensation standard", "10. 보상 기준"),
    "十、声明": ("10. Statement", "10. 고지"),
    "十一、其他要求": ("11. Other requirements", "11. 기타 요건"),
    "十一、查询网址": ("11. Tracking website", "11. 조회 웹사이트"),
    "十二、其他要求": ("12. Other requirements", "12. 기타 요건"),
    "1. 计费方式": ("1. Billing method", "1. 과금 방식"),
    "2. 申报价值": ("2. Declared value", "2. 신고가액"),
    "2.赔偿标准：": ("2. Compensation standard:", "2. 보상 기준:"),
    "3. 派送地址": ("3. Delivery address", "3. 배송 주소"),
    "3.附加费说明": ("3. Surcharge notes", "3. 추가요금 안내"),
    "4. 申报价值": ("4. Declared value", "4. 신고가액"),
    "4. 退件重派": ("4. Return & redelivery", "4. 반송·재배송"),
    "4.免赔情形：": ("4. Non-compensable cases:", "4. 면책 사유:"),
    "4、赔偿资料要求：": ("4. Required claim documents:", "4. 필요 보상 서류:"),
    "5. 保险服务": ("5. Insurance service", "5. 보험 서비스"),
    "5. 派送地址": ("5. Delivery address", "5. 배송 주소"),
    "6. 赔偿标准": ("6. Compensation standard", "6. 보상 기준"),
    "6. 退件重派": ("6. Return & redelivery", "6. 반송·재배송"),
    "7. 保险服务": ("7. Insurance service", "7. 보험 서비스"),
    "8. 赔偿标准": ("8. Compensation standard", "8. 보상 기준"),
    "9. 追踪查询": ("9. Tracking", "9. 배송 조회"),
    "9.杂项危险品": ("9. Miscellaneous dangerous goods", "9. 기타 위험물"),
    "2.尺寸要求": ("2. Size requirements", "2. 사이즈 요건"),
    "7.尺寸要求": ("7. Size requirements", "7. 사이즈 요건"),
    "1.电池类": ("1. Battery category", "1. 배터리류"),
    "2.只接受普货": ("2. Only general cargo accepted", "2. 일반화물만 접수"),
    "2.只接受普货；": ("2. Only general cargo accepted", "2. 일반화물만 접수"),
    "3.索赔资料以及要求：": ("3. Claim documents & requirements:", "3. 보상 서류 및 요건:"),
    "提取后索赔资料要求:": ("Post-pickup claim document requirements:", "수거 후 보상 서류 요건:"),
    "4.免赔情形：": ("4. Non-compensable cases:", "4. 면책 사유:"),
    "5、以下情况不提供赔偿：": ("5. No compensation in the following cases:", "5. 아래 경우 보상 불가:"),
    "10.以下情况恕不收理索赔申请": ("10. Claims not accepted in the following cases", "10. 아래 경우 보상 접수 불가"),
    "1、不提供退回国内服务；": ("1. No return-to-China service", "1. 중국 반송 서비스 없음"),
    "1.本渠道不提供从国外退回国内的服务；": ("1. No return-from-overseas service on this line", "1. 본 노선은 해외→중국 반송 불가"),
    "1）暂不提供保险服务。": ("1) Insurance service not available for now", "1) 보험 서비스 미제공"),
    "1.烟草：如卷烟、雪茄、烟丝等": ("1. Tobacco: cigarettes, cigars, cut tobacco, etc.", "1. 담배: 궐련, 시가, 각초 등"),
    "③税务计算公式": ("3. Tax calculation formula", "3. 세금 계산 공식"),
    "异形件示例图": ("Irregular-shape parcel example", "이형 화물 예시"),
    "异形件图片链接": ("Irregular-shape parcel image link", "이형 화물 이미지 링크"),
    "详情请点击查看“异形票示例”": ("Click to view irregular ticket example", "이형 티켓 예시 보기"),
    "详情请点击查看“禁寄物品指导目录”": ("Click to view prohibited mailing guide", "금지물품 안내 목록 보기"),
    "【国家税率对应表】": ("[Country tax rate table]", "[국가 세율 대응표]"),
    "出库前拦截订单": ("Pre-shipment order interception", "출고 전 주문 차단"),
    "服务商：Yodel": ("Carrier: Yodel", "배송사: Yodel"),
    "服务商：Colissimo": ("Carrier: Colissimo", "배송사: Colissimo"),
    "服务商：DHL Paket": ("Carrier: DHL Paket", "배송사: DHL Paket"),
    "服务商：DHL Parcel(NL)": ("Carrier: DHL Parcel (NL)", "배송사: DHL Parcel(NL)"),
    "服务商：CTT Express": ("Carrier: CTT Express", "배송사: CTT Express"),
    "特快F价(预上网)": ("Express F rate (pre-scan)", "특급 F 요금(선스캔)"),
    "特快带电(预上网)": ("Express battery (pre-scan)", "특급 배터리(선스캔)"),
    "特快普货(预上网)": ("Express general (pre-scan)", "특급 일반(선스캔)"),
    "特快特敏(预上网)": ("Express special-sensitive (pre-scan)", "특급 특민(선스캔)"),
    "特快特货(预上网)": ("Express special (pre-scan)", "특급 특수(선스캔)"),
    "特快纯电(预上网)": ("Express pure-battery (pre-scan)", "특급 순수배터리(선스캔)"),
    "费率0.7% 最低收费5元": ("Rate 0.7%, min charge ¥5", "수수료율 0.7%, 최저 5위안"),
    "0.5元起/pcs": ("From ¥0.5/pcs", "0.5위안부터/pcs"),
    "20元/Cbm": ("¥20/CBM", "20위안/CBM"),
    # ---- 补充常用短词 / 单价 ----
    "备注": ("Remark", "비고"),
    "备注说明：": ("Remarks:", "비고:"),
    "不接受物品：": ("Items not accepted:", "접수 불가 품목:"),
    "可接收物品：": ("Accepted items:", "접수 가능 품목:"),
    "二、航空限制品": ("2. Air-restricted items", "2. 항공 제한품"),
    "四、清关限制品": ("4. Customs-restricted items", "4. 통관 제한품"),
    "10.禁限寄物品": ("10. Prohibited / restricted items", "10. 금지·제한 운송물품"),
    "衍生用品": ("Derivative products", "파생 용품"),
    "2）其他国家": ("2) Other countries", "2) 기타 국가"),
    "牙膏等": ("Toothpaste, etc.", "치약 등"),
    "面膜等": ("Face masks, etc.", "마스크팩 등"),
    "口红、润唇膏等": ("Lipstick, lip balm, etc.", "립스틱, 립밤 등"),
    "纺织品、石头等": ("Textiles, stones, etc.", "섬유, 돌 등"),
    "1元/张": ("¥1/sheet", "1위안/장"),
    "5元/单": ("¥5/order", "5위안/건"),
    "8元/箱": ("¥8/box", "8위안/박스"),
    "1元/pcs": ("¥1/pcs", "1위안/pcs"),
    "3元/pcs": ("¥3/pcs", "3위안/pcs"),
    "0.2元/pcs": ("¥0.2/pcs", "0.2위안/pcs"),
    "0.5元/pcs": ("¥0.5/pcs", "0.5위안/pcs"),
    "0.8元/pcs": ("¥0.8/pcs", "0.8위안/pcs"),
}

# ---------------- 提取唯一中文字符串 ----------------
def is_num(v):
    s = str(v).strip()
    if not s:
        return True
    s2 = s.replace(',', '').replace('¥', '').replace('￥', '').replace(' ', '').replace('/', '').replace('≤', '').replace('＜', '').replace('>', '').replace('<', '').replace('W', '').replace('kg', '').replace('KG', '').replace('cm', '').replace('元', '').replace('个', '').replace('_', '').replace('-', '').replace('.', '').replace('％', '').replace('%', '')
    return s2 == '' or s2.replace('.', '').isdigit()

def load_data():
    txt = open(DATA_JS, encoding='utf-8').read()
    m = re.search(r'window\.YUNMANMAN_DATA\s*=\s*(\{.*?\});?\s*$', txt, re.S)
    return json.loads(m.group(1))

def load_country_map():
    txt = open(I18N_JS, encoding='utf-8').read()
    m = re.search(r'window\.COUNTRY_MAP\s*=\s*(\{.*?\});', txt, re.S)
    return json.loads(m.group(1)) if m else {}

def extract_unique(data, cmap):
    vals = set()
    for s in data['sheets']:
        if s.get('type') == 'table':
            for r in s.get('rows', []):
                for ci in range(len(s.get('headers', []))):
                    v = str(r[ci]).strip() if ci < len(r) and r[ci] is not None else ''
                    if v and CJK.search(v) and not is_num(v) and v not in cmap and not re.fullmatch(r'[0-9]+区', v):
                        vals.add(v)
        elif s.get('type') == 'text':
            for b in s.get('blocks', []):
                b = b.strip()
                if b and CJK.search(b):
                    vals.add(b)
    return vals

def pattern_derivable(v):
    return bool(
        re.fullmatch(r'\d+-\d+工作日', v)
        or re.fullmatch(r'\d+个工作日', v)
        or re.fullmatch(r'\d+区', v)
    )

def main():
    data = load_data()
    cmap = load_country_map()
    vals = extract_unique(data, cmap)

    # 结果合并：先手工词典，再机器翻译兜底
    result = {}          # chinese -> {"en":.., "ko":..}
    for k, (en, ko) in HAND_DICT.items():
        if k in vals:
            result[k] = {"en": en, "ko": ko}

    need_mt = []
    for v in vals:
        if v in result:
            continue
        if pattern_derivable(v):
            continue
        need_mt.append(v)
    need_mt.sort(key=lambda x: (len(x), x))

    print("唯一中文字符串:", len(vals))
    print("手工词典命中:", len(result))
    print("模式推导(时效/分区):", sum(1 for v in vals if pattern_derivable(v)))
    print("需机器翻译:", len(need_mt))

    # 载入缓存
    cache = {}
    if os.path.exists(CACHE_JSON):
        cache = json.load(open(CACHE_JSON, encoding='utf-8'))

    def mt_one(text, lang):
        lp = {'en': 'zh-CN|en', 'ko': 'zh-CN|ko'}[lang]
        url = 'https://api.mymemory.translated.net/get?' + urllib.parse.urlencode({
            'q': text, 'langpair': lp, 'de': 'ops@youmanman.com'})
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        d = json.load(urllib.request.urlopen(req, timeout=30))
        if d.get('responseStatus') not in (200, '200'):
            return None
        out = d.get('responseData', {}).get('translatedText', '')
        return out if out else None

    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    tasks = []
    for v in need_mt:
        entry = cache.get(v, {})
        for lang in ('en', 'ko'):
            if lang not in entry or not entry[lang]:
                tasks.append((v, lang))

    print("待翻译任务数:", len(tasks), flush=True)

    lock = threading.Lock()
    translated = 0
    failed = 0
    done = 0

    def work(item):
        v, lang = item
        for attempt in range(3):
            try:
                t = mt_one(v, lang)
                if t:
                    return (v, lang, t, None)
                time.sleep(0.5)
            except Exception as e:
                if attempt == 2:
                    return (v, lang, None, str(e))
                time.sleep(0.8)
        return (v, lang, None, 'retry exhausted')

    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = [ex.submit(work, t) for t in tasks]
        for fut in as_completed(futures):
            v, lang, t, err = fut.result()
            with lock:
                done += 1
                entry = cache.setdefault(v, {})
                if t:
                    entry[lang] = t
                    if entry.get('en') and entry.get('ko'):
                        translated += 1
                else:
                    failed += 1
                if done % 50 == 0:
                    json.dump(cache, open(CACHE_JSON, 'w', encoding='utf-8'), ensure_ascii=False)
                    print("  ... %d/%d (translated %d, failed %d)" % (done, len(tasks), translated, failed), flush=True)

    json.dump(cache, open(CACHE_JSON, 'w', encoding='utf-8'), ensure_ascii=False)

    # 合并缓存里的 MT 结果
    for v in need_mt:
        entry = cache.get(v, {})
        en = entry.get('en')
        ko = entry.get('ko')
        if en or ko:
            result[v] = {"en": en or "", "ko": ko or ""}

    # 写 JS
    lines = []
    lines.append('/* 表格内容三语翻译映射（自动生成，请勿手改；改动请运行 build_content_i18n.py） */')
    lines.append('window.CONTENT_MAP = {')
    entries = []
    for k in sorted(result.keys(), key=lambda x: (len(x), x)):
        en = (result[k].get('en') or '').replace('\\', '\\\\').replace('"', '\\"')
        ko = (result[k].get('ko') or '').replace('\\', '\\\\').replace('"', '\\"')
        kk = k.replace('\\', '\\\\').replace('"', '\\"')
        entries.append('  "%s": {"en": "%s", "ko": "%s"}' % (kk, en, ko))
    lines.append(',\n'.join(entries))
    lines.append('};')
    open(OUT_JS, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

    print("\n=== 完成 ===")
    print("总映射条目:", len(result))
    print("MT 本次新翻译:", translated, "| MT 失败:", failed)
    print("未覆盖(回退中文):", len(vals) - len(result) - sum(1 for v in vals if pattern_derivable(v)))
    print("输出:", OUT_JS)

if __name__ == '__main__':
    main()
