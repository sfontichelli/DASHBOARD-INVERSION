export default function Page() {
  return (
    <main style={{
      background: "#0b1220",
      color: "white",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui"
    }}>
      <div style={{textAlign: "center"}}>
        <h1 style={{fontSize: "40px", marginBottom: "10px"}}>
          Portfolio Dashboard
        </h1>
        <p style={{opacity: 0.7}}>
          Conectando con Google Sheets...
        </p>
      </div>
    </main>
  )
}