/**
 * Витрина дизайн-системы: docs/styleguide.html (npm run styleguide).
 * Статическая страница с настоящими стилями модуля: токены, кнопки, чипы, поля,
 * строки, монеты, тултипы, пикер - всё, чем собираются окна. Сверяться сюда.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const css = [read("styles/rb-system.css"), read("styles/recipe-book.css")].join("\n");
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const ICON = (bg = "8a6a2a", letter = "Т") => "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='48' height='48' rx='6' fill='#${bg}'/><text x='24' y='31' font-size='22' font-family='Georgia' text-anchor='middle' fill='#f0e6d2'>${letter}</text></svg>`);

const section = (title, note, html, refs = "") => `
  <section class="sg-section">
    <h2>${title}</h2>
    ${note ? `<p class="sg-note">${note}</p>` : ""}
    <div class="sg-demo wfrp-recipe-book">${html}</div>
    ${refs ? `<code class="sg-refs">${esc(refs)}</code>` : ""}
  </section>`;

const spaces = [1, 2, 3, 4, 5, 6, 7]
  .map((n) => `<div class="sg-space"><i style="width: var(--rb-space-${n})"></i>--rb-space-${n}</div>`).join("");
const radii = ["radius", "radius-lg", "radius-xl", "radius-pill"]
  .map((k) => `<div class="sg-radius"><i style="border-radius: var(--rb-${k})"></i>--rb-${k}</div>`).join("");
const fonts = ["xs", "s", "m", "base", "l", "xl", "xxl"]
  .map((k) => `<div style="font-size: var(--rb-fs-${k})">--rb-fs-${k} · Книга рецептов</div>`).join("");
const colors = ["text", "text-2", "text-dim", "muted", "frame", "frame-hi", "well", "panel", "gold", "gold-soft", "good", "bad", "warn", "hover"]
  .map((k) => `<div class="sg-color"><i style="background: var(--rb-${k})"></i>--rb-${k}</div>`).join("");

const body = `
${section(
  "Токены: отступы, радиусы, шрифты, цвета",
  "Все зазоры и паддинги - шкалой --rb-space-*, радиусы - --rb-radius*, шрифты - --rb-fs-*, цвета - переменными темы. Сырые px в стилях запрещены (ловит tools/qa/dslint.mjs, базлайн нулевой). Размеры: --rb-icon-s/l (иконки), --rb-coin (монета), --rb-btn-h / --rb-btn-minw (кнопки), --rb-num-w (числовые поля).",
  `<div class="sg-cols"><div>${spaces}<div style="margin-top: 10px">${radii}</div></div><div>${fonts}</div><div>${colors}</div></div>`,
  "--rb-space-1..7, --rb-radius(-lg|-xl|-pill), --rb-fs-xs..xxl, --rb-icon-s/l, --rb-coin, --rb-btn-h, --rb-btn-minw, --rb-num-w(-coin)"
)}
${section(
  "Кнопки",
  "Любая кнопка - .rb-btn, единая высота --rb-btn-h. Один размер текста у ВСЕХ кнопок; --primary - акцент главного действия (золотая рамка + жирный; --craft - синоним), --quiet - без подложки. В футерах текстовые кнопки получают min-width: --rb-btn-minw. Квадратные иконко-кнопки: .rb-add («+» в заголовке секции), .rb-remove (крестик строки, при наведении краснеет).",
  `<button type="button" class="rb-btn rb-btn--primary"><i class="fa-solid fa-dice-d20"></i> Изготовить</button>
   <button type="button" class="rb-btn">Изменить</button>
   <button type="button" class="rb-btn rb-btn--quiet">Отмена</button>
   <button type="button" class="rb-btn" disabled>Недоступно</button>
   <button type="button" class="rb-btn rb-btn--quiet rb-add"><i class="fa-solid fa-plus"></i></button>
   <button type="button" class="rb-btn rb-btn--quiet rb-remove"><i class="fa-solid fa-xmark"></i></button>`,
  ".rb-btn(--primary|--craft|--quiet)[disabled], .rb-add, .rb-remove"
)}
${section(
  "Чипы-фильтры",
  "Панель .rb-filters, чип .rb-filter (+ .is-active). Счётчик - .rb-count. Пунктирный модификатор --world - для ГМ-вкладки «Мир».",
  `<div class="rb-filters">
     <button type="button" class="rb-filter is-active">Все <span class="rb-count">5</span></button>
     <button type="button" class="rb-filter">Могу сделать <span class="rb-count">3</span></button>
     <button type="button" class="rb-filter">Не хватает</button>
     <button type="button" class="rb-filter rb-filter--world">Мир <span class="rb-count">2</span></button>
   </div>`,
  ".rb-filters, .rb-filter(.is-active, --world), .rb-count"
)}
${section(
  "Поля ввода",
  "База для input/select/textarea задаётся элементным селектором (колодец + рамка, фокус золотой). Селект - свой шеврон с отступом. Числовое поле .rb-num; единицы - .rb-unit; монета внутри поля - обёртка .rb-coinfield; поиск с лупой - .rb-search; строка формы - .rb-field (подпись 38% слева).",
  `<div style="display: flex; flex-direction: column; gap: var(--rb-space-3); width: 360px">
     <div class="rb-search"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Поиск рецепта..."></div>
     <div class="rb-field"><label>Навык</label><select><option>Ремесло (Аптекарь)</option><option>Ремесло (Кузнец)</option></select></div>
     <div class="rb-field"><label>Нужный уровень успеха</label><input type="number" class="rb-num" value="5"></div>
     <div class="rb-field"><label>Время</label><span class="rb-money-fields">
       <input type="number" class="rb-num" value="1"><span class="rb-unit">д</span>
       <input type="number" class="rb-num" value="3"><span class="rb-unit">ч</span></span></div>
     <div class="rb-field"><label>Прочее сырьё</label><span class="rb-money-fields">
       <label class="rb-coinfield"><i class="rb-coin-dot rb-coin-dot--gc"></i><input type="number" class="rb-num" value="2"></label>
       <label class="rb-coinfield"><i class="rb-coin-dot rb-coin-dot--ss"></i><input type="number" class="rb-num" value="8"></label>
       <label class="rb-coinfield"><i class="rb-coin-dot rb-coin-dot--bp"></i><input type="number" class="rb-num" value="6"></label></span></div>
   </div>`,
  "input/select/textarea (база), .rb-search, .rb-field, .rb-num, .rb-unit, .rb-coinfield, .rb-money-fields"
)}
${section(
  "Секции и строки",
  "Заголовок секции - .rb-block-title (капитель с золотой чертой; в листе ГМа - flex c «+» справа). Строка предмета - .rb-row.rb-ing: иконка, имя, счётчик справа; .is-ok / .is-bad красят счётчик. FA-иконка в рамке - .rb-ing-ico. Зона перетаскивания - [data-dropzone] (пунктир).",
  `<div style="width: 420px">
     <div class="rb-block-title">Ингредиенты</div>
     <div class="rb-row rb-ing is-ok"><span class="rb-ing-name"><img src="${ICON("5f7a3a", "Т")}" alt="">Целебные травы</span><span class="rb-ing-count">3 / 2</span></div>
     <div class="rb-row rb-ing is-bad"><span class="rb-ing-name"><img src="${ICON("7a3a5a", "М")}" alt="">Корень мандрагоры</span><span class="rb-ing-count">0 / 1</span></div>
     <div class="rb-row rb-ing"><span class="rb-ing-name"><span class="rb-ing-ico"><i class="fa-regular fa-clock"></i></span>Время на изготовление</span><span class="rb-ing-count">1д 3ч</span></div>
     <div class="rb-row"><span>Нужный уровень успеха</span><span><b>3</b> <span class="rb-dim">(5 − 2 за талант)</span></span></div>
   </div>`,
  ".rb-block-title, .rb-row(.is-bad), .rb-ing(.is-ok|.is-bad), .rb-ing-name, .rb-ing-count, .rb-ing-ico, .rb-dim, [data-dropzone]"
)}
${section(
  "Список книги",
  "Запись - кнопка .rb-entry (иконка + имя + статус): .rb-ready - доступен (жирное имя + галка .rb-ok-ico), .is-selected - выбран. Группы - .rb-group-title. Прогресс проекта в строке - .rb-mini-progress.",
  `<div style="width: 300px; display: flex; flex-direction: column; gap: 2px">
     <div class="rb-group-title">Ремесло (Аптекарь)</div>
     <button type="button" class="rb-entry rb-ready is-selected"><img src="${ICON("3a6a7a", "Л")}" alt=""><span class="rb-entry-name">Лечебная настойка</span><i class="fa-solid fa-circle-check rb-ok-ico"></i></button>
     <button type="button" class="rb-entry"><img src="${ICON("7a3a5a", "П")}" alt=""><span class="rb-entry-name">Противоядие</span></button>
     <button type="button" class="rb-entry rb-project"><img src="${ICON("6a4a2a", "Д")}" alt=""><span class="rb-entry-name">Дорожный паёк ×5</span><span class="rb-mini-progress"><span style="width: 40%"></span></span></button>
   </div>`,
  ".rb-group-title, .rb-entry(.rb-ready|.is-selected), .rb-entry-name, .rb-ok-ico, .rb-mini-progress"
)}
${section(
  "Акцент-значение и бейдж",
  "Крупное значение строки - .rb-target-num (цель броска); бейдж состояния - .rb-badge («в работе» у рецепта с активным проектом).",
  `<div style="width: 360px">
     <div class="rb-row rb-target-row"><span>Цель броска d100</span><span class="rb-target-num">65</span></div>
     <div class="rb-row"><span class="rb-entry-name">Дорожный паёк ×5</span><span class="rb-badge">в работе</span></div>
   </div>`,
  ".rb-target-num, .rb-target-row(.is-bad), .rb-badge"
)}
${section(
  "Сворачиваемая секция",
  "details.rb-fold: summary в стиле заголовка секции с маркером справа. В мастере «Создать с нуля» так свёрнуты крит и брак.",
  `<details class="rb-fold" open style="width: 360px"><summary class="rb-block-title rb-fold-sum">⚡ При крите добавить качества <span class="rb-dim">(добавятся только при крите)</span></summary>
     <section class="rb-block"><div class="rb-row rb-ing"><span class="rb-ing-name"><input type="checkbox" checked> Грозное</span></div></section>
   </details>`,
  "details.rb-fold, summary.rb-fold-sum"
)}
${section(
  "Полоса прогресса",
  "Проект крафта: .rb-progress + .rb-progress-fill (золотой градиент).",
  `<div style="width: 300px"><div class="rb-progress"><div class="rb-progress-fill" style="width: 60%"></div></div></div>`,
  ".rb-progress, .rb-progress-fill"
)}
${section(
  "Монеты",
  "Номинал с числом - .rb-coin: иконка монеты .rb-coin-img (с монет актёра или wfrp4e-core, helper coinIco) либо запасной кружок .rb-coin-dot--gc/ss/bp. В подсказках суммы «2 зк» автоматически получают иконки (RBTooltip.moneyChips).",
  `<div>Цена: <span class="rb-coin">2<i class="rb-coin-dot rb-coin-dot--gc"></i></span> <span class="rb-coin">8<i class="rb-coin-dot rb-coin-dot--ss"></i></span> <span class="rb-coin">6<i class="rb-coin-dot rb-coin-dot--bp"></i></span></div>`,
  ".rb-coin, .rb-coin-img, .rb-coin-dot--gc/ss/bp, coinIco(), moneyHtml(), RBTooltip.moneyChips()"
)}
${section(
  "Тултипы",
  "ВСЕ подсказки - свой RBTooltip (порт PaperdollTooltip), системный data-tooltip не используется. Короткая карточка (.is-tip) - из data-rb-tip через tipHtml: заголовок, «ключ<TAB>значение», «! » красное, «~ » сноска, «· » пункт. Богатый ховер предмета - .rb-tt-* из скрытого .rb-tt-src.",
  `<div class="wfrp-recipe-book rb-tooltip is-tip is-visible" style="position: static; pointer-events: auto">
     <div class="rb-tip-head is-kv"><span>Проверка ремесла</span></div>
     <div class="rb-tip-line is-kv"><span>Навык «Ремесло (Аптекарь)»</span><b>45</b></div>
     <div class="rb-tip-line is-kv"><span>Цель броска d100</span><b>65</b></div>
     <div class="rb-tip-line is-warn">Не хватает: ингредиенты</div>
     <div class="rb-tip-note">Выпало не больше цели - успех.</div>
   </div>
   <div class="wfrp-recipe-book rb-tooltip is-visible" style="position: static; pointer-events: auto">
     <div class="rb-tt-head"><img src="${ICON("5f7a3a", "Т")}" alt=""><div>
       <div class="rb-tt-name">Целебные травы</div>
       <div class="rb-tt-line">Цена: <span class="rb-coin">8<i class="rb-coin-dot rb-coin-dot--bp"></i></span></div>
       <div class="rb-tt-line">Доступность: Распространённый</div></div></div>
     <div class="rb-tt-line rb-tt-craft">В наличии: 3 · нужно: 2</div>
     <div class="rb-tt-desc">Пучок сушёных трав с заливных лугов Рейкланда.</div>
   </div>`,
  ".rb-tooltip(.is-tip,.is-visible), .rb-tip-head/line/note/section/dot, .rb-tt-head/name/line/craft/desc, RBTooltip"
)}
${section(
  "Пикер предметов из базы",
  "Выпадающий поиск под заголовком секции («+» или клик по иконке рецепта): .rb-picker c .rb-picker-search и списком .rb-picker-row.",
  `<div class="rb-picker" style="width: 320px; margin: 0">
     <input type="text" class="rb-picker-search" placeholder="Найти предмет в базе...">
     <div class="rb-picker-list">
       <button type="button" class="rb-picker-row"><img src="${ICON("3a6a7a", "Л")}" alt="">Лечебная настойка</button>
       <button type="button" class="rb-picker-row"><img src="${ICON("7a3a5a", "М")}" alt="">Корень мандрагоры</button>
     </div>
   </div>`,
  ".rb-picker, .rb-picker-search, .rb-picker-list, .rb-picker-row, itemIndex()"
)}`;

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Книга рецептов WFRP - дизайн-система</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>${css}</style>
<style>
  body { margin: 0; padding: 24px; background: #2a2622; font: 14px/1.45 Signika, "Segoe UI", sans-serif; color: #eee; }
  .sg-head { max-width: 920px; margin: 0 auto 8px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .sg-head p { color: #b8ab92; margin: 4px 0 0; width: 100%; }
  .sg-theme { background: #0b0907; color: #d8ccb4; border: 1px solid #4a4339; border-radius: 4px; padding: 4px 12px; cursor: pointer; }
  .sg-section { max-width: 920px; margin: 0 auto 26px; }
  .sg-section h2 { font-size: 16px; margin: 0 0 4px; color: #e7d9ba; }
  .sg-note { margin: 0 0 8px; font-size: 12.5px; color: #b8ab92; }
  .sg-demo { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; padding: 16px; border-radius: 8px;
             background: var(--rb-bg); border: 1px solid var(--rb-frame); color: var(--rb-text); }
  .sg-refs { display: block; margin-top: 6px; font-size: 11.5px; color: #8fa06a; }
  .sg-cols { display: flex; gap: 32px; flex-wrap: wrap; width: 100%; font-size: 12px; }
  .sg-space { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .sg-space i { display: inline-block; height: 12px; background: var(--rb-gold); }
  .sg-radius { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .sg-radius i { display: inline-block; width: 26px; height: 18px; background: var(--rb-well); border: 1px solid var(--rb-frame-hi); }
  .sg-color { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
  .sg-color i { display: inline-block; width: 18px; height: 18px; border-radius: 4px; border: 1px solid var(--rb-frame-hi); }
</style></head>
<body>
<div class="sg-head">
  <h1 style="margin: 0">Дизайн-система «Книги рецептов WFRP»</h1>
  <button type="button" class="sg-theme" onclick="for (const el of document.querySelectorAll('.sg-demo, .rb-tooltip')) el.classList.toggle('rb-theme-dark')">Тема: пергамент / тёмная</button>
  <p>Токены и базовые компоненты: styles/rb-system.css (правила - в CLAUDE.md, раздел «Дизайн-система»).
     Пересборка страницы: <code>npm run styleguide</code>. Линт сырых пикселей: <code>node tools/qa/dslint.mjs</code> (базлайн нулевой - не наращивать).</p>
</div>
${body}
</body></html>`;

fs.writeFileSync(path.join(root, "docs/styleguide.html"), html);
console.log("docs/styleguide.html собран");
