// Calibration probe 2: HARDER pool, greedy (temp:0, seed:1), no thinking, per-problem.
// Goal: find a real capability gradient (4B fails some, 9B more, MoE most).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadModel, unloadModel, completion } from "@qvac/sdk";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out_probe2");
fs.mkdirSync(OUT, { recursive: true });
const M = (f) => path.join(os.homedir(), ".qvac/models", f);

const MODELS = [
  { tag: "qwen3.5-4b", label: "Qwen3.5-4B", src: M("3a65a2a3c6a30a47_Qwen3.5-4B-Q4_K_M.gguf") },
  { tag: "qwen3.5-9b", label: "Qwen3.5-9B", src: M("5b76987f21ace455_Qwen3.5-9B-Q4_K_M.gguf") },
  { tag: "qwen3.6-35b-a3b", label: "Qwen3.6-35B-A3B (MoE)", src: M("adefa915d57a5c77_Qwen3.6-35B-A3B-UD-Q4_K_M.gguf") },
];

const POOL = [
  { id: "pairs", exp: 170, text: "How many ordered pairs of positive integers (a, b) with 1 <= a <= 100 and 1 <= b <= 100 satisfy that (a + b) divides (a * b)?" },
  { id: "euler", exp: 14, text: "For how many integers n with 1 <= n <= 100 is n^2 + n + 41 a composite number (not prime)?" },
  { id: "fib", exp: 75, text: "Let F(1) = F(2) = 1 and F(n) = F(n-1) + F(n-2) for n >= 3. What is the remainder when F(100) is divided by 1000?" },
  { id: "walk", exp: 120, text: "A token starts at position 0 and makes exactly 10 moves, each +2 or -1. The position must never be negative after any move, and must equal 8 after the 10th move. How many different move sequences satisfy this?" },
  { id: "subsets", exp: 144, text: "How many subsets of {1, 2, 3, 4, 5, 6, 7, 8, 9, 10} contain no two consecutive integers? (The empty set counts.)" },
  { id: "change50", exp: 49, text: "In how many ways can you make 50 cents using pennies (1 cent), nickels (5 cents), dimes (10 cents), and quarters (25 cents)?" },
  { id: "mod3", exp: 1, text: "What is the remainder when 3^100 is divided by 100?" },
  { id: "sqnotcube", exp: 96, text: "How many integers from 1 to 10000 inclusive are perfect squares but not perfect cubes?" },
  { id: "triples", exp: 12, text: "How many triples of integers (a, b, c) with a < b < c and each at least 1 satisfy a + b + c = 15?" },
  { id: "flush", exp: 5148, text: "From a standard 52-card deck (13 ranks in each of 4 suits), how many 5-card hands consist of 5 cards all of the same suit?" },
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

const results = { startedAt: new Date().toISOString(), machine: "Apple M5 Max, 36 GB", thinking: false, greedy: true, seed: 1, predict: 5000, models: MODELS.map(m => m.tag), pool: POOL.map(p => ({ id: p.id, exp: p.exp })), byModel: {} };
const RES = path.join(DIR, "probe2.json");

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
      const r = await runOne(modelId, p.text, 5000);
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
console.log("\n[PROBE2] DONE -> probe2.json");
process.exit(0);
