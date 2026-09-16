import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { migrateSector } from '../data/sectors'
import { STOCKS, STOCK_MAP } from '../data/stocks'
import type { Holding, Quote, SaveData, Screen, StockSprite } from '../data/types'
import {
  fetchCloudSave,
  getToken,
  login as apiLogin,
  logout as apiLogout,
  me as apiMe,
  putCloudSave,
  register as apiRegister,
  setToken,
  type AuthUser,
} from '../api/auth'
import { fetchBatchQuotes, fetchLiveQuote } from '../api/eastmoney'
import { quoteIdOf } from '../utils/quoteId'
import { buildInitialQuotes } from '../utils/quotes'
import { quoteFromLive } from '../utils/wildStock'
import { catchRate } from '../utils/stats'
import { activeSquad, makeSquad, MAX_SQUADS, migrateSquads, withActiveMembers } from '../utils/squads'

const SAVE_KEY = 'stock-wizard-save-v1'

function uid() {
  return String(Math.floor(10000 + Math.random() * 90000))
}

function defaultSave(): SaveData {
  return {
    trainerName: '赤红',
    trainerId: uid(),
    seen: [],
    captured: [],
    party: [],
    squads: [{ id: 'squad-1', name: '队伍1', members: [] }],
    activeSquadId: 'squad-1',
    catchAttempts: {},
    holdings: {},
    soundOn: true,
    started: false,
    discovered: [],
  }
}

function missingSprite(id: string): StockSprite {
  return {
    id,
    no: 0,
    code: '------',
    name: '?????',
    market: 'CN',
    types: ['conglomerate'],
    rarity: 'common',
    shape: 'orb',
    category: '未知',
    heightLabel: '—',
    weightLabel: '—',
    dexText: '这只精灵的图鉴页找不到了。',
    habitat: '—',
    ability: '—',
    abilityDesc: '—',
    baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
    basePrice: 10,
    wildness: 20,
  }
}

function sanitizeOwned(save: SaveData): SaveData {
  const owned = new Set(Array.isArray(save.captured) ? save.captured : [])
  const rawHoldings = save.holdings && typeof save.holdings === 'object' ? save.holdings : {}
  const holdings = Object.fromEntries(Object.entries(rawHoldings).filter(([id]) => owned.has(id)))
  const squads = (Array.isArray(save.squads) ? save.squads : []).map((squad) => ({
    ...squad,
    members: (squad.members ?? []).filter((id) => owned.has(id)),
  }))
  const active = squads.find((s) => s.id === save.activeSquadId) ?? squads[0]
  return { ...save, captured: [...owned], holdings, squads, party: active?.members ?? [] }
}

function parseSave(stored: Partial<SaveData>): SaveData {
  const parsed = { ...defaultSave(), ...stored } as SaveData
  parsed.holdings = parsed.holdings ?? {}
  parsed.discovered = (parsed.discovered ?? []).map((stock) => ({
    ...stock,
    types: stock.types.map(migrateSector) as StockSprite['types'],
  }))
  return sanitizeOwned(migrateSquads(parsed, stored))
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return defaultSave()
    return parseSave(JSON.parse(raw) as Partial<SaveData>)
  } catch {
    return defaultSave()
  }
}

