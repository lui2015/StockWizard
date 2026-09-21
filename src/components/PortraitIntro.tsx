import { useEffect, useRef, useState } from 'react'
import { PixelSprite } from './PixelSprite'
import type { Quote, StockSprite } from '../data/types'
import { api } from '../api/base'
import { changePct, dayRange, formatMoney, formatPercent, formatPrice, formatRatio } from '../utils/quotes'
import { quoteIdOf } from '../utils/quoteId'

/**
 * 图鉴肖像：精灵展示 ↔ 多页公司信息 定时/点击切换。
 * 页 0 为精灵；页 1 公司简介（成立/上市/主营/高管/市值/股本），
 * 页 2 行情快照（价格/涨跌/成交/市值），页 3 估值与盈利。
 * 点击肖像切换下一页，切换时以像素化方式「消散」过渡。
 */

type F10Row = Record<string, unknown>

interface CompanyInfo {
  foundDate: string
  chairman: string
  mainBusiness: string
  totalShares: number | null // 单位：股
}

function pick(row: F10Row | null | undefined, keys: string[]): string {
  if (!row) return ''
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

/** 图鉴股票 → 东财 SECUCODE（美股无 F10，返回 null） */
function secuCodeOf(stock: StockSprite): string | null {
  if (stock.market === 'HK') return `${stock.code.replace(/\.HK$/i, '').padStart(5, '0')}.HK`
  if (stock.market !== 'CN') return null
  const code = stock.code
  return code.startsWith('6') || code.startsWith('9') ? `${code}.SH` : `${code}.SZ`
}

function fmtFoundDate(raw: string): string {
  const m = raw.match(/(\d{4})-(\d{2})/)
  if (m) return `${m[1]}年${Number(m[2])}月`
  return raw.slice(0, 10)
}

function fmtShares(n: number): string {
  const yi = n / 1e8
  if (yi >= 1e4) return `${(yi / 1e4).toFixed(2)}万亿股`
  return `${yi.toFixed(2)}亿股`
}

/** 拉取公司概况（成立时间/高管/主营业务）与总股本，任一失败都不阻塞 */
async function fetchCompanyInfo(stock: StockSprite): Promise<CompanyInfo> {
  const info: CompanyInfo = { foundDate: '', chairman: '', mainBusiness: '', totalShares: null }
  const secu = secuCodeOf(stock)
  if (!secu) return info
  const isHk = secu.endsWith('.HK')
  const filter = encodeURIComponent(`(SECUCODE="${secu}")`)
  const orgUrl = isHk
    ? api(
        `/radar/finv1?reportName=RPT_HKF10_INFO_ORGPROFILE&columns=ALL&filter=${filter}&pageNumber=1&pageSize=1&source=F10&client=PC`,
      )
    : api(
        `/radar/fin?type=RPT_F10_BASIC_ORGINFO&sty=APP_F10_BASIC_ORGINFO&filter=${filter}&p=1&ps=1&sr=-1&st=SECUCODE&source=HSF10&client=PC`,
      )
  const sharesUrl = api(
    `/radar/quote?secid=${encodeURIComponent(quoteIdOf(stock))}&invt=2&fltt=2&fields=f84`,
  )

  const [orgRes, sharesRes] = await Promise.allSettled([
    fetch(orgUrl, { headers: { Accept: 'application/json' } }),
    fetch(sharesUrl, { headers: { Accept: 'application/json' } }),
  ])

  if (orgRes.status === 'fulfilled' && orgRes.value.ok) {
    try {
      const j = (await orgRes.value.json()) as { result?: { data?: F10Row[] } }
      const row = j.result?.data?.[0] ?? null
      info.foundDate = pick(row, ['FOUND_DATE', 'FOUNDING_DATE', 'FOUNDING_E_DATE', 'FOUNDINGDATE'])
      info.chairman = pick(row, ['CHAIRMAN', 'LEGAL_REP', 'CORP_REPRESENTATIVE', 'LEGAL_PERSON'])
      info.mainBusiness = pick(row, ['MAIN_BUSINESS', 'BUSINESS_SCOPE', 'MAIN_BUSINESS_CONTENT'])
    } catch {
      /* 概况缺失时用本地字段兜底 */
    }
  }

  if (sharesRes.status === 'fulfilled' && sharesRes.value.ok) {
    try {
      const j = (await sharesRes.value.json()) as { data?: { f84?: unknown } }
      const v = j.data?.f84
      if (typeof v === 'number' && v > 0) info.totalShares = v
      else if (typeof v === 'string' && Number(v) > 0) info.totalShares = Number(v)
    } catch {
      /* 股本缺失时跳过 */
    }
  }

  return info
}

/** 页 1：公司简介 */
function pageIntro(stock: StockSprite, info: CompanyInfo | null, quote: Quote): string {
  const segs: string[] = []

  const found = info?.foundDate ? `成立于${fmtFoundDate(info.foundDate)}` : ''
  const listing = `于${stock.market === 'US' ? '美股' : stock.market === 'HK' ? '港交所' : 'A股'}上市`
  segs.push([stock.name, found, listing].filter(Boolean).join('') + '。')

  const bizRaw = info?.mainBusiness ? info.mainBusiness.replace(/\s+/g, '') : ''
  segs.push(`主营业务：${bizRaw ? bizRaw.slice(0, 60) + (bizRaw.length > 60 ? '等' : '') : `主营${stock.weightLabel}`}。`)

  if (info?.chairman) segs.push(`现任${info.chairman}。`)
  if (quote.marketCap && quote.marketCap > 0) segs.push(`当前总市值${formatMoney(quote.marketCap)}。`)
  if (info?.totalShares && info.totalShares > 0) segs.push(`总股本约${fmtShares(info.totalShares)}。`)

  return segs.join('')
}

/** 页 2：行情快照 */
function pageQuote(stock: StockSprite, quote: Quote): string {
  const segs: string[] = []
  const pct = changePct(quote)
  const range = dayRange(quote)

  segs.push(`今日${stock.name}报${formatPrice(quote.price)}。`)
  if (Number.isFinite(pct)) {
    segs.push(`${pct >= 0 ? '上涨' : '下跌'}${Math.abs(pct).toFixed(2)}%，日内${formatPrice(range.low)}至${formatPrice(range.high)}区间运行。`)
  }
  if (quote.amount && quote.amount > 0) segs.push(`成交额${formatMoney(quote.amount)}。`)
  if (quote.turnover && quote.turnover > 0) segs.push(`换手率${formatPercent(quote.turnover)}。`)
  if (quote.floatCap && quote.floatCap > 0) segs.push(`流通市值${formatMoney(quote.floatCap)}。`)

  return segs.join('')
}

/** 页 3：估值与盈利 */
function pageValue(stock: StockSprite, quote: Quote): string {
  const segs: string[] = []

  segs.push(`${stock.name}估值方面：`)
  const pe = quote.peTtm ?? quote.pe
  if (pe && pe > 0) segs.push(`市盈率TTM约${formatRatio(pe)}倍。`)
  if (quote.pb && quote.pb > 0) segs.push(`市净率${formatRatio(quote.pb)}倍。`)
  if (quote.roe != null) segs.push(`净资产收益率ROE${formatPercent(quote.roe)}。`)
  if (quote.eps && quote.eps > 0) segs.push(`每股收益${formatRatio(quote.eps)}元。`)
  if (quote.dividendYield != null && quote.dividendYield > 0) segs.push(`股息率${formatPercent(quote.dividendYield)}。`)

  return segs.join('')
}

/** 组装所有文字页，内容不足的页自动跳过；至少保留公司简介页 */
function buildPages(stock: StockSprite, info: CompanyInfo | null, quote: Quote): string[] {
  const pages = [pageIntro(stock, info, quote)]
  if (quote.live) {
    pages.push(pageQuote(stock, quote))
    pages.push(pageValue(stock, quote))
  }
  return pages
}

export function PortraitIntro({
  stock,
  seen,
  caught,
  quote,
}: {
  stock: StockSprite
  seen: boolean
  caught: boolean
  quote: Quote
}) {
  // 页 0 = 精灵，1..N = 文字页
  const [page, setPage] = useState(0)
  const [info, setInfo] = useState<CompanyInfo | null>(null)
  const [pages, setPages] = useState<string[]>([])

  // 拉取公司 F10 资料
  useEffect(() => {
    if (!seen) return
    let alive = true
    setInfo(null)
    fetchCompanyInfo(stock)
      .then((v) => {
        if (alive) setInfo(v)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [stock.id, stock.code, stock.market, seen])

  const textPages = seen ? pages : []
  // F10 异步到达后页数会变化，用 ref 让定时器/点击始终取最新总页数
  const totalRef = useRef(1)
  totalRef.current = textPages.length + 1

  // 定时切换下一页
  useEffect(() => {
    if (!seen) return
    setPage(0)
    setPages(buildPages(stock, null, quote))
    const t = window.setInterval(() => setPage((v) => (v + 1) % totalRef.current), 7000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.id, seen])

  // F10 资料到达后刷新文字页（页数可能变化）
  useEffect(() => {
    if (!seen) return
    setPages(buildPages(stock, info, quote))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.id, info, quote.live, quote.price, quote.marketCap])

  if (!seen) {
    return (
      <div className="portrait">
        <PixelSprite stock={stock} size="xl" silhouette bounce={false} />
      </div>
    )
  }

  const total = textPages.length + 1
  const showSprite = page === 0
  const text = textPages[(page - 1 + textPages.length) % Math.max(textPages.length, 1)] ?? ''

  return (
    <div
      className="portrait portrait-intro"
      role="button"
      tabIndex={0}
      onClick={() => setPage((v) => (v + 1) % total)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setPage((v) => (v + 1) % total)
        }
      }}
      aria-label="点击切换股票介绍"
    >
      <div className={`pi-layer pi-sprite ${showSprite ? 'pi-show' : 'pi-hide'}`}>
        <PixelSprite stock={stock} size="xl" bounce />
        {caught ? <i className="ball caught big" /> : null}
      </div>
      {!showSprite ? (
        <p key={page} className="pi-layer pi-text pi-show">
          {text}
        </p>
      ) : null}
      <span className="pi-hint">点击切换 ▸</span>
      <span className="pi-dots">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i === page ? 'on' : ''} />
        ))}
      </span>
    </div>
  )
}
