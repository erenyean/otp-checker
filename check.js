import fs from "fs"
import P from "pino"
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys"

const log = P({ level: "silent" })

const DELAY = 90 * 1000
const TIMEOUT = 20000
const COOLDOWN = 90 * 60 * 1000

const numbers = fs.readFileSync("numbers.txt", "utf-8")
  .split("\n")
  .map(n => n.trim())
  .filter(Boolean)

let results = {}

function classify(err) {
  if (!err) return "ok"
  const m = JSON.stringify(err).toLowerCase()
  if (m.includes("try again") || m.includes("too many") || m.includes("429"))
    return "1h_issue"
  if (m.includes("banned") || m.includes("not allowed"))
    return "banned"
  return "unknown"
}

async function checkNumber(num) {
  console.log("🔍 Checking", num)

  const { state } = await useMultiFileAuthState("./auth_" + num.replace("+", ""))

  const sock = makeWASocket({
    auth: state,
    logger: log,
    mobile: true,
    printQRInTerminal: false
  })

  return new Promise(resolve => {
    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
      if (connection === "open") resolve("ok")
      if (connection === "close")
        resolve(classify(lastDisconnect?.error))
    })
    setTimeout(() => resolve("unknown"), TIMEOUT)
  })
}

(async () => {
  for (const num of numbers) {
    const status = await checkNumber(num)

    results[num] = {
      status,
      checked_at: new Date().toISOString(),
      cooldown_until: status === "1h_issue" ? Date.now() + COOLDOWN : 0
    }

    fs.writeFileSync("results.json", JSON.stringify(results, null, 2))
    console.log(num, "→", status)
    console.log("⏱ Waiting...\n")

    await new Promise(r => setTimeout(r, DELAY))
  }

  console.log("✅ Done. Results saved in results.json")
})()