interface GameContextValue {
  save: SaveData
  quotes: Record<string, Quote>
  catalog: StockSprite[]
  screen: Screen
  setScreen: (s: Screen) => void
  user: AuthUser | null
  cloudState: 'idle' | 'saving' | 'saved' | 'error'
  login: (username: string, password: string) => Promise<AuthUser>
  register: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  play: (fn: () => void) => void
  getSprite: (id: string) => StockSprite
  registerStock: (stock: StockSprite, quote: Quote) => void
  refreshQuote: (id: string) => Promise<void>
  refreshQuotes: (ids?: string[]) => Promise<void>
  markSeen: (id: string) => void
  tryCatch: (id: string) => { ok: boolean; toParty: boolean; rate: number }
  release: (id: string) => void
  addToParty: (id: string) => boolean
  moveToSquad: (id: string, squadId: string) => boolean
  leaveParty: (id: string) => void
  moveParty: (id: string, dir: -1 | 1) => void
  setHolding: (id: string, holding: Holding | null) => void
  switchSquad: (id: string) => void
  addSquad: () => boolean
  renameSquad: (id: string, name: string) => void
  removeSquad: (id: string) => boolean
  rename: (name: string) => void
  toggleSound: () => void
  reset: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => loadSave())
  const catalog = useMemo(
    () => [...STOCKS, ...save.discovered.filter((s) => !STOCK_MAP[s.id])],
    [save.discovered],
  )
  const [quotes, setQuotes] = useState<Record<string, Quote>>(() => {
    const initial = buildInitialQuotes()
    for (const stock of loadSave().discovered) {
      if (!initial[stock.id]) {
        initial[stock.id] = {
          price: stock.basePrice,
          open: stock.basePrice,
          series: [stock.basePrice],
          live: false,
        }
      }
    }
    return initial
  })
  const [screen, setScreen] = useState<Screen>(
    save.started ? { name: 'party' } : { name: 'title' },
  )

  const [user, setUser] = useState<AuthUser | null>(null)
  const [cloudState, setCloudState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const syncTimer = useRef<number | undefined>(undefined)
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  }, [save])

  // 已登录：存档变化后防抖同步到云端
  useEffect(() => {
    if (!user) return
    setCloudState('saving')
    window.clearTimeout(syncTimer.current)
    syncTimer.current = window.setTimeout(() => {
      void putCloudSave(saveRef.current)
        .then(() => setCloudState('saved'))
        .catch(() => setCloudState('error'))
    }, 1000)
    return () => window.clearTimeout(syncTimer.current)
  }, [save, user])

  // 启动后恢复登录态，并拉取云端存档
  useEffect(() => {
    if (!getToken()) return
    let alive = true
    void (async () => {
      try {
        const res = await apiMe()
        if (!alive) return
        setUser(res.user)
        const cloud = await fetchCloudSave()
        if (!alive) return
        if (cloud.save) setSave(parseSave(cloud.save))
        else await putCloudSave(saveRef.current)
        if (alive) setCloudState('saved')
      } catch {
        setToken('')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password)
    setToken(res.token)
    setUser(res.user)
    try {
      const cloud = await fetchCloudSave()
      if (cloud.save) setSave(parseSave(cloud.save))
      else await putCloudSave(saveRef.current)
      setCloudState('saved')
    } catch {
      setCloudState('error')
    }
    return res.user
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiRegister(username, password)
    setToken(res.token)
    setUser(res.user)
    try {
      await putCloudSave(saveRef.current)
      setCloudState('saved')
    } catch {
      setCloudState('error')
    }
    return res.user
  }, [])

  const logout = useCallback(async () => {
    await apiLogout().catch(() => {})
    window.clearTimeout(syncTimer.current)
    setToken('')
    setUser(null)
    setCloudState('idle')
  }, [])

  const refreshQuote = useCallback(async (id: string) => {
    const stock = catalog.find((s) => s.id === id)
    if (!stock) return
    const live = await fetchLiveQuote(quoteIdOf(stock)).catch(() => null)
    if (!live) return
    setQuotes((prev) => ({
      ...prev,
      [stock.id]: {
        ...quoteFromLive(live, stock.basePrice),
        series:
          live.series.length > 2
            ? live.series
            : (prev[stock.id]?.series ?? quoteFromLive(live, stock.basePrice).series),
      },
    }))
  }, [catalog])

  const refreshQuotes = useCallback(async (ids?: string[]) => {
    const targets = (ids ?? catalog.map((s) => s.id))
      .map((id) => catalog.find((s) => s.id === id))
      .filter((s): s is StockSprite => Boolean(s))
    if (!targets.length) return
    const batch = await fetchBatchQuotes(targets.map(quoteIdOf)).catch(
      () => ({} as Record<string, import('../api/eastmoney').LiveQuote>),
    )
    setQuotes((prev) => {
      const next = { ...prev }
      for (const stock of targets) {
        const live =
          batch[quoteIdOf(stock)] ||
          batch[stock.code] ||
          batch[stock.code.replace(/\.HK$/i, '')]
        if (!live) continue
        const old = prev[stock.id]
        const incoming = quoteFromLive(live, stock.basePrice)
        next[stock.id] = {
          ...old,
          ...incoming,
          series:
            old?.series && old.series.length > 2
              ? [...old.series.slice(0, -1), live.price]
              : incoming.series,
          pe: incoming.pe ?? old?.pe,
          peTtm: incoming.peTtm ?? old?.peTtm,
          peStatic: incoming.peStatic ?? old?.peStatic,
          peDynamic: incoming.peDynamic ?? old?.peDynamic,
          pb: incoming.pb ?? old?.pb,
          marketCap: incoming.marketCap ?? old?.marketCap,
          floatCap: incoming.floatCap ?? old?.floatCap,
          turnover: incoming.turnover ?? old?.turnover,
          volumeRatio: incoming.volumeRatio ?? old?.volumeRatio,
          amplitude: incoming.amplitude ?? old?.amplitude,
          amount: incoming.amount ?? old?.amount,
          volume: incoming.volume ?? old?.volume,
          industry: incoming.industry ?? old?.industry,
          eps: incoming.eps ?? old?.eps,
          netProfit: incoming.netProfit ?? old?.netProfit,
          revenue: incoming.revenue ?? old?.revenue,
          roe: incoming.roe ?? old?.roe,
          netMargin: incoming.netMargin ?? old?.netMargin,
          grossMargin: incoming.grossMargin ?? old?.grossMargin,
          dividendYield: incoming.dividendYield ?? old?.dividendYield,
        }
      }
      return next
    })
  }, [catalog])

  useEffect(() => {
    void refreshQuotes()
    const t = window.setInterval(() => {
      void refreshQuotes()
    }, 12000)
    return () => window.clearInterval(t)
  }, [catalog, refreshQuotes])

  const play = (fn: () => void) => {
    if (save.soundOn) fn()
  }

  const value = useMemo<GameContextValue>(
    () => ({
      save,
      quotes,
      catalog,
      screen,
      user,
      cloudState,
      login,
      register,
      logout,
      setScreen: (s) => {
        setScreen(s)
        if (s.name !== 'title') {
          setSave((prev) => (prev.started ? prev : { ...prev, started: true }))
        }
      },
      play,
      getSprite: (id) => catalog.find((s) => s.id === id) ?? missingSprite(id),
      registerStock: (stock, quote) => {
        setQuotes((prev) => ({ ...prev, [stock.id]: quote }))
        if (STOCK_MAP[stock.id]) return
        setSave((prev) =>
          prev.discovered.some((s) => s.id === stock.id)
            ? prev
            : { ...prev, discovered: [...prev.discovered, stock] },
        )
      },
      refreshQuote,
      refreshQuotes,
      markSeen: (id) => {
        setSave((prev) =>
          prev.seen.includes(id) ? prev : { ...prev, seen: [...prev.seen, id] },
        )
      },
      tryCatch: (id) => {
        const stock = catalog.find((s) => s.id === id)
        if (!stock) return { ok: false, toParty: false, rate: 0 }
        const seen = save.seen.includes(id)
        const attempts = save.catchAttempts[id] ?? 0
        const rate = catchRate(stock, seen, attempts, quotes[id])
        const ok = Math.random() < rate
        if (!ok) {
          setSave((prev) => ({
            ...prev,
            seen: prev.seen.includes(id) ? prev.seen : [...prev.seen, id],
            catchAttempts: { ...prev.catchAttempts, [id]: attempts + 1 },
          }))
          return { ok: false, toParty: false, rate }
        }
        setSave((prev) => {
          const captured = prev.captured.includes(id) ? prev.captured : [...prev.captured, id]
          const seenIds = prev.seen.includes(id) ? prev.seen : [...prev.seen, id]
          const current = activeSquad(prev)?.members ?? []
          const toParty = current.length < 6 && !current.includes(id)
          const next = toParty ? withActiveMembers(prev, [...current, id]) : prev
          return {
            ...next,
            seen: seenIds,
            captured,
            catchAttempts: { ...prev.catchAttempts, [id]: 0 },
          }
        })
        const before = activeSquad(save)?.members ?? []
        return { ok: true, toParty: before.length < 6 && !before.includes(id), rate }
      },
      release: (id) => {
        setSave((prev) =>
          sanitizeOwned({
            ...prev,
            captured: prev.captured.filter((x) => x !== id),
          }),
        )
      },
      setHolding: (id, holding) => {
        setSave((prev) => {
          const holdings = { ...prev.holdings }
          if (!holding || holding.qty <= 0 || holding.cost <= 0) delete holdings[id]
          else holdings[id] = { cost: holding.cost, qty: holding.qty }
          return { ...prev, holdings }
        })
      },
      addToParty: (id) => {
        const members = activeSquad(save)?.members ?? []
        if (!save.captured.includes(id) || members.includes(id) || members.length >= 6) {
          return false
        }
        setSave((prev) => {
          const current = activeSquad(prev)?.members ?? []
          if (current.includes(id) || current.length >= 6) return prev
          return withActiveMembers(prev, [...current, id])
        })
        return true
      },
      moveToSquad: (id, squadId) => {
        if (!save.captured.includes(id)) return false
        const target = save.squads.find((s) => s.id === squadId)
        if (!target) return false
        if (!target.members.includes(id) && target.members.length >= 6) return false
        setSave((prev) => {
          const next = prev.squads.find((s) => s.id === squadId)
          if (!next) return prev
          if (!next.members.includes(id) && next.members.length >= 6) return prev
          const squads = prev.squads.map((s) => {
            const rest = s.members.filter((x) => x !== id)
            if (s.id !== squadId) return { ...s, members: rest }
            return { ...s, members: [...rest, id] }
          })
          const active = squads.find((s) => s.id === prev.activeSquadId) ?? squads[0]
          return { ...prev, squads, party: active.members }
        })
        return true
      },
      leaveParty: (id) => {
        setSave((prev) => {
          const squads = prev.squads.map((s) => ({
            ...s,
            members: s.members.filter((x) => x !== id),
          }))
          const active = squads.find((s) => s.id === prev.activeSquadId) ?? squads[0]
          return { ...prev, squads, party: active?.members ?? [] }
        })
      },
      moveParty: (id, dir) => {
        setSave((prev) => {
          const members = [...(activeSquad(prev)?.members ?? [])]
          const i = members.indexOf(id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= members.length) return prev
          ;[members[i], members[j]] = [members[j], members[i]]
          return withActiveMembers(prev, members)
        })
      },
      switchSquad: (id) => {
        setSave((prev) => {
          const squad = prev.squads.find((s) => s.id === id)
          if (!squad) return prev
          return { ...prev, activeSquadId: id, party: squad.members }
        })
      },
      addSquad: () => {
        if (save.squads.length >= MAX_SQUADS) return false
        setSave((prev) => {
          if (prev.squads.length >= MAX_SQUADS) return prev
          const used = new Set(prev.squads.map((s) => s.name))
          let n = prev.squads.length + 1
          while (used.has(`队伍${n}`)) n += 1
          const squad = makeSquad(`队伍${n}`)
          return { ...prev, squads: [...prev.squads, squad], activeSquadId: squad.id, party: [] }
        })
        return true
      },
      renameSquad: (id, name) => {
        const next = name.trim().slice(0, 6)
        if (!next) return
        setSave((prev) => ({
          ...prev,
          squads: prev.squads.map((s) => (s.id === id ? { ...s, name: next } : s)),
        }))
      },
      removeSquad: (id) => {
        if (save.squads.length <= 1) return false
        setSave((prev) => {
          if (prev.squads.length <= 1) return prev
          const squads = prev.squads.filter((s) => s.id !== id)
          const nextId = prev.activeSquadId === id ? squads[0].id : prev.activeSquadId
          const members = squads.find((s) => s.id === nextId)?.members ?? []
          return { ...prev, squads, activeSquadId: nextId, party: members }
        })
        return true
      },
      rename: (name) => {
        const next = name.trim().slice(0, 6) || '赤红'
        setSave((prev) => ({ ...prev, trainerName: next }))
      },
      toggleSound: () => setSave((prev) => ({ ...prev, soundOn: !prev.soundOn })),
      reset: () => {
        const fresh = defaultSave()
        setSave(fresh)
        setQuotes(buildInitialQuotes())
        setScreen({ name: 'title' })
      },
    }),
    [save, quotes, screen, catalog, user, cloudState, login, register, logout],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame 必须在 GameProvider 内')
  return ctx
}
