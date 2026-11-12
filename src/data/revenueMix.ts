/**
 * 营收构成约数（图鉴整理）：港股/美股无结构化分部收入接口，
 * 按近年公开财报的业务结构四舍五入，仅作娱乐向参考，非精确财报口径。
 * A股优先使用东财 F10 真实主营构成，此表仅作接口失败时的兜底。
 */
export interface RevenueSlice {
  name: string
  ratio: number
}

export const REVENUE_MIX: Record<string, RevenueSlice[]> = {
  aapl: [
    { name: 'iPhone', ratio: 51 },
    { name: '服务', ratio: 25 },
    { name: '可穿戴 / Mac / iPad', ratio: 24 },
  ],
  msft: [
    { name: '智能云（Azure）', ratio: 42 },
    { name: '生产力与业务流程（Office）', ratio: 33 },
    { name: '更多个人计算（Windows）', ratio: 25 },
  ],
  nvda: [
    { name: '数据中心', ratio: 88 },
    { name: '游戏', ratio: 9 },
    { name: '专业可视化 / 汽车', ratio: 3 },
  ],
  tsla: [
    { name: '汽车', ratio: 79 },
    { name: '能源生产与存储', ratio: 11 },
    { name: '服务及其他', ratio: 10 },
  ],
  googl: [
    { name: '搜索及其他广告', ratio: 57 },
    { name: 'Google Cloud', ratio: 13 },
    { name: 'YouTube 广告', ratio: 11 },
    { name: '订阅设备及其他', ratio: 19 },
  ],
  amzn: [
    { name: '在线商店', ratio: 40 },
    { name: '第三方卖家服务', ratio: 24 },
    { name: 'AWS', ratio: 18 },
    { name: '广告 / 订阅及其他', ratio: 18 },
  ],
  meta: [
    { name: '广告', ratio: 98 },
    { name: 'Reality Labs', ratio: 2 },
  ],
  '0700': [
    { name: '增值服务（游戏 / 社交）', ratio: 50 },
    { name: '金融科技及企业服务', ratio: 32 },
    { name: '网络广告', ratio: 16 },
    { name: '其他', ratio: 2 },
  ],
  baba: [
    { name: '淘天电商', ratio: 44 },
    { name: '云智能', ratio: 12 },
    { name: '国际数字商业', ratio: 12 },
    { name: '本地生活 / 菜鸟及其他', ratio: 32 },
  ],
  jpm: [
    { name: '投行 / 交易 / 资管', ratio: 45 },
    { name: '零售与社区银行', ratio: 33 },
    { name: '商业银行及其他', ratio: 22 },
  ],
  xom: [
    { name: '炼化与销售', ratio: 45 },
    { name: '上游开采', ratio: 38 },
    { name: '化工', ratio: 17 },
  ],
  lly: [
    { name: '糖尿病 / 减重药', ratio: 70 },
    { name: '肿瘤 / 免疫 / 神经', ratio: 22 },
    { name: '其他', ratio: 8 },
  ],
  cat: [
    { name: '建筑机械', ratio: 40 },
    { name: '能源与交通', ratio: 32 },
    { name: '资源机械', ratio: 20 },
    { name: '金融产品及其他', ratio: 8 },
  ],
  meituan: [
    { name: '核心本地商业（外卖 / 到店）', ratio: 74 },
    { name: '新业务（即时零售等）', ratio: 26 },
  ],
  brk: [
    { name: '保险及再保', ratio: 36 },
    { name: '铁路 / 公用事业 / 能源', ratio: 30 },
    { name: '制造与零售服务', ratio: 29 },
    { name: '投资收益及其他', ratio: 5 },
  ],
  amd: [
    { name: '数据中心', ratio: 50 },
    { name: '客户端与游戏', ratio: 35 },
    { name: '嵌入式', ratio: 15 },
  ],
  moutai: [
    { name: '茅台酒', ratio: 86 },
    { name: '系列酒', ratio: 14 },
  ],
  catl: [
    { name: '动力电池系统', ratio: 70 },
    { name: '储能电池系统', ratio: 18 },
    { name: '电池材料及回收 / 其他', ratio: 12 },
  ],
  pingan: [
    { name: '寿险及健康险', ratio: 55 },
    { name: '财产保险', ratio: 25 },
    { name: '银行 / 资管及其他', ratio: 20 },
  ],
  petrochina: [
    { name: '销售（成品油）', ratio: 45 },
    { name: '炼油与化工', ratio: 30 },
    { name: '勘探与生产 / 天然气', ratio: 25 },
  ],
  hengrui: [
    { name: '创新药', ratio: 60 },
    { name: '仿制药', ratio: 32 },
    { name: '授权及海外收入', ratio: 8 },
  ],
  vanke: [
    { name: '房地产开发结算', ratio: 82 },
    { name: '物业服务', ratio: 12 },
    { name: '其他', ratio: 6 },
  ],
  cmb: [
    { name: '零售金融', ratio: 55 },
    { name: '公司金融', ratio: 32 },
    { name: '金融市场 / 资管及其他', ratio: 13 },
  ],
  byd: [
    { name: '汽车及相关产品', ratio: 80 },
    { name: '手机部件及组装', ratio: 17 },
    { name: '电池及其他', ratio: 3 },
  ],
}

