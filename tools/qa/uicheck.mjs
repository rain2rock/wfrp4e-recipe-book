/**
 * Аудит вёрстки: сверяет реальную геометрию окон с токенами дизайн-системы.
 * Ловит «уехавшие» отступы, разнобой кнопок и размеров иконок, горизонтальные переполнения.
 * Запуск: node tools/qa/uicheck.mjs docs/book-mock.html
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mock = process.argv[2] ?? "docs/book-mock.html";
const SPACE = [0, 2, 4, 6, 8, 10, 12, 14, 16];      // шкала --rb-space-* (+0 и 2 для микросдвигов)
const ICONS = [16, 20, 24, 26, 42, 44, 88, 90, 96, 144, 150]; // иконки с рамками

let pass = 0, fail = 0;
const ok = (c, name, extra = "") => (c ? (pass++, console.log(`PASS ${name}`)) : (fail++, console.log(`FAIL ${name} ${extra}`)));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => { fail++; console.log("FAIL pageerror:", e.message); });
await page.goto("file://" + path.join(root, mock));
await page.waitForSelector(".rb-root");

/** Открыть все окна модуля разом */
const rid = await page.evaluate(async () => {
  const r = await Item.create({ name: "UI", type: "wfrp4e-recipe-book.recipe", img: "" });
  r.sheet.render(true);
  return r.id;
});
await page.waitForTimeout(250);
await page.click(`#rb-sheet-${rid} [data-action='openForge']`);
await page.click("#tb-starter");
await page.waitForTimeout(400);

const audit = await page.evaluate((spaceScale) => {
  const px = (v) => Math.round(parseFloat(v) || 0);
  const out = { pads: [], btns: [], rows: [], imgs: [], overflow: [], checks: [], placeholders: [], focus: [] };

  // 1a. Корни окон: отступ от краёв обязателен (10-16px по шкале)
  out.rootPads = [];
  for (const sel of [".rb-page", ".rb-sheet-root", ".rb-forge-root", ".rb-starter-root"]) {
    for (const el of document.querySelectorAll(sel)) {
      if (!el.offsetParent) continue;
      const s = getComputedStyle(el);
      for (const side of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
        const v = px(s[side]);
        if (v < 10 || v > 16) out.rootPads.push(`${sel}.${side}=${v}`);
      }
    }
  }
  // 1b. Прокручиваемые области и панели: любой отступ, но по шкале
  for (const sel of [".rb-sheet-scroll", ".rb-forge-scroll", ".rb-starter-scroll", ".rb-picker", ".rb-right-scroll"]) {
    for (const el of document.querySelectorAll(sel)) {
      if (!el.offsetParent) continue;
      const s = getComputedStyle(el);
      for (const side of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
        const v = px(s[side]);
        if (!spaceScale.includes(v)) out.pads.push(`${sel}.${side}=${v}`);
      }
    }
  }
  // 2. Кнопки: единый кегль, высота не ниже 24
  const btns = [...document.querySelectorAll(".rb-btn")].filter((b) => b.offsetParent);
  const sizes = new Set(btns.map((b) => getComputedStyle(b).fontSize));
  out.btns.push(...[...sizes]);
  for (const b of btns) {
    const h = Math.round(b.getBoundingClientRect().height);
    if (h < 22) out.btns.push(`низкая кнопка ${h}px: ${b.textContent.trim().slice(0, 18)}`);
  }
  // 3. Строки: вертикальные паддинги по шкале
  for (const el of document.querySelectorAll(".rb-row, .rb-field, .rb-entry")) {
    if (!el.offsetParent) continue;
    const s = getComputedStyle(el);
    for (const side of ["paddingTop", "paddingBottom"]) {
      const v = px(s[side]);
      if (!spaceScale.includes(v)) out.rows.push(`${el.className.split(" ")[0]}.${side}=${v}`);
    }
  }
  // 4. Картинки: размеры из набора
  for (const img of document.querySelectorAll(".wfrp-recipe-book img")) {
    if (!img.offsetParent) continue;
    const w = Math.round(img.getBoundingClientRect().width);
    if (w) out.imgs.push(w);
  }
  // 5. Горизонтальное переполнение в прокручиваемых областях
  for (const sel of [".rb-list", ".rb-right-scroll", ".rb-sheet-scroll", ".rb-forge-scroll", ".rb-starter-scroll"]) {
    for (const el of document.querySelectorAll(sel)) {
      if (el.scrollWidth > el.clientWidth + 1) out.overflow.push(`${sel}: ${el.scrollWidth}>${el.clientWidth}`);
    }
  }
  // 6. Чекбоксы одного размера
  for (const cb of document.querySelectorAll(".wfrp-recipe-book input[type=checkbox]")) {
    if (!cb.offsetParent) continue;
    out.checks.push(Math.round(cb.getBoundingClientRect().width));
  }
  // 7. UX: интерактивные элементы без доступного имени
  out.nameless = [...document.querySelectorAll(".wfrp-recipe-book button")]
    .filter((b) => b.offsetParent && !b.textContent.trim() && !b.dataset.rbTip && !b.getAttribute("aria-label") && !b.title)
    .map((b) => b.className.split(" ").at(-1));
  out.unlabeled = [...document.querySelectorAll(".wfrp-recipe-book input[type=text], .wfrp-recipe-book input[type=number], .wfrp-recipe-book select")]
    .filter((i) => i.offsetParent && !i.placeholder && !i.getAttribute("aria-label") && !i.closest("label") &&
      !i.closest(".rb-field")?.querySelector("label,span"))
    .map((i) => i.className.split(" ").at(-1));
  out.cbNoLabel = [...document.querySelectorAll(".wfrp-recipe-book input[type=checkbox]")]
    .filter((c) => c.offsetParent && !c.closest("label")).length;
  out.clipped = [...document.querySelectorAll(".wfrp-recipe-book .rb-entry-name, .wfrp-recipe-book .rb-ing-name")]
    .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 2 && !e.closest("[data-rb-tip],[data-rbtt]")).length;

  // 8. Неподставленные плейсхолдеры: ключ попал в разметку мимо F()
  const PH = /\{[a-zA-Z]\w*\}/;
  for (const el of document.querySelectorAll(".wfrp-recipe-book [data-rb-tip]")) {
    if (PH.test(el.dataset.rbTip)) out.placeholders.push(`tip ${el.className.split(" ")[0]}: ${el.dataset.rbTip.slice(0, 40)}`);
  }
  for (const el of document.querySelectorAll(".wfrp-recipe-book, #rb-tooltip")) {
    for (const node of el.querySelectorAll("*")) {
      if (node.children.length || node.tagName === "INPUT") continue;
      const t = node.textContent ?? "";
      if (PH.test(t)) out.placeholders.push(`text ${node.className.split(" ")[0]}: ${t.slice(0, 40)}`);
    }
  }

  // 9. Фокус рисуется внутрь
  for (const el of document.querySelectorAll(".wfrp-recipe-book input, .wfrp-recipe-book .rb-btn")) {
    const off = parseFloat(getComputedStyle(el).outlineOffset) || 0;
    if (off > 0) out.focus.push(`${el.className.split(" ")[0]}=${off}`);
  }
  return out;
}, SPACE);

