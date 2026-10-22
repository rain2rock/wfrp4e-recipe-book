/**
 * Линт дизайн-системы (по образцу wfrp4e-paperdoll): ловит «сырые» пиксели в CSS,
 * которые должны быть токенами из styles/rb-system.css. Нарушение:
 *   - border-radius с px-литералом 4px+ (нужен var(--rb-radius*) | 50% | 0);
 *   - font-size с px-литералом (нужна шкала var(--rb-fs-*); определения токенов не считаются);
 *   - padding / margin / gap со значением 4px и больше (нужен var(--rb-space-*);
 *     1-3px - микросдвиги, их не трогаем).
 * FAIL - только если нарушений стало БОЛЬШЕ, чем в tools/qa/dslint-baseline.json.
 * Починил часть - обнови базлайн: node tools/qa/dslint.mjs --update
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE = path.join(root, "tools/qa/dslint-baseline.json");
const FILES = ["styles/rb-system.css", "styles/recipe-book.css"];

const RULES = [
  { name: "border-radius в px", re: /border-radius:[^;}]*?\b([4-9]|\d{2,})px/g },
  { name: "font-size в px", re: /font-size:\s*\d+(\.\d+)?px/g },
  { name: "отступ в px (4px и больше)", re: /(?:padding|margin|gap|column-gap|row-gap):[^;}]*?\b(?:[4-9]|\d{2,})(?:\.\d+)?px/g }
];

const count = (file) => {
  // Комментарии и блок определения токенов не считаем
  const css = fs.readFileSync(path.join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--rb-[\w-]+:\s*[^;]+;/g, "");
  const out = {};
  for (const r of RULES) out[r.name] = [...css.matchAll(r.re)].length;
  return out;
};

const current = Object.fromEntries(FILES.map((f) => [f, count(f)]));

if (process.argv.includes("--update")) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log("базлайн обновлён:", BASELINE);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : {};
let failed = false;
for (const [file, byRule] of Object.entries(current)) {
  for (const [rule, n] of Object.entries(byRule)) {
    const was = baseline[file]?.[rule] ?? 0;
    if (n > was) {
      failed = true;
      console.log(`FAIL ${file}: «${rule}» ${was} -> ${n}. Используй токены из styles/rb-system.css`);
    } else if (n < was) {
      console.log(`меньше нарушений в ${file} («${rule}» ${was} -> ${n}) - обнови базлайн: node tools/qa/dslint.mjs --update`);
    }
  }
}
console.log(failed ? "dslint: FAIL" : "dslint: ok");
process.exit(failed ? 1 : 0);
