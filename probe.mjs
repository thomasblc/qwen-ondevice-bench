// Calibration probe: run a POOL of candidate problems across 3 models (no thinking), per-problem,
// to find which land in each difficulty bucket. Compose the final 5 from this matrix, no re-run.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadModel, unloadModel, completion } from "@qvac/sdk";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out_probe");
fs.mkdirSync(OUT, { recursive: true });
const M = (f) => path.join(os.homedir(), ".qvac/models", f);

const MODELS = [
  { tag: "qwen3.5-4b", label: "Qwen3.5-4B", src: M("3a65a2a3c6a30a47_Qwen3.5-4B-Q4_K_M.gguf") },
  { tag: "qwen3.5-9b", label: "Qwen3.5-9B", src: M("5b76987f21ace455_Qwen3.5-9B-Q4_K_M.gguf") },
  { tag: "qwen3.6-35b-a3b", label: "Qwen3.6-35B-A3B (MoE)", src: M("adefa915d57a5c77_Qwen3.6-35B-A3B-UD-Q4_K_M.gguf") },
];

const POOL = [
  { id: "A_balls", exp: 44, text: "In how many ways can 10 identical balls be distributed into 4 distinct boxes so that each box contains at least 1 and at most 4 balls?" },
  { id: "B_base12z", exp: 48, text: "How many trailing zeros does 100! (100 factorial) have when it is written in base 12?" },
  { id: "C_paths", exp: 126, text: "On a grid, how many shortest lattice paths go from (0, 0) to (5, 4), moving only one unit right or one unit up at each step?" },
  { id: "D_committee", exp: 666, text: "A group has 12 people, 3 of whom are officers. How many different 5-person committees can be formed that include at least one officer?" },
  { id: "E_crt", exp: 59, text: "What is the smallest positive integer that leaves remainder 1 when divided by 2, remainder 2 when divided by 3, remainder 3 when divided by 4, remainder 4 when divided by 5, and remainder 5 when divided by 6?" },
  { id: "F_distinct4", exp: 4536, text: "How many 4-digit numbers (from 1000 to 9999) have all four digits distinct?" },
  { id: "G_div", exp: 401, text: "How many integers from 1 to 1000 inclusive are divisible by 3 or by 5, but not by 7?" },
  { id: "H_domino", exp: 89, text: "In how many ways can a 2-by-10 rectangle be completely tiled using 1-by-2 dominoes (each domino placed horizontally or vertically)?" },
  { id: "I_coeff", exp: 1452, text: "What is the coefficient of x^5 in the expansion of (1 + x + x^2)^10?" },
  { id: "J_div20fact", exp: 41040, text: "How many positive divisors does 20! (20 factorial) have?" },
  { id: "K_digitsum", exp: 66, text: "How many 3-digit numbers (from 100 to 999) have digits that sum to exactly 12?" },
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

const results = { startedAt: new Date().toISOString(), machine: "Apple M5 Max, 36 GB", thinking: false, greedy: true, seed: 1, predict: 4000, models: MODELS.map(m => m.tag), pool: POOL.map(p => ({ id: p.id, exp: p.exp })), byModel: {} };
const RES = path.join(DIR, "probe.json");

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
      const r = await runOne(modelId, p.text, 4000);
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
console.log("\n[PROBE] DONE -> probe.json");
process.exit(0);
