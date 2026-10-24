/* Перф книги: раздуваем мир до 186 рецептов и 473 предметов и меряем подготовку контекста.
   Порог с запасом: на такой выборке рендер обязан укладываться в 15 мс (сейчас ~2).
   Был и антипаттерн: статус считался заново для каждого счётчика, а каждый ингредиент
   обходил весь инвентарь - отсюда 50 мс. Срез инвентаря (actorIndex) убрал это.
   Запуск: node tools/qa/perfchk.mjs */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIMIT = 15;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("file://" + path.join(root, process.argv[2] ?? "docs/book-mock.html"));
await page.waitForSelector(".wfrp-recipe-book .rb-root");

const r = await page.evaluate(async () => {
  const app = [...window.RB.RecipeBookApp.instances.values()][0];
  if (!app) return { err: "книга не открыта" };
  const actor = app.actor;
  const recipes = app.recipes();
  const stock = [...actor.items].filter((i) => i.system?.quantity !== undefined);
  const clone = (it, i) => {
    const c = Object.create(Object.getPrototypeOf(it));
    Object.assign(c, it, { id: `${it.id}_${i}`, _id: `${it.id}_${i}` });
    c.system = JSON.parse(JSON.stringify(it.system));
    return c;
  };
  for (let i = 0; i < 30; i++) {
    for (const rec of recipes) actor.items.push(clone(rec, i));
    for (const s of stock) actor.items.push(clone(s, i));
  }
  const N = 10;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) await app._prepareContext();
  return { ms: +((performance.now() - t0) / N).toFixed(1), recipes: app.recipes().length, items: [...actor.items].length };
});
await browser.close();

if (r.err) { console.log("FAIL", r.err); process.exit(1); }
const good = r.ms <= LIMIT;
console.log(`${good ? "PASS" : "FAIL"} подготовка контекста ${r.ms} мс (предел ${LIMIT}) при ${r.recipes} рецептах и ${r.items} предметах`);
process.exit(good ? 0 : 1);