ok(audit.rootPads.length === 0, "у каждого окна есть отступ от краёв (10-16px)", audit.rootPads.slice(0, 8).join(", "));
ok(audit.pads.length === 0, "паддинги панелей и прокрутки - по шкале токенов", audit.pads.slice(0, 6).join(", "));
ok(audit.btns.filter((x) => typeof x === "string" && x.includes("px:")).length === 0, "нет слишком низких кнопок", audit.btns.filter((x) => String(x).includes("px:")).join("; "));
const fontSizes = audit.btns.filter((x) => /^\d/.test(String(x)));
ok(fontSizes.length === 1, "у всех кнопок один кегль", fontSizes.join(", "));
ok(audit.rows.length === 0, "вертикальные отступы строк - по шкале", [...new Set(audit.rows)].slice(0, 6).join(", "));
const badImgs = [...new Set(audit.imgs)].filter((w) => !ICONS.includes(w));
ok(badImgs.length === 0, "размеры картинок - из набора токенов", badImgs.join(", "));
ok(audit.overflow.length === 0, "нет горизонтальных переполнений", audit.overflow.join("; "));
const cbSizes = [...new Set(audit.checks)];
ok(cbSizes.length <= 1, "чекбоксы одного размера", cbSizes.join(", "));
ok(audit.focus.length === 0, "обводка фокуса рисуется внутрь", [...new Set(audit.focus)].join(", "));
ok(audit.nameless.length === 0, "у кнопок есть подпись или подсказка", audit.nameless.join(", "));
ok(audit.unlabeled.length === 0, "у полей есть подпись, плейсхолдер или aria-label", audit.unlabeled.join(", "));
ok(audit.cbNoLabel === 0, "подпись каждого чекбокса кликабельна", String(audit.cbNoLabel));
ok(audit.clipped === 0, "обрезанный текст доступен в подсказке", String(audit.clipped));
ok(audit.placeholders.length === 0, "в текстах нет неподставленных {плейсхолдеров}", [...new Set(audit.placeholders)].slice(0, 5).join("; "));

console.log(`\nИтог вёрстки: PASS ${pass}, FAIL ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
