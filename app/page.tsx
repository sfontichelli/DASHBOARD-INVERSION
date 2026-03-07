"use client"

import { useEffect, useState } from "react"

type Row = {
  asset: string
  category: string
  quantity: number
  price: number
  total: number
  share: number
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/portfolio")
      const data = await res.json()
      setRows(data.rows || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <main style={{padding:40,color:"white",background:"#0b1220",minHeight:"100vh"}}>
        Cargando portfolio...
      </main>
    )
  }

  const portfolioValue = rows.reduce((acc,row)=>acc+row.total,0)

  return (
    <main style={{padding:40,color:"white",background:"#0b1220",minHeight:"100vh"}}>
      <h1 style={{fontSize:32,marginBottom:20}}>
        Portfolio Dashboard
      </h1>

      <h2 style={{marginBottom:30}}>
        Portfolio Value: ${portfolioValue.toLocaleString()}
      </h2>

      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{textAlign:"left",borderBottom:"1px solid #333"}}>
            <th>Activo</th>
            <th>Categoria</th>
            <th>Cantidad</th>
            <th>Precio</th>
            <th>Total</th>
            <th>Share</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r)=>(
            <tr key={r.asset} style={{borderBottom:"1px solid #222"}}>
              <td>{r.asset}</td>
              <td>{r.category}</td>
              <td>{r.quantityDisplay}</td>
              <td>${r.price}</td>
              <td>${r.total.toLocaleString()}</td>
              <td>{r.share}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}