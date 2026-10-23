/* Сборка мока: настоящий код модуля поверх заглушки Foundry (tools/mock-runtime.js), один html.
   Запуск: node tools/build-mock.mjs [--out docs/book-mock.html] */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { CONFIG_WFRP, WORLD_ITEMS, RECIPES, ACTOR, ACTOR2, ACTOR_NPC, SKILLS } from "./mock-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const require = createRequire(import.meta.url);

const outArg = process.argv.indexOf("--out");
const outPath = outArg > 0 ? process.argv[outArg + 1] : "docs/book-mock.html";

const handlebarsSrc = fs.readFileSync(require.resolve("handlebars/dist/handlebars.min.js"), "utf8");

const lang = JSON.parse(read("lang/ru.json"));
Object.assign(lang.TYPES.Item, { trapping: "Товар", weapon: "Оружие" }); // локализация типов - в живом Foundry её даёт система
const langEn = JSON.parse(read("lang/en.json"));
const templates = {
  "modules/wfrp4e-recipe-book/templates/book.hbs": read("templates/book.hbs"),
  "modules/wfrp4e-recipe-book/templates/recipe-sheet.hbs": read("templates/recipe-sheet.hbs"),
  "modules/wfrp4e-recipe-book/templates/item-forge.hbs": read("templates/item-forge.hbs"),
  "modules/wfrp4e-recipe-book/templates/starter.hbs": read("templates/starter.hbs")
};
const css = read("styles/rb-system.css") + "\n" + read("styles/recipe-book.css");

const stripModules = (src) => src.replace(/^import .*$/gm, "").replace(/^export /gm, "")
  .replaceAll("${MODULE_ID}", "wfrp4e-recipe-book"); // чтобы inlineAssets увидел пути ассетов в шаблонных строках
const appSrc = ["scripts/recipe-model.js", "scripts/recipe-book.js", "scripts/item-forge.js", "scripts/recipe-sheet.js", "scripts/recipe-from-item.js", "scripts/welcome.js", "scripts/starter-data.js", "scripts/starter-install.js", "scripts/main.js"]
  .map((p) => stripModules(read(p)))
  .join("\n");

const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

