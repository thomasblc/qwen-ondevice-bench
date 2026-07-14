// Calibration probe 3: graded-length iterative + conceptual problems, greedy, to fill the
// 4B/9B middle band and add MoE-only problems. Combine with probe2 to compose the final 5.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadModel, unloadModel, completion } from "@qvac/sdk";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out_probe3");
fs.mkdirSync(OUT, { recursive: true });
const M = (f) => path.join(os.homedir(), ".qvac/models", f);

const MODELS = [
  { tag: "qwen3.5-4b", label: "Qwen3.5-4B", src: M("3a65a2a3c6a30a47_Qwen3.5-4B-Q4_K_M.gguf") },
  { tag: "qwen3.5-9b", label: "Qwen3.5-9B", src: M("5b76987f21ace455_Qwen3.5-9B-Q4_K_M.gguf") },
  { tag: "qwen3.6-35b-a3b", label: "Qwen3.6-35B-A3B (MoE)", src: M("adefa915d57a5c77_Qwen3.6-35B-A3B-UD-Q4_K_M.gguf") },
];

const POOL = [
  { id: "fib60", exp: 961, text: "Let F(1) = F(2) = 1 and F(n) = F(n-1) + F(n-2) for n >= 3. What is the remainder when F(60) is divided by 1000?" },
  { id: "fib80", exp: 906, text: "Let F(1) = F(2) = 1 and F(n) = F(n-1) + F(n-2) for n >= 3. What is the remainder when F(80) is divided by 1000?" },
  { id: "fib90", exp: 309, text: "Let F(1) = F(2) = 1 and F(n) = F(n-1) + F(n-2) for n >= 3. What is the remainder when F(90) is divided by 1000?" },
  { id: "sumprimes50", exp: 5117, text: "What is the sum of the first 50 prime numbers?" },
  { id: "collatz27", exp: 111, text: "Start with the number 27. Repeat this rule: if the number is even, divide it by 2; if it is odd, multiply by 3 and add 1. How many steps does it take to first reach 1?" },
  { id: "teams", exp: 35, text: "In how many ways can 8 people be divided into two teams of 4, where the two teams are indistinguishable (unlabeled)?" },
  { id: "surj", exp: 1806, text: "In how many ways can 7 distinct books be distributed to 3 different students so that each student receives at least one book?" },
  { id: "recur20", exp: 2097151, text: "A sequence is defined by a(1) = 3 and a(n) = 2*a(n-1) + 1 for n >= 2. What is a(20)?" },
  { id: "digit20fact", exp: 54, text: "What is the sum of the decimal digits of 20! (20 factorial)?" },
];

const PREAMBLE = "Solve this math problem. Think step by step and show your working. Then, on the final line, write exactly \"ANSWER: <integer>\" and nothing else after it.\n\n";

async function runOne(modelId, problem, predict) {
  const t0 = Date.now();
  let wallTtft = null, text = "";
  const run = completion({ modelId, history: [{ role: "user", content: PREAMBLE + problem }], stream: true, generationParams: { predict } });
  for await (const ev of run.events) {
    if (ev.type === "contentDelta") { if (wallTtft === null) wallTtft = Date.now() - t0; text += ev.text; }
  }
  let final = {}; try { final = await run.final; } catch {}
  const totalMs = Date.now() - t0;
  const s = (final && final.stats) || {};
  const content = (final && final.contentText) || text;
  const genTok = s.generatedTokens != null ? s.generatedTokens : Math.round((content || "").length / 4);
  const ttft = s.timeToFirstToken != null ? +s.timeToFirstToken.toFixed(1) : (wallTtft || totalMs);
  const tokPerSec = s.tokensPerSecond != null ? +s.tokensPerSecond.toFixed(1)
    : (genTok > 0 && wallTtft != null ? +(genTok / (Math.max(1, totalMs - ttft) / 1000)).toFixed(1) : 0);
  return { text: content, ttft, totalMs, genTok, tokPerSec };
}

function extractLast(text) {
  const re = /ANSWER:?\s*\**\s*(-?\d[\d,]*)/gi; let m, last = null;
  while ((m = re.exec(text)) !== null) last = parseInt(m[1].replace(/,/g, ""), 10);
  return last;
}

const results = { startedAt: new Date().toISOString(), machine: "Apple M5 Max, 36 GB", thinking: false, greedy: true, seed: 1, predict: 6000, models: MODELS.map(m => m.tag), pool: POOL.map(p => ({ id: p.id, exp: p.exp })), byModel: {} };
const RES = path.join(DIR, "probe3.json");

for (const m of MODELS) {
  console.log(`\n=== MODEL ${m.label} ===`);
  let modelId;
  try {
    modelId = await loadModel({ modelSrc: m.src, modelType: "llamacpp-completion", modelConfig: { device: "gpu", ctx_size: 8192, reasoning_budget: 0, temp: 0, seed: 1 } });
    console.log(`[load] ${m.label}`);
  } catch (e) { console.log(`[load] ${m.label} FAILED: ${e?.message || e}`); continue; }
  const rows = [];
  let out = "";
  for (const p of POOL) {
    try {
      const r = await runOne(modelId, p.text, 6000);
      const given = extractLast(r.text);
      const correct = given === p.exp;
      rows.push({ id: p.id, exp: p.exp, given, correct, ms: r.totalMs, genTok: r.genTok, decodeTokS: r.tokPerSec, ttftMs: r.ttft });
      out += `\n\n===== ${p.id}  (exp ${p.exp}, given ${given}, ${correct ? "OK" : "WRONG"}) =====\n${r.text}`;
      console.log(`[${p.id}] ${m.label}  given=${given} exp=${p.exp} ${correct ? "OK " : "XX "} ${(r.totalMs/1000).toFixed(1)}s ${r.genTok}tok`);
    } catch (e) {
      rows.push({ id: p.id, exp: p.exp, given: null, correct: false, error: String(e?.message || e) });
      console.log(`[${p.id}] ${m.label} ERROR ${e?.message || e}`);
    }
  }
  fs.writeFileSync(path.join(OUT, `${m.tag}.txt`), out);
  results.byModel[m.tag] = rows;
  fs.writeFileSync(RES, JSON.stringify(results, null, 2));
  const score = rows.filter(r => r.correct).length;
  console.log(`[MODEL DONE] ${m.label}  ${score}/${POOL.length} correct`);
  try { await unloadModel({ modelId, clearStorage: false }); } catch {}
}
results.finishedAt = new Date().toISOString();
fs.writeFileSync(RES, JSON.stringify(results, null, 2));
console.log("\n[PROBE3] DONE -> probe3.json");
process.exit(0);
