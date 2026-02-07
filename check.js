import makeWASocket from "@whiskeysockets/baileys"
import P from "pino"
import fs from "fs"

const log = P({ level: "silent" })

// ===== CONFIG =====
const DELAY = 2500 // 2.5 seconds between checks
const OUTPUT = "results.json"

// ===== LOAD NUMBERS =====
const numbers = fs.readFileSync("numbers.txt", "utf-8")
  .split("\n")
  .map(n => n.trim())
  .filter(Boolean)

// ===== HELPERS =====
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ===== MAIN =====
async function run() {
  const sock = makeWASocket({ logger: log })

  let results = {}

  for (const num of numbers) {
    const jid = num.replace("+", "") + "@s.whatsapp.net"
    let score = 0
    let info = {
      exists: false,
      profile_pic: false,
      name: false,
      score: 0
    }

    console.log("🔍 Checking", num)

    try {
      // 1️⃣ Exists on WhatsApp
      const wa = await sock.onWhatsApp(jid)
      if (!wa || !wa[0]?.exists) {
        console.log(num, "→ ❌ NOT ON WHATSAPP\n")
        continue
      }

      score += 30
      info.exists = true

      // 2️⃣ Profile picture (strong signal of old account)
      try {
        await sock.profilePictureUrl(jid)
        score += 40
        info.profile_pic = true
      } catch {}

      // 3️⃣ WhatsApp name
      try {
        const contact = sock.contacts[jid]
        if (contact?.notify || contact?.name) {
          score += 20
          info.name = true
        }
      } catch {}

      // 4️⃣ Stability bonus
      score += 10

    } catch (e) {
      console.log(num, "→ ⚠️ ERROR\n")
      continue
    }

    info.score = score
    results[num] = info

    // OUTPUT RESULT
    let tag =
      score >= 80 ? "🟢 OLD / STABLE" :
      score >= 60 ? "🟡 NORMAL" :
      "🔴 FRESH / RISKY"

    console.log(`${num} → SCORE: ${score} ${tag}\n`)

    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2))
    await sleep(DELAY)
  }

  console.log("✅ DONE. Results saved in", OUTPUT)
  process.exit()
}

run()})()
