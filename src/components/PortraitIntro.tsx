import { useEffect, useState } from 'react'
import { PixelSprite } from './PixelSprite'
import type { Quote, StockSprite } from '../data/types'
import { api } from '../api/base'
import { formatMoney } from '../utils/quotes'
import { quoteIdOf } from '../utils/quoteId'

/**
 * 图鉴肖像：精灵展示 ↔ 公司简介文字 定时切换。
 * 切换时精灵以像素化方式「消散」，浮现一段公司介绍
 * （成立时间、高管、总市值、总股本、主营业务等），随后再消散还原成精灵。
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

function buildIntro(stock: StockSprite, info: CompanyInfo | null, quote: Quote): string {
  const name = stock.name
  const segs: string[] = []

  const found = info?.foundDate ? `成立于${fmtFoundDate(info.foundDate)}` : ''
  const listing = `于${stock.market === 'US' ? '美股' : stock.market === 'HK' ? '港交所' : 'A股'}上市`
  segs.push([name, found, listing].filter(Boolean).join('') + '。')

  const biz =
    info?.mainBusiness
      ? info.mainBusiness.replace(/\s+/g, '').slice(0, 60)
      : `主营${stock.weightLabel}`
  segs.push(`主营业务：${biz}${info?.mainBusiness && info.mainBusiness.replace(/\s+/g, '').length > 60 ? '等' : ''}。`)

  if (info?.chairman) segs.push(`现任${info.chairman}。`)
  if (quote.marketCap && quote.marketCap > 0) segs.push(`当前总市值${formatMoney(quote.marketCap)}。`)
  if (info?.totalShares && info.totalShares > 0) segs.push(`总股本约${fmtShares(info.totalShares)}。`)

  return segs.join('')
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
  const [showText, setShowText] = useState(false)
  const [info, setInfo] = useState<CompanyInfo | null>(null)

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

  // 定时切换：精灵 ↔ 文字介绍
  useEffect(() => {
    if (!seen) return
    setShowText(false)
    const t = window.setInterval(() => setShowText((v) => !v), 7000)
    return () => window.clearInterval(t)
  }, [stock.id, seen])

  if (!seen) {
    return (
      <div className="portrait">
        <PixelSprite stock={stock} size="xl" silhouette bounce={false} />
      </div>
    )
  }

  const text = buildIntro(stock, info, quote)

  return (
    <div className="portrait portrait-intro">
      <div className={`pi-layer pi-sprite ${showText ? 'pi-hide' : 'pi-show'}`}>
        <PixelSprite stock={stock} size="xl" bounce />
        {caught ? <i className="ball caught big" /> : null}
      </div>
      <p className={`pi-layer pi-text ${showText ? 'pi-show' : 'pi-hide'}`}>{text}</p>
    </div>
  )
}
