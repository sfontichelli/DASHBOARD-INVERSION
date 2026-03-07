"use client"

import { useEffect, useMemo, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

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

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString("es-AR")}`
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
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
}: {
  title: string
  value: string
  sub?: string
  subColor?: string
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
          color: "white",
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

export default function Page() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showOptions, setShowOptions] = useState(true)
  const [showTargets, setShowTargets] = useState(true)
  const [showLiquidity, setShowLiquidity] = useState(true)
  const [allocationView, setAllocationView] = useState<"asset" | "category">("asset")

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/portfolio")
      const data = await res.json()
      setRows(data.rows || [])
      setLoading(false)
    }
    load()
  }, [])

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

  const currentTotalWithOpt = rows
    .filter((r) => (showLiquidity ? true : r.category.toUpperCase() !== "LIQUIDEZ"))
    .reduce((acc, row) => acc + row.total, 0)

  const currentTotalNoOpt = rows
    .filter((r) => (showLiquidity ? true : r.category.toUpperCase() !== "LIQUIDEZ"))
    .reduce((acc, row) => acc + row.totalNoOpt, 0)

  const liquidityTotal = rows
    .filter((r) => r.category.toUpperCase() === "LIQUIDEZ")
    .reduce((acc, row) => acc + (showOptions ? row.total : row.totalNoOpt), 0)

  const top3Share = portfolioTotal
    ? (visibleRows.slice(0, 3).reduce((acc, row) => acc + row.displayValue, 0) / portfolioTotal) * 100
    : 0

  const targetScenario = visibleRows.reduce((acc, row) => {
    if (row.target && row.target > 0) return acc + row.target * row.quantitySpot
    return acc + row.displayValue
  }, 0)

  const targetUpside = portfolioTotal ? ((targetScenario - portfolioTotal) / portfolioTotal) * 100 : 0

  const targetCapture = (() => {
    const valid = visibleRows.filter((r) => r.target && r.target > 0)
    if (!valid.length) return 0
    return (
      valid.reduce((acc, row) => {
        const progress = Math.min((row.price / (row.target || row.price)) * 100, 100)
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
            <p style={{ color: "#94a3b8", marginTop: 10, maxWidth: 800 }}>
              Vista principal conectada a Google Sheets, con lectura de exposición con y sin opciones,
              heatmap semáforo, targets y composición del portfolio.
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
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <Card
            title="Portfolio Value"
            value={formatMoney(portfolioTotal)}
            sub={showOptions ? "usa TOTAL del mes activo" : "usa TOTAL SIN OP del mes activo"}
            subColor="#34d399"
          />
          <Card
            title="Concentración Top 3"
            value={`${top3Share.toFixed(1)}%`}
            sub={visibleRows.slice(0, 3).map((r) => r.asset).join(" + ")}
            subColor="#fbbf24"
          />
          <Card
            title="Liquidez"
            value={formatMoney(liquidityTotal)}
            sub="broker + USDT"
            subColor="#34d399"
          />
          <Card
            title="Target Upside"
            value={formatPct(targetUpside)}
            sub="vs targets cargados"
            subColor="#34d399"
          />
          <Card
            title="Target Capture Ratio"
            value={`${targetCapture.toFixed(0)}%`}
            sub="recorrido capturado hacia targets"
            subColor="#94a3b8"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 24,
          }}
        >
          <div
            style={{
              background: "rgba(15,23,42,0.8)",
              border: "1px solid #1e293b",
              borderRadius: 28,
              padding: 20,
            }}
          >
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
  formatter={(value: number) => {
    const share = portfolioTotal ? (Number(value) / portfolioTotal) * 100 : 0
    return [`${formatMoney(Number(value))} • ${share.toFixed(1)}%`, "Valor"]
  }}
  contentStyle={{
    background: "#020617",
    border: "1px solid #334155",
    borderRadius: 12,
    color: "#ffffff",
  }}
  itemStyle={{ color: "#e2e8f0" }}
  labelStyle={{
    color: "#22d3ee",
    fontWeight: 700,
    fontSize: 14,
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

          <div
            style={{
              background: "rgba(15,23,42,0.8)",
              border: "1px solid #1e293b",
              borderRadius: 28,
              padding: 20,
            }}
          >
            <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Métricas avanzadas</h2>

            <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
              <div
                style={{
                  background: "#020617",
                  border: "1px solid #1e293b",
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                <div style={{ color: "#94a3b8", fontSize: 14 }}>Deployable Liquidity Ratio</div>
                <div style={{ color: "white", fontSize: 28, fontWeight: 700, marginTop: 8 }}>
                  {deployableLiquidity.toFixed(1)}%
                </div>
                <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
                  Liquidez real para aprovechar caídas.
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
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(15,23,42,0.8)",
            border: "1px solid #1e293b",
            borderRadius: 28,
            padding: 20,
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
                Cantidad muestra spot o spot + opciones según el toggle.
              </p>
            </div>
            <div style={{ color: "#94a3b8", fontSize: 14 }}>Ordenado por peso en portfolio</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 1200, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#94a3b8", borderBottom: "1px solid #1e293b", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px" }}>Activo</th>
                  <th style={{ padding: "12px 8px" }}>Categoría</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Spot</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Opciones</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Cantidad</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Precio</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Valor s/opc.</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Valor c/opc.</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Share</th>
                  <th style={{ padding: "12px 8px", textAlign: "right" }}>Target</th>
                  <th style={{ padding: "12px 8px" }}>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.asset}
                    style={{
                      borderBottom: "1px solid rgba(30,41,59,0.75)",
                    }}
                  >
                    <td style={{ padding: "14px 8px", color: "white", fontWeight: 600 }}>{row.asset}</td>
                    <td style={{ padding: "14px 8px", color: "#cbd5e1" }}>{row.category}</td>
                    <td style={{ padding: "14px 8px", color: "#cbd5e1", textAlign: "right" }}>
                      {row.quantitySpot}
                    </td>
                    <td style={{ padding: "14px 8px", color: "#cbd5e1", textAlign: "right" }}>
                      {row.optionsShares || "—"}
                    </td>
                    <td style={{ padding: "14px 8px", color: "white", textAlign: "right" }}>
                      {row.displayQuantity}
                    </td>
                    <td style={{ padding: "14px 8px", color: "#cbd5e1", textAlign: "right" }}>
                      {formatMoney(row.price)}
                    </td>
                    <td style={{ padding: "14px 8px", color: "#cbd5e1", textAlign: "right" }}>
                      {formatMoney(row.totalNoOpt)}
                    </td>
                    <td style={{ padding: "14px 8px", color: "#67e8f9", textAlign: "right", fontWeight: 600 }}>
                      {formatMoney(row.total)}
                    </td>
                    <td style={{ padding: "14px 8px", color: "white", textAlign: "right" }}>
                      {row.displayShare.toFixed(1)}%
                    </td>
                    <td style={{ padding: "14px 8px", color: "#34d399", textAlign: "right" }}>
                      {showTargets && row.target ? formatMoney(row.target) : "—"}
                    </td>
                    <td style={{ padding: "14px 8px", color: "#94a3b8" }}>
                      {row.comment || "—"}
                    </td>
                  </tr>
                ))}
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
          <div
            style={{
              background: "rgba(15,23,42,0.8)",
              border: "1px solid #1e293b",
              borderRadius: 28,
              padding: 20,
            }}
          >
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
                        background: "#020617",
                        border: "1px solid #1e293b",
                        borderRadius: 20,
                        padding: 16,
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
                          {row.price.toLocaleString("es-AR")} / {row.target?.toLocaleString("es-AR")}
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

          <div
            style={{
              background: "rgba(15,23,42,0.8)",
              border: "1px solid #1e293b",
              borderRadius: 28,
              padding: 20,
            }}
          >
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

          <div
            style={{
              background: "rgba(15,23,42,0.8)",
              border: "1px solid #1e293b",
              borderRadius: 28,
              padding: 20,
            }}
          >
            <h2 style={{ margin: 0, color: "white", fontSize: 22 }}>Qué cambia al activar opciones</h2>

            <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
              <div
                style={{
                  background: "#020617",
                  border: "1px solid #1e293b",
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                <div style={{ color: "#94a3b8", fontSize: 14 }}>Sin opciones</div>
                <div style={{ color: "white", fontSize: 32, fontWeight: 700, marginTop: 8 }}>
                  {formatMoney(currentTotalNoOpt)}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
                  Toma TOTAL SIN OP del mes activo.
                </div>
              </div>

              <div
                style={{
                  background: "rgba(34,211,238,0.08)",
                  border: "1px solid rgba(34,211,238,0.22)",
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                <div style={{ color: "#67e8f9", fontSize: 14 }}>Con opciones</div>
                <div style={{ color: "white", fontSize: 32, fontWeight: 700, marginTop: 8 }}>
                  {formatMoney(currentTotalWithOpt)}
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 14, marginTop: 8 }}>
                  Toma TOTAL del mes activo.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(15,23,42,0.8)",
            border: "1px solid #1e293b",
            borderRadius: 28,
            padding: 20,
          }}
        >
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
            <div style={{ color: "#34d399", fontSize: 14 }}>
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
            <Card title="Valor actual" value={formatMoney(portfolioTotal)} />
            <Card title="Valor a targets" value={formatMoney(targetScenario)} />
            <Card
              title="Potencial incremental"
              value={formatMoney(Math.max(targetScenario - portfolioTotal, 0))}
              sub="proyección patrimonial"
              subColor="#34d399"
            />
          </div>
        </div>
      </div>
    </main>
  )
}