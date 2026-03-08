"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

type Row = {
  asset: string
  category: string
  quantitySpot: number
  optionsShares: number
  quantityDisplay: number
  price: number
  total: number
  share: number
  totalNoOpt: number
  shareNoOpt: number
  target: number | null
  comment: string
}

type DisplayRow = Row & {
  displayValue: number
  displayShare: number
  displayQuantity: number
}

type SnapshotPoint = {
  snapshotKey: string
  snapshotDate: string
  label: string
  portfolioTotalWithOptions: number
  portfolioTotalWithoutOptions: number
}

type SnapshotCompositionMap = Record<
  string,
  {
    withOptions: Record<string, number>
    withoutOptions: Record<string, number>
  }
>

type PerformancePoint = {
  date: string
  value: number
  label: string
}

type SnapshotSaveChoice = {
  snapshotKey: string
  snapshotLabel: string
  snapshotDate: string
  description: string
}

const SECTION_STYLE: CSSProperties = {
  background: "rgba(15,23,42,0.8)",
  border: "1px solid #1e293b",
  borderRadius: 28,
  padding: 20,
}

const INNER_CARD_STYLE: CSSProperties = {
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 20,
  padding: 16,
}

function parseDateSafe(value: string) {
  if (!value) return null

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value
  const date = new Date(normalized)

  if (Number.isNaN(date.getTime())) return null
  return date
}

function getYearsBetween(startDate: string, endDate: string) {
  const start = parseDateSafe(startDate)?.getTime()
  const end = parseDateSafe(endDate)?.getTime()

  if (!start || !end || end <= start) return 0

  return (end - start) / (365.25 * 24 * 60 * 60 * 1000)
}

function getAnnualizedReturn(startValue: number, endValue: number, years: number) {
  if (!startValue || startValue <= 0 || !endValue || endValue <= 0 || years <= 0) return null
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
}

function findClosestPointToDate(points: PerformancePoint[], targetDate: Date) {
  if (!points.length) return null

  let best = points[0]
  let bestDistance = Math.abs((parseDateSafe(points[0].date)?.getTime() || 0) - targetDate.getTime())

  for (const point of points) {
    const pointTime = parseDateSafe(point.date)?.getTime()
    if (!pointTime) continue

    const distance = Math.abs(pointTime - targetDate.getTime())
    if (distance < bestDistance) {
      best = point
      bestDistance = distance
    }
  }

  return best
}

function findPointAtOrBefore(points: PerformancePoint[], targetDate: Date) {
  const sorted = [...points].sort(
    (a, b) => (parseDateSafe(a.date)?.getTime() || 0) - (parseDateSafe(b.date)?.getTime() || 0)
  )

  let candidate: PerformancePoint | null = null

  for (const point of sorted) {
    const pointDate = parseDateSafe(point.date)
    if (!pointDate) continue
    if (pointDate <= targetDate) {
      candidate = point
    }
  }

  return candidate
}