/* Ассеты модуля -> data URI, чтобы мок был одним файлом (как в paperdoll) */
const MIME = { png: "image/png", webp: "image/webp", svg: "image/svg+xml" };
const assetUri = (rel) => {
  const file = path.join(root, rel);
  const ext = rel.split(".").pop();
  return `data:${MIME[ext] ?? "application/octet-stream"};base64,` + fs.readFileSync(file).toString("base64");
};
// Вшиваем только настоящие файлы: в коде встречаются шаблонные пути (assets/icons/${file}) - их пропускаем
const inlineAssets = (text) => text.replace(/modules\/wfrp4e-recipe-book\/(assets\/[\w./-]+)/g,
  (m, rel) => (fs.existsSync(path.join(root, rel)) && fs.statSync(path.join(root, rel)).isFile() ? assetUri(rel) : m));

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Книга рецептов WFRP - мок</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>
  body { margin: 0; padding: 16px; background: #211d18; font-family: "Signika", "Segoe UI", system-ui, sans-serif; display: flex; gap: 16px; align-items: flex-start; }
  #mock-mount .window-app { position: relative; display: flex; flex-direction: column; border: 1px solid #555; border-radius: 6px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.5); background: #d8d1c2; }
  #mock-mount .window-header { display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: #15120f; color: #f0e6d2; font-size: 13px; }
  #mock-mount .window-title { flex: 1; }
  #mock-mount .window-header .header-control { background: none; border: none; color: #a89c86; cursor: pointer; width: auto; }
  /* как в живом AppV2: дети окна НЕ растягиваются автоматически - центрируются */
  #mock-mount .window-content { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; }
  /* как ядро Foundry: раздутые поля по умолчанию - модуль обязан их перебить */
  #mock-mount .window-content input, #mock-mount .window-content select { height: 38px; font-size: 16px; }
  .window-content input[type=checkbox] { width: 32px !important; height: 32px !important; }
  /* как скин системы: тёмная подложка и раздутые картинки */
  .window-content { background: #331a11 !important; color: #eee; }
  .window-content img { width: 40px; height: 40px; max-width: 100%; }
  .window-content > * { padding: 0 !important; }
  /* как скин системы: агрессивные стили кнопок - модуль обязан их перебить */
  .window-content button {
    background-image: linear-gradient(#f00, #900) !important; border: 3px double #000 !important;
    border-radius: 0 !important; box-shadow: 0 0 6px #f00 !important; outline: 2px solid #0f0 !important;
    text-transform: uppercase; text-shadow: 1px 1px 0 #000;
    letter-spacing: 2px; height: 44px; padding: 10px;
  }
  #mock-mount .window-content > * { flex: 1; min-height: 0; }
  #mock-chat { width: 260px; min-height: 120px; background: #efe9dc; border: 1px solid #555; border-radius: 6px; padding: 8px; font-size: 12px; }
  #mock-chat:before { content: "Чат"; display: block; font-weight: 700; margin-bottom: 6px; }
  .mock-chat-msg { border-top: 1px solid #ccc; padding: 4px 0; }
  .mock-toast { position: fixed; right: 16px; bottom: 16px; background: #442; color: #ffd; padding: 8px 12px; border-radius: 6px; z-index: 99; font-size: 13px; animation: up .2s; }
  .mock-toast--info { background: #243; color: #dfd; }
  .mock-toast + .mock-toast { bottom: 64px; }
  .mock-dialog-back { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 200; }
  .mock-dialog { min-width: 340px; max-width: 460px; background: var(--rb-bg); color: var(--rb-text); border: 1px solid var(--rb-frame-hi); border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
  .mock-dialog header { padding: 8px 14px; background: #15120f; color: #f0e6d2; font-size: 13px; border-radius: 6px 6px 0 0; }
  .mock-dialog section { padding: 14px; font-size: 13px; line-height: 1.45; }
  .mock-dialog section p { margin: 0; }
  .mock-dialog footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 14px 14px; }
  /* Панель мока */
  #mock-bar { position: fixed; top: 0; left: 0; right: 0; display: flex; gap: 8px; align-items: center; padding: 6px 16px; background: #15120f; color: #a89c86; font-size: 12px; z-index: 50; }
  #mock-bar b { color: #f0e6d2; }
  #mock-bar > button { background: #0b0907; color: #d8ccb4; border: 1px solid #4a4339; border-radius: 4px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
  #mock-bar > button:hover { background: #241e16; }
  #mock-bar .mock-hint { margin-left: auto; opacity: .7; }
  #mock-bar .rb-picker-host { position: absolute; top: 40px; width: 320px; z-index: 60; }
  body { padding-top: 48px; }
</style>
<style>${css}</style>
</head>
<body>
<div id="mock-bar">
  <b>Книга рецептов WFRP - мок v0.1</b>
  <button id="tb-theme">Тема: пергамент / тёмная</button>
  <button id="tb-open">Открыть книгу</button>
  <button id="tb-sheet">Лист рецепта (ГМ)</button>
  <button id="tb-view">Вид: ГМ / игрок</button>
  <button id="tb-starter">Стартовые рецепты (ГМ)</button>
  <button id="tb-fromitem">Рецепт из предмета (ГМ)</button>
  <button id="tb-reset">Сбросить всё</button>
  <span class="mock-hint">кубы эмулируются (в Foundry бросает система); перетаскивание на лист ГМа в моке не работает</span>
</div>
<div id="mock-mount"></div>
<div id="mock-chat"></div>
<script>${handlebarsSrc}</script>
<script>
window.__RB_LANG__ = ${json(lang)};
window.__RB_LANGS__ = { ru: ${json(lang)}, en: ${json(langEn)} };
window.__RB_TEMPLATES__ = ${inlineAssets(json(templates))};
window.__RB_ASSETS__ = ${json(Object.fromEntries(
  fs.readdirSync(path.join(root, "assets/icons")).filter((f) => f.endsWith(".png"))
    .map((f) => [`assets/icons/${f}`, assetUri(`assets/icons/${f}`)])
))};
window.__RB_CONFIG__ = ${json(CONFIG_WFRP)};
window.__RB_SKILLS__ = ${json(SKILLS)};
// Простые иконки-заглушки: цветной квадрат с первой буквой (в живом Foundry - картинки предметов)
window.__RB_ICON__ = (name = "?", type = "") => {
  const colors = ["8a6a2a","5f7a3a","3a6a7a","7a3a5a","6a4a2a","4a4a7a"];
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = colors[h % colors.length];
  const letter = String(name).trim()[0]?.toUpperCase() ?? "?";
  return "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="6" fill="#' + bg + '"/><text x="24" y="31" font-size="22" font-family="Georgia" text-anchor="middle" fill="#f0e6d2">' + letter + "</text></svg>");
};
</script>
<script>${stripModules(read("tools/mock-runtime.js"))}</script>
<script>
${inlineAssets(appSrc).replace(/<\/script/gi, "<\\/script")}
window.RB = { RecipeBookApp, RecipeSheet, startCraft, rollCraft, recipeStatus, MODULE_ID };
</script>
<script>
Hooks.call("init");
const worldItems = ${inlineAssets(json(WORLD_ITEMS))};
for (const w of worldItems) __RB_makeWorldItem__(w);
const recipes = ${inlineAssets(json(RECIPES))}.map((r, i) => ({ ...r, id: "rec-" + i, type: "wfrp4e-recipe-book.recipe" }));
const actorData = ${inlineAssets(json(ACTOR))};
actorData.items = [...actorData.items, ...recipes];
const actor = __RB_makeActor__(actorData);
window.__RB_actor__ = actor;
window.__RB_actor2__ = __RB_makeActor__(${inlineAssets(json(ACTOR2))});
__RB_makeActor__(${json(ACTOR_NPC)});
game.user.character = actor;
Hooks.call("ready");   // в Foundry это делает ядро; нам нужно для приветствия
game.modules.get("wfrp4e-recipe-book").api.open(actor);

document.getElementById("tb-theme").addEventListener("click", () => {
  const cur = game.settings.get("wfrp4e-recipe-book", "bookTheme");
  game.settings.set("wfrp4e-recipe-book", "bookTheme", cur === "dark" ? "parchment" : "dark");
});
document.getElementById("tb-open").addEventListener("click", () => game.modules.get("wfrp4e-recipe-book").api.open(actor));
document.getElementById("tb-sheet").addEventListener("click", () => {
  const app = [...RB.RecipeBookApp.instances.values()][0];
  const id = app?.selected?.kind === "recipe" ? app.selected.id
    : actor.items.find((i) => i.type === "wfrp4e-recipe-book.recipe")?.id;
  const doc = actor.items.get(id);
  if (doc) new RB.RecipeSheet({ document: doc, id: "rb-sheet-demo" }).render();
});
document.getElementById("tb-view").addEventListener("click", () => {
  game.settings.set("wfrp4e-recipe-book", "playerView", !game.settings.get("wfrp4e-recipe-book", "playerView"));
});
document.getElementById("tb-starter").addEventListener("click", () => new StarterRecipesApp().render(true));
// В Foundry это кнопка в шапке листа предмета; в моке листов системы нет - зовём ту же функцию через пикер
document.getElementById("tb-fromitem").addEventListener("click", (ev) => {
  openItemPicker(ev.currentTarget, async (entry) => {
    const doc = await fromUuid(entry.uuid);
    if (doc) createRecipeFromItem(doc);
  });
});
document.getElementById("tb-reset").addEventListener("click", () => location.reload());
</script>
</body>
</html>`;

fs.mkdirSync(path.join(root, path.dirname(outPath)), { recursive: true });
fs.writeFileSync(path.join(root, outPath), html);
console.log("мок собран:", outPath, `(${Math.round(html.length / 1024)} КБ)`);
