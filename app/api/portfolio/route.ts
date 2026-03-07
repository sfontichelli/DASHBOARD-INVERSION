import { google } from "googleapis"

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

    return Response.json({
      ok: true,
      rows: res.data.values ?? [],
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