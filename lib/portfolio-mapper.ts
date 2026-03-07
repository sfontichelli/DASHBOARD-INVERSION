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

export function mapMarchRows(values: string[][]): PortfolioRow[] {
  return values
    .filter((row) => {
      const asset = (row[0] ?? "").trim()
      const category = (row[1] ?? "").trim()
      const total = row[17] ?? ""

      if (!asset || !category) return false
      if (asset === "ACTIVO") return false
      if (asset === "DATO MANUAL O LINKEADO") return false
      if (!total) return false

      return true
    })
    .map((row) => {
      const quantitySpot = parseNumber(row[14])     // O
      const optionsShares = parseNumber(row[15])    // P

      return {
        asset: (row[0] ?? "").trim(),
        category: (row[1] ?? "").trim(),
        quantitySpot,
        optionsShares,
        quantityDisplay: quantitySpot + optionsShares,
        price: parseNumber(row[16]),          // Q
        total: parseNumber(row[17]),          // R
        share: parseNumber(row[18]),          // S
        totalNoOpt: parseNumber(row[19]),     // T
        shareNoOpt: parseNumber(row[20]),     // U
        target: parseNullableNumber(row[21]), // V
        comment: String(row[22] ?? "").trim() // W
      }
    })
}