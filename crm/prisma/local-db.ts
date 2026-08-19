import { PGlite } from "@electric-sql/pglite"
import { createServer } from "pglite-server"
import path from "node:path"
import fs from "node:fs"

const DATA_DIR = path.resolve(__dirname, "../.local-postgres-data")
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const PORT = 5432

async function start() {
  console.log(`Starting Embedded Local PostgreSQL Server...`)
  console.log(`Data Directory: ${DATA_DIR}`)
  
  const db = new PGlite(DATA_DIR)
  const server = createServer(db)

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`\n======================================================`)
    console.log(`🚀 Local PostgreSQL is RUNNING on port ${PORT}!`)
    console.log(`   Connection URL: postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`)
    console.log(`======================================================\n`)
  })
}

start().catch(console.error)
