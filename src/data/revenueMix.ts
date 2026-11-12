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
