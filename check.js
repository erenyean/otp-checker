import makeWASocket from "@whiskeysockets/baileys"
import P from "pino"
import readline from "readline"
import fs from "fs"

const log = P({ level: "silent" })
const DELAY = 2500 // 2.5 sec between checks
const OUTPUT = "results.json"

// Read pasted input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log("📥 Paste numbers (space or newline separated)")
console.log("👉 Press ENTER twice when done\n")

let input = ""

rl.on("line", (line) => {
  if (line.trim() === "") {
    rl.close()
  } else {
    input += " " + line
  }
})

rl.on("close", async () => {
  const numbers = [...new Set(
    input
      .match(/\d{7,}/g)
      ?.map(n => "+" + n) || []
  )]

  if (!numbers.length) {
    console.log("❌ No valid numbers detected")
    process.exit()
  }

  console.log(`\n🔢 ${numbers.length} numbers received\n`)

  const sock = makeWASocket({ logger: log })
  let results = {}

  for (const num of numbers) {
    const jid = num.replace("+", "") + "@s.whatsapp.net"
    let score = 0

    console.log("🔍 Checking", num)

    try {
      // Exists on WhatsApp
      const wa = await sock.onWhatsApp(jid)
      if (!wa || !wa[0]?.exists) {
        console.log(num, "→ ❌ NOT ON WHATSAPP\n")
        results[num] = { exists: false, score: 0 }
        continue
      }

      score += 40

      // Profile picture = strong OLD signal
      try {
        await sock.profilePictureUrl(jid)
        score += 40
      } catch {}

      // Stability bonus
      score += 20

      const tag =
        score >= 80 ? "🟢 OLD / STABLE" :
        score >= 60 ? "🟡 NORMAL" :
        "🔴 FRESH"

      console.log(`${num} → SCORE ${score} ${tag}\n`)
      results[num] = { exists: true, score }

    } catch {
      console.log(num, "→ ⚠️ LOOKUP ERROR\n")
      results[num] = { exists: "error", score: 0 }
    }

    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2))
    await new Promise(r => setTimeout(r, DELAY))
  }

  console.log("✅ DONE")
  console.log("📂 Saved to results.json")
  process.exit()
})