/** 雷达发现的常见港股/美股：按股票代码匹配（去掉 .HK 与前导 0） */
const MIX_BY_CODE: Record<string, RevenueSlice[]> = {
  '1810': [
    { name: '智能手机', ratio: 55 },
    { name: 'IoT 与生活消费产品', ratio: 30 },
    { name: '互联网服务', ratio: 10 },
    { name: '智能电动汽车及其他', ratio: 5 },
  ],
  '9988': REVENUE_MIX.baba,
  BABA: REVENUE_MIX.baba,
  '9618': [
    { name: '京东零售', ratio: 85 },
    { name: '京东物流', ratio: 10 },
    { name: '新业务及其他', ratio: 5 },
  ],
  '1024': [
    { name: '线上营销服务', ratio: 55 },
    { name: '直播', ratio: 30 },
    { name: '电商及其他', ratio: 15 },
  ],
  '9888': [
    { name: '在线营销服务', ratio: 55 },
    { name: '智能云 / 智能驾驶及其他', ratio: 45 },
  ],
  '9999': [
    { name: '游戏及相关增值服务', ratio: 78 },
    { name: '云音乐', ratio: 10 },
    { name: '有道 / 创新业务及其他', ratio: 12 },
  ],
  '981': [
    { name: '晶圆代工', ratio: 90 },
    { name: '配套服务及其他', ratio: 10 },
  ],
  '941': [
    { name: '移动通信服务', ratio: 75 },
    { name: '销售产品及其他', ratio: 25 },
  ],
  '2015': [
    { name: '整车销售', ratio: 92 },
    { name: '服务及其他', ratio: 8 },
  ],
  '9866': [
    { name: '整车销售', ratio: 90 },
    { name: '服务及其他', ratio: 10 },
  ],
  '9868': [
    { name: '整车销售', ratio: 91 },
    { name: '服务及其他', ratio: 9 },
  ],
  '1211': REVENUE_MIX.byd,
  '700': REVENUE_MIX['0700'],
  '3690': REVENUE_MIX.meituan,
}

/** 按公司名称匹配的常见企业 */
const MIX_BY_NAME: [RegExp, RevenueSlice[]][] = [
  [/小米/, MIX_BY_CODE['1810']],
  [/阿里/, REVENUE_MIX.baba],
  [/腾讯/, REVENUE_MIX['0700']],
  [/美团/, REVENUE_MIX.meituan],
  [/中芯|华虹/, MIX_BY_CODE['981']],
  [/快手/, MIX_BY_CODE['1024']],
  [/京东/, MIX_BY_CODE['9618']],
  [/百度/, MIX_BY_CODE['9888']],
  [/网易/, MIX_BY_CODE['9999']],
  [/理想|蔚来|小鹏/, MIX_BY_CODE['2015']],
  [/中国移动|中国电信|中国联通/, MIX_BY_CODE['941']],
  [/比亚迪/, REVENUE_MIX.byd],
]

/**
 * 行业典型结构（约数）：雷达新发现的股票没有分部财报数据时，
 * 按名称/行业给出同行业常见的营收结构，仅作娱乐向参考。
 */
