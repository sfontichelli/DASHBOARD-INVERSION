import { google } from "googleapis"
import { mapPortfolioRows } from "../../../lib/portfolio-mapper"

export async function GET() {
  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID
    const portfolioSheetName = process.env.PORTFOLIO_SHEET_NAME || "ACTIVOS"

    if (!clientEmail || !privateKey || !spreadsheetId) {
      return Response.json(
        { error: "Faltan variables de entorno de Google Sheets" },
        { status: 500 }
      )
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${portfolioSheetName}!A:W`,
    })

    const values = (res.data.values ?? []) as string[][]
    const rows = mapPortfolioRows(values, "marzo")

    return Response.json({
      ok: true,
      rows,
    })
  } catch (error: any) {
    return Response.json(
      {
        error: "Error loading portfolio",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}