import { google } from "googleapis"

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    const spreadsheetId = process.env.GOOGLE_SHEET_ID

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "DATA!A1:Z100",
    })

    const rows = res.data.values || []
    const headers = rows[0]
    const data = rows.slice(1)

    const result = data.map((row) => {
      const obj: any = {}

      headers.forEach((h, i) => {
        obj[h] = row[i]
      })

      return {
        asset: obj.asset,
        category: obj.category,
        quantitySpot: Number(obj.quantitySpot || 0),
        optionsShares: Number(obj.optionsShares || 0),
        quantityDisplay: Number(obj.quantityDisplay || 0),
        price: Number(obj.price || 0),
        total: Number(obj.total || 0),
        share: Number(obj.share || 0),
        totalNoOpt: Number(obj.totalNoOpt || 0),
        shareNoOpt: Number(obj.shareNoOpt || 0),
        target: obj.target ? Number(obj.target) : null,
        comment: obj.comment || "",
      }
    })

    return Response.json({
      rows: result,
    })
  } catch (error) {
    console.error(error)
    return Response.json({ error: "Error loading portfolio" })
  }
}