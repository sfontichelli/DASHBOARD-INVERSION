function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0

  const raw = String(value).trim()
  if (!raw) return 0

  const normalized = raw
    .replace(/USD/gi, "")
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseNullableNumber(value: unknown): number | null {
  const raw = String(value ?? "").trim()
  if (!raw) return null

  const n = parseNumber(value)
  return n === 0 ? null : n
}

export type PortfolioRow = {
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

export type MonthKey = "enero" | "febrero" | "actual"

type MonthConfig = {
  quantity: number
  options: number | null
  price: number
  total: number
  share: number
  totalNoOpt: number | null
  shareNoOpt: number | null
  target: number | null
  comment: number | null
}

const MONTH_CONFIG: Record<MonthKey, MonthConfig> = {
  enero: {
    quantity: 2,       // C
    options: null,
    price: 3,          // D
    total: 4,          // E
    share: 5,          // F
    totalNoOpt: null,
    shareNoOpt: null,
    target: null,
    comment: null,
  },
  febrero: {
    quantity: 7,       // H
    options: 8,        // I
    price: 9,          // J
    total: 10,         // K
    share: 11,         // L
    totalNoOpt: 12,    // M
    shareNoOpt: 13,    // N
    target: null,
    comment: null,
  },
  actual: {
    quantity: 14,      // O
    options: 15,       // P
    price: 16,         // Q
    total: 17,         // R
    share: 18,         // S
    totalNoOpt: 19,    // T
    shareNoOpt: 20,    // U
    target: 21,        // V
    comment: 22,       // W
  },
}

function getCell(row: string[], index: number | null): string {
  if (index === null) return ""
  return row[index] ?? ""
}

export function mapPortfolioRows(values: string[][], monthKey: MonthKey): PortfolioRow[] {
  const config = MONTH_CONFIG[monthKey]

  return values
    .filter((row) => {
      const asset = (row[0] ?? "").trim()
      const category = (row[1] ?? "").trim()
      const total = getCell(row, config.total)

      if (!asset || !category) return false
      if (asset === "ACTIVO") return false
      if (asset === "DATO MANUAL O LINKEADO") return false
      if (!total) return false

      return true
    })
    .map((row) => {
      const quantitySpot = parseNumber(getCell(row, config.quantity))
      const optionsShares = parseNumber(getCell(row, config.options))
      const total = parseNumber(getCell(row, config.total))
      const share = parseNumber(getCell(row, config.share))

      const totalNoOpt =
        config.totalNoOpt !== null
          ? parseNumber(getCell(row, config.totalNoOpt))
          : total

      const shareNoOpt =
        config.shareNoOpt !== null
          ? parseNumber(getCell(row, config.shareNoOpt))
          : share

      return {
        asset: (row[0] ?? "").trim(),
        category: (row[1] ?? "").trim(),
        quantitySpot,
        optionsShares,
        quantityDisplay: quantitySpot + optionsShares,
        price: parseNumber(getCell(row, config.price)),
        total,
        share,
        totalNoOpt,
        shareNoOpt,
        target:
          config.target !== null
            ? parseNullableNumber(getCell(row, config.target))
            : null,
        comment:
          config.comment !== null
            ? String(getCell(row, config.comment)).trim()
            : "",
      }
    })
}

export function mapActualRows(values: string[][]): PortfolioRow[] {
  return mapPortfolioRows(values, "actual")
}
