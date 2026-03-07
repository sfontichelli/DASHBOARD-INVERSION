import { google } from "googleapis"
import { mapMarchRows } from "../../../lib/portfolio-mapper"

export async function GET() {
  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID
    const sheetName = process.env.PORTFOLIO_SHEET_NAME || "ACTIVOS"

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return Response.json(
        { error: "Faltan variables de entorno" },
        { status: 500 }
      )
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:W`,
    })

    const rawRows = (res.data.values ?? []) as string[][]
    const rows = mapMarchRows(rawRows)

    return Response.json({
      ok: true,
      count: rows.length,
      rows,
    })
  } catch (error: any) {
    return Response.json(
      {
        error: "No se pudo leer Google Sheets",
        detail: error?.message || "Error desconocido",
      },
      { status: 500 }
    )
  }
}