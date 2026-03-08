import { google } from "googleapis"
import { mapPortfolioRows, type PortfolioRow } from "../../../lib/portfolio-mapper"

type MonthKey = "enero" | "febrero" | "marzo"

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Faltan variables de entorno de Google Sheets")
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })

  const sheets = google.sheets({ version: "v4", auth })

  return { sheets, spreadsheetId }
}

function toColumnLetter(columnNumber: number) {
  let temp = columnNumber
  let letter = ""
  while (temp > 0) {
    const mod = (temp - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    temp = Math.floor((temp - mod) / 26)
  }
  return letter
}

function buildHeaders(rows: PortfolioRow[]) {
  const headers = [
    "snapshot_key",
    "snapshot_label",
    "snapshot_date",
    "portfolio_total_with_options",
    "portfolio_total_without_options",
  ]

  for (const row of rows) {
    headers.push(`${row.asset}_with_options`)
    headers.push(`${row.asset}_without_options`)
  }

  return headers
}

function buildRowValues(
  headers: string[],
  rows: PortfolioRow[],
  meta: {
    snapshotKey: string
    snapshotLabel: string
    snapshotDate: string
  }
) {
  const withMap = new Map<string, number>()
  const withoutMap = new Map<string, number>()

  rows.forEach((row) => {
    withMap.set(`${row.asset}_with_options`, row.total)
    withoutMap.set(`${row.asset}_without_options`, row.totalNoOpt)
  })

  const totalWithOptions = rows.reduce((acc, row) => acc + row.total, 0)
  const totalWithoutOptions = rows.reduce((acc, row) => acc + row.totalNoOpt, 0)

  return headers.map((header) => {
    if (header === "snapshot_key") return meta.snapshotKey
    if (header === "snapshot_label") return meta.snapshotLabel
    if (header === "snapshot_date") return meta.snapshotDate
    if (header === "portfolio_total_with_options") return totalWithOptions
    if (header === "portfolio_total_without_options") return totalWithoutOptions
    if (withMap.has(header)) return withMap.get(header) ?? ""
    if (withoutMap.has(header)) return withoutMap.get(header) ?? ""
    return ""
  })
}

async function upsertSnapshot(params: {
  monthKey: MonthKey
  snapshotKey: string
  snapshotLabel: string
  snapshotDate: string
}) {
  const portfolioSheetName = process.env.PORTFOLIO_SHEET_NAME || "ACTIVOS"
  const snapshotSheetName = process.env.SNAPSHOT_SHEET_NAME || "Snapshots_Mensuales"
  const { sheets, spreadsheetId } = getSheetsClient()

  const portfolioRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${portfolioSheetName}!A:W`,
  })

  const rawRows = (portfolioRes.data.values ?? []) as string[][]
  const portfolioRows = mapPortfolioRows(rawRows, params.monthKey)

  const snapshotRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${snapshotSheetName}!A:ZZ`,
  })

  const existingValues = (snapshotRes.data.values ?? []) as string[][]
  const existingHeaders = existingValues.length ? existingValues[0] : []

  let headers = existingHeaders.length ? [...existingHeaders] : buildHeaders(portfolioRows)

  const requiredHeaders = buildHeaders(portfolioRows)
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) headers.push(header)
  }

  const lastColumn = toColumnLetter(headers.length)

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${snapshotSheetName}!A1:${lastColumn}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [headers],
    },
  })

  const newRow = buildRowValues(headers, portfolioRows, params)

  const keyIndex = headers.indexOf("snapshot_key")
  const existingRowIndex = existingValues.findIndex((row, idx) => {
    if (idx === 0) return false
    return row[keyIndex] === params.snapshotKey
  })

  if (existingRowIndex !== -1) {
    const sheetRow = existingRowIndex + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${snapshotSheetName}!A${sheetRow}:${lastColumn}${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [newRow],
      },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${snapshotSheetName}!A:${lastColumn}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [newRow],
      },
    })
  }

  return {
    assetsSaved: portfolioRows.length,
    withOptions: portfolioRows.reduce((acc, row) => acc + row.total, 0),
    withoutOptions: portfolioRows.reduce((acc, row) => acc + row.totalNoOpt, 0),
  }
}

function isMetaHeader(header: string) {
  return [
    "snapshot_key",
    "snapshot_label",
    "snapshot_date",
    "portfolio_total",
    "portfolio_total_with_options",
    "portfolio_total_without_options",
  ].includes(header)
}