function formatMoney(value: number, privacyMode?: boolean) {
  if (privacyMode) return "$*****"
  return `$${Math.round(value).toLocaleString("es-AR")}`
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

function formatPctOrDash(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

function getValueColor(value: number | null, positive = "#34d399", negative = "#f87171", neutral = "white") {
  if (value === null || Number.isNaN(value)) return neutral
  if (value > 0) return positive
  if (value < 0) return negative
  return neutral
}

function getHeatConfig(share: number) {
  if (share > 30) {
    return {
      bg: "#3a1115",
      border: "#7f1d1d",
      text: "#fca5a5",
      label: "Muy alta",
    }
  }
  if (share > 20) {
    return {
      bg: "#3a2412",
      border: "#9a3412",
      text: "#fdba74",
      label: "Alta",
    }
  }
  if (share > 10) {
    return {
      bg: "#3a3212",
      border: "#a16207",
      text: "#fde68a",
      label: "Media",
    }
  }
  if (share > 5) {
    return {
      bg: "#203717",
      border: "#4d7c0f",
      text: "#bef264",
      label: "Moderada",
    }
  }
  return {
    bg: "#102a20",
    border: "#065f46",
    text: "#86efac",
    label: "Baja",
  }
}

function formatSnapshotMonthLabel(date: Date) {
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  return `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

function getMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function getMonthEndIso(date: Date) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 0))
  return monthEnd.toISOString()
}

function buildSnapshotChoice(date: Date, description: string): SnapshotSaveChoice {
  return {
    snapshotKey: getMonthKey(date),
    snapshotLabel: formatSnapshotMonthLabel(date),
    snapshotDate: getMonthEndIso(date),
    description,
  }
}

const CHART_COLORS = [
  "#22d3ee",
  "#ef4444",
  "#fbbf24",
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#8b5cf6",
  "#84cc16",
  "#e879f9",
]

function Card({
  title,
  value,
  sub,
  subColor = "#94a3b8",
  valueColor = "white",
}: {
  title: string
  value: string
  sub?: string
  subColor?: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 24,
        padding: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 14, color: "#94a3b8" }}>{title}</div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          marginTop: 10,
          color: valueColor,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: 14, marginTop: 10, color: subColor }}>{sub}</div>
      ) : null}
    </div>
  )
}

function MiniMetric({
  title,
  value,
  sub,
  accent = "#22d3ee",
  valueColor = "white",
}: {
  title: string
  value: string
  sub: string
  accent?: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        ...INNER_CARD_STYLE,
        borderRadius: 18,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 13, color: "#94a3b8" }}>{title}</div>
      <div
        style={{
          marginTop: 10,
          fontSize: 24,
          lineHeight: 1.1,
          fontWeight: 700,
          color: valueColor,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: accent }}>{sub}</div>
    </div>
  )
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([])
  const [history, setHistory] = useState<SnapshotPoint[]>([])
  const [compositionsBySnapshot, setCompositionsBySnapshot] = useState<SnapshotCompositionMap>({})
  const [loading, setLoading] = useState(true)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [showOptions, setShowOptions] = useState(true)
  const [showTargets, setShowTargets] = useState(true)
  const [showLiquidity, setShowLiquidity] = useState(true)
  const [privacyMode, setPrivacyMode] = useState(false)
  const [allocationView, setAllocationView] = useState<"asset" | "category">("asset")

  async function loadData() {
    const [portfolioRes, snapshotRes] = await Promise.all([
      fetch("/api/portfolio"),
      fetch("/api/snapshot"),
    ])

    const portfolioData = await portfolioRes.json()
    const snapshotData = await snapshotRes.json()

    setRows(portfolioData.rows || [])
    setHistory(snapshotData.history || [])
    setCompositionsBySnapshot(snapshotData.compositionsBySnapshot || {})
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const sortedHistory = useMemo(() => {
    return [...history]
      .filter((item) => parseDateSafe(item.snapshotDate))
      .sort(
        (a, b) =>
          (parseDateSafe(a.snapshotDate)?.getTime() || 0) -
          (parseDateSafe(b.snapshotDate)?.getTime() || 0)
      )
  }, [history])

  const visibleRows: DisplayRow[] = useMemo(() => {
    return rows
      .filter((r) => (showLiquidity ? true : r.category.toUpperCase() !== "LIQUIDEZ"))
      .map((r) => ({
        ...r,
        displayValue: showOptions ? r.total : r.totalNoOpt,
        displayShare: showOptions ? r.share : r.shareNoOpt,
        displayQuantity: showOptions ? r.quantityDisplay : r.quantitySpot,
      }))
      .sort((a, b) => b.displayValue - a.displayValue)
  }, [rows, showLiquidity, showOptions])

  const portfolioTotal = visibleRows.reduce((acc, row) => acc + row.displayValue, 0)

  const liquidityTotal = rows
    .filter((r) => r.category.toUpperCase() === "LIQUIDEZ")
    .reduce((acc, row) => acc + (showOptions ? row.total : row.totalNoOpt), 0)

  const top3Share = portfolioTotal
    ? (visibleRows.slice(0, 3).reduce((acc, row) => acc + row.displayValue, 0) / portfolioTotal) * 100
    : 0

  const targetScenario = visibleRows.reduce((acc, row) => {
    if (row.target && row.target > 0 && row.quantitySpot > 0) {
      return acc + row.target * row.quantitySpot
    }
    return acc + row.displayValue
  }, 0)

  const targetUpside = portfolioTotal ? ((targetScenario - portfolioTotal) / portfolioTotal) * 100 : 0

  const targetCapture = (() => {
    const valid = visibleRows.filter((r) => r.target && r.target > 0)
    if (!valid.length) return 0

    return (
      valid.reduce((acc, row) => {
        const baseTarget = row.target || row.price
        if (!baseTarget || baseTarget <= 0) return acc
        const progress = Math.min((row.price / baseTarget) * 100, 100)
        return acc + progress
      }, 0) / valid.length
    )
  })()

  const deployableLiquidity = portfolioTotal ? (liquidityTotal / portfolioTotal) * 100 : 0

  const allocation = useMemo(() => {
    if (allocationView === "asset") {
      return visibleRows.slice(0, 8).map((r) => ({
        name: r.asset,
        value: r.displayValue,
      }))
    }

    const grouped: Record<string, number> = {}
    visibleRows.forEach((r) => {
      grouped[r.category] = (grouped[r.category] || 0) + r.displayValue
    })

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [allocationView, visibleRows])

  const donutData = useMemo(() => {
    if (allocationView === "asset") {
      const sorted = [...visibleRows].sort((a, b) => b.displayValue - a.displayValue)
      const top = sorted.slice(0, 8).map((row) => ({
        name: row.asset,
        value: row.displayValue,
      }))

      const otherValue = sorted.slice(8).reduce((acc, row) => acc + row.displayValue, 0)

      if (otherValue > 0) {
        top.push({ name: "Otros", value: otherValue })
      }

      return top
    }

    const grouped: Record<string, number> = {}
    visibleRows.forEach((row) => {
      grouped[row.category] = (grouped[row.category] || 0) + row.displayValue
    })

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [allocationView, visibleRows])

  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  }, [])

  const comparisonSnapshot = useMemo(() => {
    if (!sortedHistory.length) return null

    const last = sortedHistory[sortedHistory.length - 1]

    if (last.snapshotKey === currentMonthKey && sortedHistory.length > 1) {
      return sortedHistory[sortedHistory.length - 2]
    }

    return last
  }, [sortedHistory, currentMonthKey])

  const comparisonSnapshotValue = comparisonSnapshot
    ? showOptions
      ? comparisonSnapshot.portfolioTotalWithOptions
      : comparisonSnapshot.portfolioTotalWithoutOptions
    : 0

  const monthlyChange = comparisonSnapshot ? portfolioTotal - comparisonSnapshotValue : 0
  const monthlyChangePct =
    comparisonSnapshot && comparisonSnapshotValue
      ? (monthlyChange / comparisonSnapshotValue) * 100
      : 0

  const performancePoints = useMemo<PerformancePoint[]>(() => {
    const snapshotPoints = sortedHistory.map((h) => ({
      date: h.snapshotDate,
      label: h.label,
      value: showOptions ? h.portfolioTotalWithOptions : h.portfolioTotalWithoutOptions,
    }))

    const currentDate = new Date()
    const currentPoint: PerformancePoint = {
      date: currentDate.toISOString(),
      label: "Actual",
      value: portfolioTotal,
    }

    const lastSnapshot = snapshotPoints[snapshotPoints.length - 1]
    if (!lastSnapshot) return [currentPoint]

    const lastSnapshotDate = parseDateSafe(lastSnapshot.date)
    const isSameDay =
      !!lastSnapshotDate &&
      lastSnapshotDate.getUTCFullYear() === currentDate.getUTCFullYear() &&
      lastSnapshotDate.getUTCMonth() === currentDate.getUTCMonth() &&
      lastSnapshotDate.getUTCDate() === currentDate.getUTCDate()

    if (isSameDay && lastSnapshot.value === portfolioTotal) {
      return snapshotPoints
    }

    return [...snapshotPoints, currentPoint]
  }, [sortedHistory, showOptions, portfolioTotal])

  const chartData = useMemo(() => {
    return performancePoints.map((point) => ({
      label: point.label,
      portfolioTotal: point.value,
    }))
  }, [performancePoints])

  const portfolioSeries = performancePoints.map((p) => p.value).filter((v) => v > 0)

  let peak = -Infinity
  let maxDrawdown = 0

  for (const v of portfolioSeries) {
    if (v > peak) peak = v
    if (peak > 0) {
      const dd = (v - peak) / peak
      if (dd < maxDrawdown) maxDrawdown = dd
    }
  }

  const maxDrawdownPct = maxDrawdown * 100

  const cagrSinceStart = useMemo(() => {
    if (performancePoints.length < 2) return null
    const first = performancePoints[0]
    const last = performancePoints[performancePoints.length - 1]
    const years = getYearsBetween(first.date, last.date)
    return getAnnualizedReturn(first.value, last.value, years)
  }, [performancePoints])

  const cagr12m = useMemo(() => {
    if (performancePoints.length < 2) return null

    const latest = performancePoints[performancePoints.length - 1]
    const latestDate = parseDateSafe(latest.date)
    if (!latestDate) return null

    const startWindow = new Date(latestDate)
    startWindow.setUTCFullYear(startWindow.getUTCFullYear() - 1)

    const yearsAvailable = getYearsBetween(performancePoints[0].date, latest.date)
    if (yearsAvailable < 0.75) return null

    const basePoint =
      findPointAtOrBefore(performancePoints, startWindow) ||
      findClosestPointToDate(performancePoints, startWindow)

    if (!basePoint) return null

    const years = getYearsBetween(basePoint.date, latest.date)
    return getAnnualizedReturn(basePoint.value, latest.value, years)
  }, [performancePoints])

  const cagr3y = useMemo(() => {
    if (performancePoints.length < 2) return null

    const latest = performancePoints[performancePoints.length - 1]
    const latestDate = parseDateSafe(latest.date)
    if (!latestDate) return null

    const startWindow = new Date(latestDate)
    startWindow.setUTCFullYear(startWindow.getUTCFullYear() - 3)

    const yearsAvailable = getYearsBetween(performancePoints[0].date, latest.date)
    if (yearsAvailable < 2.5) return null

    const basePoint =
      findPointAtOrBefore(performancePoints, startWindow) ||
      findClosestPointToDate(performancePoints, startWindow)

    if (!basePoint) return null

    const years = getYearsBetween(basePoint.date, latest.date)
    return getAnnualizedReturn(basePoint.value, latest.value, years)
  }, [performancePoints])

  const ytdReturn = useMemo(() => {
    if (!performancePoints.length) return 0

    const now = new Date()
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0))

    const latest = performancePoints[performancePoints.length - 1]
    const basePoint =
      findPointAtOrBefore(performancePoints, startOfYear) ||
      findClosestPointToDate(performancePoints, startOfYear)

    if (!basePoint || !basePoint.value) return 0
    return ((latest.value - basePoint.value) / basePoint.value) * 100
  }, [performancePoints])

  const comparisonComposition = comparisonSnapshot
    ? compositionsBySnapshot[comparisonSnapshot.snapshotKey]
    : null

  const contributionRows = useMemo(() => {
    const previousMap = comparisonComposition
      ? showOptions
        ? comparisonComposition.withOptions
        : comparisonComposition.withoutOptions
      : {}

    const rowsWithContribution = rows.map((row) => {
      const previous = previousMap[row.asset] ?? 0
      const current = showOptions ? row.total : row.totalNoOpt
      const contribution = current - previous

      return {
        asset: row.asset,
        current,
        previous,
        contribution,
      }
    })

    return rowsWithContribution
      .filter((row) => row.previous !== 0 || row.current !== 0)
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 8)
  }, [rows, comparisonComposition, showOptions])

  const snapshotSaveChoices = useMemo(() => {
    const now = new Date()
    const currentMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const earlyMonth = now.getUTCDate() <= 7

    const recommended = earlyMonth
      ? buildSnapshotChoice(previousMonthDate, "Recomendado si todavía estás cerrando el mes anterior.")
      : buildSnapshotChoice(currentMonthDate, "Recomendado para guardar el cierre del mes en curso.")

    const alternate = earlyMonth
      ? buildSnapshotChoice(currentMonthDate, "Usalo solo si querés registrar el mes actual.")
      : buildSnapshotChoice(previousMonthDate, "Útil si todavía necesitás corregir o rehacer el cierre anterior.")

    return {
      recommended,
      alternate,
      todayLabel: now.toLocaleDateString("es-AR"),
    }
  }, [])

  async function handleSaveSnapshot(choice: SnapshotSaveChoice) {
    try {
      setSavingSnapshot(true)

      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "saveCurrent",
          snapshotKey: choice.snapshotKey,
          snapshotLabel: choice.snapshotLabel,
          snapshotDate: choice.snapshotDate,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data?.detail || data?.error || "No se pudo guardar el cierre mensual")
        return
      }

      await loadData()
      setSaveModalOpen(false)
      alert(`Cierre mensual guardado correctamente para ${choice.snapshotLabel}`)
    } finally {
      setSavingSnapshot(false)
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#020617",
          color: "white",
          padding: 40,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Cargando portfolio...
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e2e8f0",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "#22d3ee",
                marginBottom: 8,
              }}
            >
              Portfolio Dashboard
            </div>
            <h1
              style={{
                fontSize: 36,
                margin: 0,
                color: "white",
              }}
            >
              Tracker patrimonial
            </h1>
            <p style={{ color: "#94a3b8", marginTop: 10, maxWidth: 900 }}>
              Vista principal conectada a Google Sheets, con exposición con y sin opciones,
              heatmap semáforo, targets, snapshots mensuales e histórico del portfolio.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setShowOptions((v) => !v)}
              style={{
                padding: "12px 16px",
                borderRadius: 16,
                border: `1px solid ${showOptions ? "#22d3ee" : "#334155"}`,
                background: showOptions ? "rgba(34,211,238,0.12)" : "#0f172a",
                color: showOptions ? "#67e8f9" : "#cbd5e1",
                cursor: "pointer",
              }}
            >
              Mostrar con opciones {showOptions ? "✓" : ""}
            </button>

            <button
              onClick={() => setShowTargets((v) => !v)}
              style={{
                padding: "12px 16px",
                borderRadius: 16,
                border: `1px solid ${showTargets ? "#22d3ee" : "#334155"}`,
                background: showTargets ? "rgba(34,211,238,0.12)" : "#0f172a",
                color: showTargets ? "#67e8f9" : "#cbd5e1",
                cursor: "pointer",
              }}
            >
              Mostrar targets {showTargets ? "✓" : ""}
            </button>

            <button
              onClick={() => setShowLiquidity((v) => !v)}
              style={{
                padding: "12px 16px",
                borderRadius: 16,
                border: `1px solid ${showLiquidity ? "#22d3ee" : "#334155"}`,
                background: showLiquidity ? "rgba(34,211,238,0.12)" : "#0f172a",
                color: showLiquidity ? "#67e8f9" : "#cbd5e1",
                cursor: "pointer",
              }}
            >
              Mostrar liquidez {showLiquidity ? "✓" : ""}
            </button>

            <button
              onClick={() => setSaveModalOpen(true)}
              disabled={savingSnapshot}
              style={{
                padding: "12px 16px",
                borderRadius: 16,
                border: "1px solid #065f46",
                background: savingSnapshot ? "#14532d" : "#166534",
                color: "white",
                cursor: savingSnapshot ? "default" : "pointer",
                opacity: savingSnapshot ? 0.7 : 1,
              }}
            >
              {savingSnapshot ? "Guardando..." : "Guardar cierre mensual"}
            </button>

            <button
              onClick={() => setPrivacyMode((v) => !v)}
              style={{
                padding: "12px 16px",
                borderRadius: 16,
                border: `1px solid ${privacyMode ? "#fbbf24" : "#334155"}`,
                background: privacyMode ? "rgba(251,191,36,0.15)" : "#0f172a",
                color: privacyMode ? "#fde68a" : "#cbd5e1",
                cursor: "pointer",
              }}
            >
              Modo privacidad {privacyMode ? "✓" : ""}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 20 }}>
            <div style={SECTION_STYLE}>
              <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Performance</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginTop: 20,
                }}
              >
                <Card
                  title="Portfolio Value"
                  value={formatMoney(portfolioTotal, privacyMode)}
                  sub={showOptions ? "incluye exposición con opciones" : "solo exposición spot"}
                  subColor="#34d399"
                />

                <Card
                  title="Variación vs último cierre"
                  value={comparisonSnapshot ? formatMoney(monthlyChange, privacyMode) : "—"}
                  sub={
                    comparisonSnapshot
                      ? `${formatPct(monthlyChangePct)} vs ${comparisonSnapshot.label}`
                      : "todavía no hay cierres guardados"
                  }
                  subColor={getValueColor(monthlyChange, "#34d399", "#f87171", "#94a3b8")}
                  valueColor={getValueColor(monthlyChange, "#34d399", "#f87171", "white")}
                />

                <Card
                  title="YTD Return"
                  value={formatPct(ytdReturn)}
                  sub="rendimiento acumulado del año"
                  subColor={getValueColor(ytdReturn, "#34d399", "#f87171", "#94a3b8")}
                  valueColor={getValueColor(ytdReturn, "#34d399", "#f87171", "white")}
                />

                <Card
                  title="Max Drawdown"
                  value={`${maxDrawdownPct.toFixed(1)}%`}
                  sub="caída máxima desde pico histórico"
                  subColor="#f87171"
                  valueColor="#f8fafc"
                />
              </div>
            </div>

            <div style={SECTION_STYLE}>
              <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Estructura</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 16,
                  marginTop: 20,
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    background: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: 24,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 14 }}>
                    CAGR anualizado
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <MiniMetric
                      title="CAGR Inicio"
                      value={formatPctOrDash(cagrSinceStart)}
                      sub="desde 1er snapshot"
                      accent="#22d3ee"
                      valueColor={getValueColor(cagrSinceStart, "#34d399", "#f87171", "white")}
                    />
                    <MiniMetric
                      title="CAGR 12M"
                      value={formatPctOrDash(cagr12m)}
                      sub="últimos 12 meses"
                      accent="#34d399"
                      valueColor={getValueColor(cagr12m, "#34d399", "#f87171", "white")}
                    />
                    <MiniMetric
                      title="CAGR 3A"
                      value={formatPctOrDash(cagr3y)}
                      sub="últimos 3 años"
                      accent="#a78bfa"
                      valueColor={getValueColor(cagr3y, "#34d399", "#f87171", "white")}
                    />
                  </div>
                </div>

                <Card
                  title="Concentración Top 3"
                  value={`${top3Share.toFixed(1)}%`}
                  sub={visibleRows.slice(0, 3).map((r) => r.asset).join(" + ")}
                  subColor="#fbbf24"
                  valueColor={top3Share > 60 ? "#fbbf24" : "white"}
                />
              </div>
            </div>
          </div>

          <div style={SECTION_STYLE}>
            <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Targets y liquidez</h2>

            <div
              style={{
                display: "grid",
                gap: 16,
                marginTop: 20,
              }}
            >
              <Card
                title="Liquidez"
                value={formatMoney(liquidityTotal, privacyMode)}
                sub="broker + USDT"
                subColor="#34d399"
              />

              <Card
                title="Target Upside"
                value={formatPct(targetUpside)}
                sub="potencial vs targets cargados"
                subColor={getValueColor(targetUpside, "#34d399", "#f87171", "#94a3b8")}
                valueColor={getValueColor(targetUpside, "#34d399", "#f87171", "white")}
              />

              <Card
                title="Target Capture Ratio"
                value={`${targetCapture.toFixed(0)}%`}
                sub="recorrido capturado hacia objetivos"
                subColor="#94a3b8"
              />
            </div>
          </div>
        </div>

        <div style={SECTION_STYLE}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Portfolio evolution</h2>
              <p style={{ color: "#94a3b8", marginTop: 8, marginBottom: 0 }}>
                Historial mensual basado en snapshots manuales, con el valor actual agregado como referencia en vivo.
              </p>
            </div>
            <div style={{ color: "#94a3b8", fontSize: 14 }}>
              Snapshots guardados: {sortedHistory.length}
            </div>
          </div>

          <div style={{ width: "100%", height: 320, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                {privacyMode ? null : (
                  <YAxis
                    stroke="#94a3b8"
                    tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
                  />
                )}
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload || !payload.length) return null
                    const value = Number(payload[0].value || 0)

                    return (
                      <div
                        style={{
                          background: "#020617",
                          border: "1px solid #334155",
                          borderRadius: 12,
                          padding: "10px 12px",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                        }}
                      >
                        <div style={{ color: "#22d3ee", fontWeight: 700, marginBottom: 6 }}>{label}</div>
                        <div style={{ color: "#e2e8f0" }}>{formatMoney(value, privacyMode)}</div>
                      </div>
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="portfolioTotal"
                  stroke="#22d3ee"
                  strokeWidth={3}
                  dot={{ fill: "#22d3ee", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 24,
          }}
        >
          <div style={SECTION_STYLE}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Composición del portfolio</h2>
                <p style={{ color: "#94a3b8", marginTop: 8, marginBottom: 0 }}>
                  Vista por activo o por categoría.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setAllocationView("asset")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${allocationView === "asset" ? "#22d3ee" : "#334155"}`,
                    background: allocationView === "asset" ? "rgba(34,211,238,0.12)" : "#0f172a",
                    color: allocationView === "asset" ? "#67e8f9" : "#cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  Por activo
                </button>
                <button
                  onClick={() => setAllocationView("category")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${allocationView === "category" ? "#22d3ee" : "#334155"}`,
                    background:
                      allocationView === "category" ? "rgba(34,211,238,0.12)" : "#0f172a",
                    color: allocationView === "category" ? "#67e8f9" : "#cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  Por categoría
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 0.9fr",
                gap: 20,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  minHeight: 320,
                  background: "#020617",
                  border: "1px solid #1e293b",
                  borderRadius: 28,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={85}
                        outerRadius={120}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {donutData.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null

                          const item = payload[0]
                          const name = String(item.name ?? "")
                          const value = Number(item.value ?? 0)
                          const share = portfolioTotal ? (value / portfolioTotal) * 100 : 0

                          return (
                            <div
                              style={{
                                background: "#020617",
                                border: "1px solid #334155",
                                borderRadius: 12,
                                padding: "10px 12px",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                                minWidth: 140,
                              }}
                            >
                              <div
                                style={{
                                  color: "#22d3ee",
                                  fontWeight: 700,
                                  fontSize: 14,
                                  marginBottom: 6,
                                }}
                              >
                                {name}
                              </div>

                              <div
                                style={{
                                  color: "#e2e8f0",
                                  fontSize: 13,
                                  lineHeight: 1.5,
                                }}
                              >
                                <div>{formatMoney(value, privacyMode)}</div>
                                <div>{share.toFixed(1)}% del portfolio</div>
                              </div>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: "#94a3b8" }}>Allocation</div>
                    <div style={{ fontSize: 28, color: "white", fontWeight: 700 }}>
                      {allocationView === "asset" ? "Activos" : "Categorías"}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {allocation.map((item) => {
                  const share = portfolioTotal ? (item.value / portfolioTotal) * 100 : 0
                  return (
                    <div
                      key={item.name}
                      style={{
                        background: "#020617",
                        border: "1px solid #1e293b",
                        borderRadius: 18,
                        padding: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#cbd5e1" }}>{item.name}</span>
                      <span style={{ color: "white", fontWeight: 700 }}>{share.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={SECTION_STYLE}>
            <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Métricas avanzadas</h2>

            <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
              <div style={INNER_CARD_STYLE}>
                <div style={{ color: "#94a3b8", fontSize: 14 }}>Deployable Liquidity Ratio</div>
                <div style={{ color: "white", fontSize: 28, fontWeight: 700, marginTop: 8 }}>
                  {deployableLiquidity.toFixed(1)}%
                </div>
                <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
                  Liquidez real disponible para aprovechar caídas.
                </div>
              </div>

              <div
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.22)",
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                <div style={{ color: "#fcd34d", fontSize: 14 }}>Alertas</div>
                <ul style={{ color: "#cbd5e1", marginTop: 12, paddingLeft: 18, lineHeight: 1.8 }}>
                  {visibleRows[0] ? <li>{visibleRows[0].asset} es la posición más grande.</li> : null}
                  {top3Share > 60 ? <li>Top 3 supera el 60% del portfolio.</li> : null}
                  {deployableLiquidity < 5 ? <li>Liquidez operativa baja.</li> : null}
                  <li>Vista {showOptions ? "con opciones" : "sin opciones"} activa.</li>
                  {privacyMode ? <li>Modo privacidad activo.</li> : null}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...SECTION_STYLE,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Tabla de posiciones</h2>
              <p style={{ color: "#94a3b8", marginTop: 8, marginBottom: 0 }}>
                {showOptions
                  ? "Vista completa con exposición spot y opciones."
                  : "Vista simplificada solo con exposición spot."}
              </p>
            </div>
            <div style={{ color: "#94a3b8", fontSize: 14 }}>Ordenado por peso en portfolio</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: showOptions ? 1180 : 920,
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr style={{ color: "#94a3b8", borderBottom: "1px solid #1e293b", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px", width: showOptions ? "14%" : "16%" }}>Activo</th>
                  <th style={{ padding: "12px 8px", textAlign: "right", width: "10%" }}>Spot</th>
                  {showOptions ? (
                    <th style={{ padding: "12px 8px", textAlign: "right", width: "10%" }}>Opciones</th>
                  ) : null}
                  <th style={{ padding: "12px 8px", textAlign: "right", width: "10%" }}>Cantidad</th>
                  <th style={{ padding: "12px 8px", textAlign: "right", width: "11%" }}>Precio</th>
                  <th style={{ padding: "12px 8px", textAlign: "right", width: "12%" }}>Valor s/opc.</th>
                  {showOptions ? (
                    <th style={{ padding: "12px 8px", textAlign: "right", width: "12%" }}>Valor c/opc.</th>
                  ) : null}
                  <th style={{ padding: "12px 8px", textAlign: "right", width: "8%" }}>Share</th>
                  <th style={{ padding: "12px 8px", textAlign: "right", width: "11%" }}>Target</th>
                  <th style={{ padding: "12px 8px", width: showOptions ? "12%" : "23%" }}>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const shareForHeat = portfolioTotal ? (row.displayValue / portfolioTotal) * 100 : 0
                  const heat = getHeatConfig(shareForHeat)

                  return (
                    <tr
                      key={row.asset}
                      style={{
                        borderBottom: "1px solid rgba(30,41,59,0.75)",
                      }}
                    >
                      <td
                        style={{
                          padding: "14px 8px",
                          color: "white",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {row.asset}
                      </td>

                      <td
                        style={{
                          padding: "14px 8px",
                          color: "#cbd5e1",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {privacyMode ? "***" : row.quantitySpot}
                      </td>

                      {showOptions ? (
                        <td
                          style={{
                            padding: "14px 8px",
                            color: "#cbd5e1",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {privacyMode ? "***" : row.optionsShares || "—"}
                        </td>
                      ) : null}

                      <td
                        style={{
                          padding: "14px 8px",
                          color: "white",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {privacyMode ? "***" : row.displayQuantity}
                      </td>

                      <td
                        style={{
                          padding: "14px 8px",
                          color: "#cbd5e1",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatMoney(row.price, privacyMode)}
                      </td>

                      <td
                        style={{
                          padding: "14px 8px",
                          color: "#cbd5e1",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatMoney(row.totalNoOpt, privacyMode)}
                      </td>

                      {showOptions ? (
                        <td
                          style={{
                            padding: "14px 8px",
                            color: "#67e8f9",
                            textAlign: "right",
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatMoney(row.total, privacyMode)}
                        </td>
                      ) : null}

                      <td
                        style={{
                          padding: "14px 8px",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                          color: heat.text,
                          fontWeight: 700,
                        }}
                      >
                        {row.displayShare.toFixed(1)}%
                      </td>

                      <td
                        style={{
                          padding: "14px 8px",
                          color: "#34d399",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {showTargets && row.target ? formatMoney(row.target, privacyMode) : "—"}
                      </td>

                      <td
                        style={{
                          padding: "14px 8px",
                          color: "#94a3b8",
                          lineHeight: 1.4,
                          wordBreak: "break-word",
                        }}
                      >
                        {row.comment || "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
          }}
        >
          <div style={SECTION_STYLE}>
            <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Targets tracker</h2>
            <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
              {visibleRows
                .filter((r) => r.target && r.target > 0)
                .slice(0, 6)
                .map((row) => {
                  const progress = Math.min((row.price / (row.target || row.price)) * 100, 100)

                  return (
                    <div
                      key={row.asset}
                      style={{
                        ...INNER_CARD_STYLE,
                        borderRadius: 20,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          fontSize: 14,
                        }}
                      >
                        <span style={{ color: "white", fontWeight: 600 }}>{row.asset}</span>
                        <span style={{ color: "#94a3b8" }}>
                          {formatMoney(row.price, privacyMode)} / {formatMoney(row.target || 0, privacyMode)}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 12,
                          height: 10,
                          borderRadius: 999,
                          background: "#1e293b",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${progress}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #22d3ee, #34d399)",
                          }}
                        />
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
                        {progress.toFixed(0)}% del recorrido capturado
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div style={SECTION_STYLE}>
            <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Heatmap de concentración</h2>
            <p style={{ color: "#94a3b8", marginTop: 8 }}>
              Semáforo: rojo muy expuesto, verde menor exposición.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 20,
              }}
            >
              {visibleRows.slice(0, 8).map((row, idx) => {
                const share = portfolioTotal ? (row.displayValue / portfolioTotal) * 100 : 0
                const heat = getHeatConfig(share)

                return (
                  <div
                    key={row.asset}
                    style={{
                      gridColumn: idx < 2 ? "span 2" : "span 1",
                      minHeight: 100,
                      borderRadius: 20,
                      padding: 16,
                      border: `1px solid ${heat.border}`,
                      background: heat.bg,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#cbd5e1", fontSize: 13 }}>{row.category}</span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: `1px solid ${heat.border}`,
                          color: heat.text,
                        }}
                      >
                        {heat.label}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "flex-end",
                      }}
                    >
                      <span style={{ color: "white", fontSize: 20, fontWeight: 700 }}>{row.asset}</span>
                      <span style={{ color: "#e2e8f0" }}>{share.toFixed(1)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={SECTION_STYLE}>
            <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Contribución del mes</h2>
            <p style={{ color: "#94a3b8", marginTop: 8 }}>
              {comparisonSnapshot
                ? `Cambio por activo vs ${comparisonSnapshot.label}.`
                : "Guardá snapshots para ver contribuciones contra un cierre previo."}
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
              {contributionRows.length ? (
                contributionRows.map((row) => (
                  <div
                    key={row.asset}
                    style={{
                      ...INNER_CARD_STYLE,
                      borderRadius: 18,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ color: "white", fontWeight: 600 }}>{row.asset}</div>
                      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                        {formatMoney(row.previous, privacyMode)} → {formatMoney(row.current, privacyMode)}
                      </div>
                    </div>
                    <div
                      style={{
                        color: row.contribution >= 0 ? "#34d399" : "#f87171",
                        fontWeight: 700,
                      }}
                    >
                      {row.contribution >= 0 ? "+" : "-"}
                      {formatMoney(Math.abs(row.contribution), privacyMode)}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    ...INNER_CARD_STYLE,
                    borderRadius: 18,
                    color: "#94a3b8",
                  }}
                >
                  Guardá snapshots para ver contribuciones.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={SECTION_STYLE}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Escenario a targets</h2>
              <p style={{ color: "#94a3b8", marginTop: 8, marginBottom: 0 }}>
                Proyección patrimonial si las posiciones con target llegan al objetivo.
              </p>
            </div>
            <div style={{ color: getValueColor(targetUpside, "#34d399", "#f87171", "#94a3b8"), fontSize: 14 }}>
              Upside estimado: {formatPct(targetUpside)}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 20,
            }}
          >
            <Card title="Valor actual" value={formatMoney(portfolioTotal, privacyMode)} />
            <Card title="Valor a targets" value={formatMoney(targetScenario, privacyMode)} />
            <Card
              title="Potencial incremental"
              value={formatMoney(Math.max(targetScenario - portfolioTotal, 0), privacyMode)}
              sub="proyección patrimonial"
              subColor="#34d399"
              valueColor="#34d399"
            />
          </div>
        </div>
      </div>

      {saveModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.78)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 28,
              padding: 24,
              boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ color: "#22d3ee", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  Confirmación de cierre
                </div>
                <h3 style={{ margin: "10px 0 0 0", color: "white", fontSize: 28 }}>
                  Elegí qué mes querés guardar
                </h3>
                <p style={{ color: "#94a3b8", marginTop: 10, marginBottom: 0 }}>
                  Fecha de hoy: {snapshotSaveChoices.todayLabel}. Esto evita guardar por error el mes equivocado.
                </p>
              </div>

              <button
                onClick={() => setSaveModalOpen(false)}
                disabled={savingSnapshot}
                style={{
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#cbd5e1",
                  borderRadius: 14,
                  padding: "10px 12px",
                  cursor: savingSnapshot ? "default" : "pointer",
                }}
              >
                Cerrar
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginTop: 24,
              }}
            >
              {[snapshotSaveChoices.recommended, snapshotSaveChoices.alternate].map((choice, idx) => {
                const recommended = idx === 0

                return (
                  <div
                    key={choice.snapshotKey}
                    style={{
                      background: recommended ? "rgba(34,211,238,0.08)" : "#020617",
                      border: `1px solid ${recommended ? "rgba(34,211,238,0.28)" : "#1e293b"}`,
                      borderRadius: 22,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: `1px solid ${recommended ? "#22d3ee" : "#334155"}`,
                        color: recommended ? "#67e8f9" : "#94a3b8",
                        fontSize: 12,
                        marginBottom: 14,
                      }}
                    >
                      {recommended ? "Recomendado" : "Alternativa"}
                    </div>

                    <div style={{ color: "white", fontSize: 24, fontWeight: 700 }}>{choice.snapshotLabel}</div>
                    <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
                      Key: {choice.snapshotKey}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 6 }}>
                      Fecha de cierre: {new Date(choice.snapshotDate).toLocaleDateString("es-AR")}
                    </div>
                    <div style={{ color: recommended ? "#67e8f9" : "#cbd5e1", fontSize: 14, marginTop: 12, minHeight: 42 }}>
                      {choice.description}
                    </div>

                    <button
                      onClick={() => handleSaveSnapshot(choice)}
                      disabled={savingSnapshot}
                      style={{
                        marginTop: 18,
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: 16,
                        border: `1px solid ${recommended ? "#065f46" : "#334155"}`,
                        background: recommended ? "#166534" : "#0f172a",
                        color: "white",
                        cursor: savingSnapshot ? "default" : "pointer",
                        opacity: savingSnapshot ? 0.7 : 1,
                        fontWeight: 600,
                      }}
                    >
                      {savingSnapshot ? "Guardando..." : `Guardar ${choice.snapshotLabel}`}
                    </button>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 18,
                color: "#94a3b8",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Si guardás dos veces el mismo mes, el snapshot se actualiza. Los meses anteriores no se pisan.
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
