import { google } from "googleapis"
import { mapMarchRows } from "../../../lib/portfolio-mapper"

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
      })
    }

    const headers = values[0]
    const dateIndex = headers.indexOf("snapshot_date")
    const totalIndex = headers.indexOf("portfolio_total")

    if (dateIndex === -1 || totalIndex === -1) {
      return Response.json({
        ok: true,
        history: [],
      })
    }

    const history = values
      .slice(1)
      .filter((row) => row[dateIndex] && row[totalIndex])
      .map((row) => {
        const snapshotDate = row[dateIndex]
        const portfolioTotal = Number(row[totalIndex] || 0)

        let label = snapshotDate
        try {
          const d = new Date(snapshotDate)
          label = d.toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          })
        } catch {}

        return {
          snapshotDate,
          label,
          portfolioTotal,
        }
      })

    return Response.json({
      ok: true,
      history,
      headers,
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

export async function POST() {
  try {
    const portfolioSheetName = process.env.PORTFOLIO_SHEET_NAME || "ACTIVOS"
    const snapshotSheetName = process.env.SNAPSHOT_SHEET_NAME || "Snapshots_Mensuales"
    const { sheets, spreadsheetId } = getSheetsClient()

    const portfolioRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${portfolioSheetName}!A:W`,
    })

    const rawRows = (portfolioRes.data.values ?? []) as string[][]
    const portfolioRows = mapMarchRows(rawRows)

    const snapshotRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${snapshotSheetName}!A:ZZ`,
    })

    const existingValues = (snapshotRes.data.values ?? []) as string[][]
    const existingHeaders = existingValues.length ? existingValues[0] : []

    const baseHeaders = ["snapshot_date", "portfolio_total"]
    const assetHeaders = portfolioRows.map((row) => row.asset)

    let headers = existingHeaders.length ? [...existingHeaders] : [...baseHeaders]

    for (const header of assetHeaders) {
      if (!headers.includes(header)) {
        headers.push(header)
      }
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

    const snapshotDate = new Date().toISOString()
    const portfolioTotal = portfolioRows.reduce((acc, row) => acc + row.total, 0)

    const rowMap = new Map<string, number>()
    portfolioRows.forEach((row) => {
      rowMap.set(row.asset, row.total)
    })

    const newRow = headers.map((header) => {
      if (header === "snapshot_date") return snapshotDate
      if (header === "portfolio_total") return portfolioTotal
      return rowMap.get(header) ?? ""
    })

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${snapshotSheetName}!A:${lastColumn}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [newRow],
      },
    })

    return Response.json({
      ok: true,
      snapshotDate,
      portfolioTotal,
      assetsSaved: portfolioRows.length,
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