const INDUSTRY_TEMPLATES: [RegExp, RevenueSlice[]][] = [
  [/银行/, [{ name: '零售金融', ratio: 55 }, { name: '公司金融', ratio: 32 }, { name: '金融市场及其他', ratio: 13 }]],
  [/保险|人寿|友邦|平安/, REVENUE_MIX.pingan],
  [/证券|券商/, [{ name: '经纪与财富管理', ratio: 40 }, { name: '投行', ratio: 25 }, { name: '自营与资管', ratio: 35 }]],
  [/酒|食品|饮料|乳|茶|消费/, [{ name: '核心产品', ratio: 80 }, { name: '其他产品及渠道', ratio: 20 }]],
  [/药|生物|医疗|健康/, REVENUE_MIX.hengrui],
  [/石油|油气|煤炭|能源|电力/, REVENUE_MIX.petrochina],
  [/地产|置业|物业|基建|水泥/, REVENUE_MIX.vanke],
  [/汽车|整车|车企/, [{ name: '整车销售', ratio: 85 }, { name: '零部件及服务', ratio: 15 }]],
  [/电池|锂电|储能/, REVENUE_MIX.catl],
  [/芯片|半导体|晶圆|电子|光电/, [{ name: '主力产品', ratio: 65 }, { name: '其他产品线', ratio: 25 }, { name: '服务及授权', ratio: 10 }]],
  [/电商|零售|商城|本地生活|外卖/, [{ name: '电商及零售', ratio: 65 }, { name: '云服务及科技', ratio: 15 }, { name: '物流及本地生活', ratio: 20 }]],
  [/游戏|社交|互联|网络|软件|传媒|广告/, [{ name: '增值服务 / 订阅', ratio: 50 }, { name: '广告', ratio: 25 }, { name: '企业服务及其他', ratio: 25 }]],
  [/手机|智能硬件|消费电子/, MIX_BY_CODE['1810']],
  [/钢铁|机械|工程|工业|制造|军工/, [{ name: '主机制造', ratio: 55 }, { name: '零部件及服务', ratio: 30 }, { name: '金融及其他', ratio: 15 }]],
  [/云|软件|SaaS/, [{ name: '云服务', ratio: 50 }, { name: '软件订阅', ratio: 35 }, { name: '服务及其他', ratio: 15 }]],
]

const TYPE_TEMPLATES: Partial<Record<string, RevenueSlice[]>> = {
  finance: REVENUE_MIX.cmb,
  consumer: [{ name: '核心产品', ratio: 80 }, { name: '其他产品及渠道', ratio: 20 }],
  healthcare: REVENUE_MIX.hengrui,
  energy: REVENUE_MIX.petrochina,
  property: REVENUE_MIX.vanke,
  industrials: [{ name: '主机制造', ratio: 55 }, { name: '零部件及服务', ratio: 30 }, { name: '金融及其他', ratio: 15 }],
  tech: [{ name: '主力产品', ratio: 65 }, { name: '其他产品线', ratio: 25 }, { name: '服务及授权', ratio: 10 }],
  internet: [{ name: '增值服务 / 订阅', ratio: 50 }, { name: '广告', ratio: 25 }, { name: '企业服务及其他', ratio: 25 }],
}

export interface RevenueGuess {
  slices: RevenueSlice[]
  /** report = 财报结构约数；industry = 行业典型结构估算 */
  kind: 'report' | 'industry'
}

/** 按 id → 代码 → 名称 → 行业模板，给任意股票找出可展示的营收构成 */
export function guessRevenueMix(stock: {
  id: string
  code: string
  name: string
  category?: string
  weightLabel?: string
  types?: string[]
}): RevenueGuess | null {
  const exact = REVENUE_MIX[stock.id]
  if (exact) return { slices: exact, kind: 'report' }
  const code = stock.code.replace(/\.HK$/i, '').replace(/^0+/, '').toUpperCase()
  const byCode = MIX_BY_CODE[code] ?? MIX_BY_CODE[stock.code.toUpperCase()]
  if (byCode) return { slices: byCode, kind: 'report' }
  const byName = MIX_BY_NAME.find(([re]) => re.test(stock.name))?.[1]
  if (byName) return { slices: byName, kind: 'report' }
  const text = `${stock.name} ${stock.category ?? ''} ${stock.weightLabel ?? ''}`
  const byIndustry = INDUSTRY_TEMPLATES.find(([re]) => re.test(text))?.[1]
  if (byIndustry) return { slices: byIndustry, kind: 'industry' }
  for (const type of stock.types ?? []) {
    const tpl = TYPE_TEMPLATES[type]
    if (tpl) return { slices: tpl, kind: 'industry' }
  }
  return null
}