export async function GET() {
  try {
    const snapshotSheetName = process.env.SNAPSHOT_SHEET_NAME || "Snapshots_Mensuales"
    const { sheets, spreadsheetId } = getSheetsClient()

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${snapshotSheetName}!A:ZZ`,
    })

    const values = (res.data.values ?? []) as string[][]

    if (!values.length) {
      return Response.json({
        ok: true,
        history: [],
        compositionsBySnapshot: {},
      })
    }

    const headers = values[0]
    const keyIndex = headers.indexOf("snapshot_key")
    const labelIndex = headers.indexOf("snapshot_label")
    const dateIndex = headers.indexOf("snapshot_date")
    const withIndex = headers.indexOf("portfolio_total_with_options")
    const withoutIndex = headers.indexOf("portfolio_total_without_options")
    const legacyTotalIndex = headers.indexOf("portfolio_total")

    const monthlyRows = values
      .slice(1)
      .filter((row) => {
        const possibleKey = String(row[keyIndex] || "")
        const possibleDate = String(row[dateIndex] || row[0] || "")
        return /^\d{4}-\d{2}$/.test(possibleKey) || /^\d{4}-\d{2}-\d{2}T/.test(possibleDate)
      })

    const history = monthlyRows
      .map((row, idx) => {
        const fallbackDate = String(row[dateIndex] || row[0] || "")
        const fallbackLabel = (() => {
          try {
            const d = new Date(fallbackDate)
            return d.toLocaleDateString("es-AR", { month: "short", year: "numeric" })
          } catch {
            return `snap ${idx + 1}`
          }
        })()

        const snapshotKey =
          String(row[keyIndex] || "").trim() ||
          (() => {
            try {
              const d = new Date(fallbackDate)
              return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
            } catch {
              return `snap-${idx + 1}`
            }
          })()

        const totalWithOptions =
          withIndex !== -1
            ? Number(row[withIndex] || 0)
            : legacyTotalIndex !== -1
            ? Number(row[legacyTotalIndex] || 0)
            : 0

        const totalWithoutOptions =
          withoutIndex !== -1
            ? Number(row[withoutIndex] || 0)
            : legacyTotalIndex !== -1
            ? Number(row[legacyTotalIndex] || 0)
            : 0

        return {
          snapshotKey,
          label: String(row[labelIndex] || fallbackLabel),
          snapshotDate: fallbackDate,
          portfolioTotalWithOptions: totalWithOptions,
          portfolioTotalWithoutOptions: totalWithoutOptions,
          _rawRow: row,
        }
      })
      .sort((a, b) => a.snapshotKey.localeCompare(b.snapshotKey))

    const compositionsBySnapshot: Record<
      string,
      {
        withOptions: Record<string, number>
        withoutOptions: Record<string, number>
      }
    > = {}

    history.forEach((item) => {
      const withOptions: Record<string, number> = {}
      const withoutOptions: Record<string, number> = {}

      headers.forEach((header, index) => {
        if (!header) return

        if (header.endsWith("_with_options") && header !== "portfolio_total_with_options") {
          const asset = header.replace(/_with_options$/, "")
          withOptions[asset] = Number(item._rawRow[index] || 0)
          return
        }

        if (header.endsWith("_without_options") && header !== "portfolio_total_without_options") {
          const asset = header.replace(/_without_options$/, "")
          withoutOptions[asset] = Number(item._rawRow[index] || 0)
          return
        }

        if (!isMetaHeader(header) && !header.endsWith("_with_options") && !header.endsWith("_without_options")) {
          const value = Number(item._rawRow[index] || 0)
          if (!(header in withOptions)) withOptions[header] = value
          if (!(header in withoutOptions)) withoutOptions[header] = value
        }
      })

      compositionsBySnapshot[item.snapshotKey] = {
        withOptions,
        withoutOptions,
      }
    })

    return Response.json({
      ok: true,
      history: history.map(({ _rawRow, ...rest }) => rest),
      compositionsBySnapshot,
    })
  } catch (error: any) {
    return Response.json(
      {
        error: "No se pudieron leer los snapshots",
        detail: error?.message || "Error desconocido",
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode || "saveCurrent"

    if (mode === "backfill2026") {
      const backfillPlan = [
        {
          monthKey: "enero" as MonthKey,
          snapshotKey: "2026-01",
          snapshotLabel: "ene 2026",
          snapshotDate: "2026-01-31T23:59:59.000Z",
        },
        {
          monthKey: "febrero" as MonthKey,
          snapshotKey: "2026-02",
          snapshotLabel: "feb 2026",
          snapshotDate: "2026-02-28T23:59:59.000Z",
        },
        {
          monthKey: "marzo" as MonthKey,
          snapshotKey: "2026-03",
          snapshotLabel: "mar 2026",
          snapshotDate: "2026-03-31T23:59:59.000Z",
        },
      ]

      const results = []
      for (const item of backfillPlan) {
        const result = await upsertSnapshot(item)
        results.push({
          snapshotKey: item.snapshotKey,
          ...result,
        })
      }

      return Response.json({
        ok: true,
        mode: "backfill2026",
        results,
      })
    }

    const now = new Date()
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`

    const result = await upsertSnapshot({
      monthKey: "marzo",
      snapshotKey: currentMonth,
      snapshotLabel: now.toLocaleDateString("es-AR", {
        month: "short",
        year: "numeric",
      }),
      snapshotDate: now.toISOString(),
    })

    return Response.json({
      ok: true,
      mode: "saveCurrent",
      snapshotKey: currentMonth,
      ...result,
    })
  } catch (error: any) {
    return Response.json(
      {
        error: "No se pudo guardar el cierre mensual",
        detail: error?.message || "Error desconocido",
      },
      { status: 500 }
    )
  }
}