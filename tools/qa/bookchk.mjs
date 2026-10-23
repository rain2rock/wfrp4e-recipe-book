/* QA книги рецептов: подсветка, статусы, крафт с успехом, провал с возвратом половины,
   долгий проект с прогрессом, фильтры и поиск. Все проверки должны быть PASS.
   Запуск: node tools/qa/bookchk.mjs docs/book-mock.html */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mock = process.argv[2] ?? "docs/book-mock.html";

let pass = 0, fail = 0;
const ok = (cond, name, extra = "") => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => { fail++; console.log("FAIL pageerror:", e.message); });
await page.goto("file://" + path.join(root, mock));
await page.waitForSelector(".wfrp-recipe-book .rb-root");

const $ = (sel, opts) => page.locator(sel, opts);
const text = async (sel) => (await $(sel).first().textContent())?.trim() ?? "";

/* --- Список и подсветка --- */
ok((await $(".rb-entry:not(.rb-project)").count()) === 6, "в списке 6 рецептов");
ok((await $(".rb-group-title").count()) >= 3, "рецепты сгруппированы по ремёслам");
const readyNames = await $(".rb-entry.rb-ready .rb-entry-name").allTextContents();
ok(readyNames.length === 4, "подсвечено 4 доступных", `(${readyNames.join("; ")})`);
ok(readyNames.some((n) => n.includes("Лечебная настойка")), "настойка подсвечена");
ok(!readyNames.some((n) => n.includes("Кинжал")), "кинжал без навыка не подсвечен");
ok(!readyNames.some((n) => n.includes("Противоядие")), "противоядие без мандрагоры не подсвечено");

/* карточка рецепта в списке: параметры готового предмета, как в paperdoll */
await $(".rb-entry", { hasText: "Гномий клинок" }).first().hover();
await page.waitForTimeout(150);
const entryTip = await page.evaluate(() => document.getElementById("rb-tooltip")?.textContent ?? "");
ok(entryTip.includes("Гномий клинок") && entryTip.includes("Цена") && entryTip.includes("Доступность") &&
   entryTip.includes("Ремесло (Кузнец)") && entryTip.includes("Железный слиток"),
  "ховер записи показывает цену, доступность, проверку и сырьё", entryTip.replace(/\s+/g, " ").slice(0, 120));
await page.mouse.move(5, 5);
await page.waitForTimeout(80);

/* --- Рецепт без навыка: кнопка выключена, причина названа --- */
await $(".rb-entry", { hasText: "Кинжал" }).first().click();
await page.waitForTimeout(50);
ok(await $(".rb-btn--craft").first().isDisabled(), "кинжал: «Создать» выключена");
ok((await text(".rb-problems")).includes("навык"), "кинжал: причина - навык");

/* --- Настойка: цифры проверки --- */
await $(".rb-entry", { hasText: "Лечебная настойка" }).first().click();
await page.waitForTimeout(50);
let right = await text(".rb-right");
ok(right.includes("65"), "цель = навык 45 + заурядная 20 = 65", right.slice(0, 200));
ok(right.includes("5 − 2"), "талант снизил УУ: 5 − 2");
ok(!(await $(".rb-btn--craft").first().isDisabled()), "настойка: «Создать» активна");
const btnCss = await page.evaluate(() => {
  const b = document.querySelector(".rb-btn--craft");
  const s = getComputedStyle(b);
  return { bw: s.borderTopWidth, shadow: s.boxShadow, bi: s.backgroundImage, outline: s.outlineStyle };
});
ok(btnCss.bw === "1px" && btnCss.shadow === "none" && btnCss.bi === "none" && btnCss.outline === "none",
  "кнопка «Создать» перебивает скин: рамка 1px, без теней и фактур", JSON.stringify(btnCss));
const skinCss = await page.evaluate(() => {
  const check = (el) => {
    const s = getComputedStyle(el);
    return s.backgroundImage === "none" && s.boxShadow === "none" && s.outlineStyle === "none" && s.borderTopWidth === "1px";
  };
  return { entry: check(document.querySelector(".rb-entry")), chip: check(document.querySelector(".rb-filter")) };
});
ok(skinCss.entry && skinCss.chip, "записи списка и чипы тоже перебивают скин", JSON.stringify(skinCss));
const typo = await page.evaluate(() => {
  const pick = (sel) => { const s = getComputedStyle(document.querySelector(sel)); return { ls: s.letterSpacing, ff: s.fontFamily }; };
  const body = getComputedStyle(document.body).fontFamily;
  const e = pick(".rb-entry"), c = pick(".rb-filter");
  return { entryLs: e.ls, chipLs: c.ls, sameFamily: e.ff === body && c.ff === body };
});
ok(typo.entryLs === "normal" && typo.chipLs === "normal" && typo.sameFamily,
  "типографика кнопочных элементов не сбита скином (интервал и шрифт)", JSON.stringify(typo));
const moneyRow = await page.evaluate(() => {
  const coin = document.querySelector(".rb-ing-count .rb-coin-img, .rb-ing-count .rb-coin-dot");
  const count = coin?.closest(".rb-ing-count");
  return { coinW: coin ? coin.getBoundingClientRect().width : 0, rowH: count ? count.getBoundingClientRect().height : 0 };
});
ok(moneyRow.coinW > 0 && moneyRow.coinW <= 17 && moneyRow.rowH <= 26,
  "монеты 16px и сумма в одну строку (не столбиком)", JSON.stringify(moneyRow));
const contentBg = await page.evaluate(() => getComputedStyle(document.querySelector("#rb-book-hugo .window-content")).backgroundColor);
ok(contentBg === "rgb(216, 209, 194)", "фон окна - наш пергамент, системная подложка перебита", contentBg);

/* --- Понятность: подсказки и богатый ховер (свой тултип, системный отключён) --- */
ok((await $("[data-tooltip]").count()) === 0, "системные тултипы Foundry не используются");
ok(((await $(".rb-entry", { hasText: "Кинжал" }).first().locator(".rb-tt-status").textContent()) ?? "").includes("навык"),
  "карточка записи: почему кинжал недоступен");
ok((await $("[data-rb-tip*='d100']").count()) >= 1, "строка проверки объясняет бросок d100");
ok((await $("[data-rb-tip*='Уровни успеха']").count()) >= 1, "строка УУ объясняет накопление");

/* Подсказка «Прочее сырьё»: деньги с иконками монет, а не текстом */
await $(".rb-money-row, .rb-ing[data-rb-tip*='сырьё'], [data-rb-tip*='Прочее сырьё']").first().hover();
await page.waitForTimeout(450);
ok(await page.evaluate(() => {
  const el = document.getElementById("rb-tooltip");
  return !!el?.classList.contains("is-visible") && el.querySelectorAll(".rb-coin-img, .rb-coin-dot").length >= 2;
}), "в ховере монет - иконки номиналов");
ok(await page.evaluate(() => (document.getElementById("rb-tooltip")?.textContent ?? "").includes("Останется после крафта")),
  "подсказка сырья говорит, сколько останется после крафта");
await page.mouse.move(5, 5);
await page.waitForTimeout(60);

/* Короткая подсказка: карточка своего тултипа возле курсора */
await $("[data-rb-tip*='d100']").first().hover();
await page.waitForTimeout(450);
const tipState = await page.evaluate(() => {
  const el = document.getElementById("rb-tooltip");
  const r = el?.getBoundingClientRect();
  return { visible: !!el?.classList.contains("is-visible"), isTip: !!el?.classList.contains("is-tip"),
    text: el?.textContent ?? "", left: r?.left ?? -1 };
});
ok(tipState.visible && tipState.isTip && tipState.text.includes("Цель броска"),
  "короткая подсказка рисуется своим тултипом", tipState.text.slice(0, 80));
const curPos = await $("[data-rb-tip*='d100']").first().boundingBox();
ok(Math.abs(tipState.left - (curPos.x + curPos.width / 2)) < 420, "подсказка появляется возле курсора");
await page.mouse.move(5, 5);
await page.waitForTimeout(60);
ok((await $(".rb-ing .rb-coin-img").count()) >= 1, "у прочего сырья - иконки монет с предметов персонажа");
ok((await text(".rb-right")).includes("1ч"), "время на изготовление: только ненулевые единицы (1ч)");
ok((await $(".rb-ing", { hasText: "Ступка и пестик" }).count()) === 1, "инструмент из базы показан строкой с иконкой");
ok((await $("img[src*='raw-materials'], img[src^='data:'][alt='']").count()) >= 1, "у прочего сырья - иконка-кошель");

await $(".rb-ing", { hasText: "Целебные травы" }).first().hover();
await page.waitForTimeout(80);
let tt = await page.evaluate(() => {
  const el = document.getElementById("rb-tooltip");
  return el?.classList.contains("is-visible") ? el.textContent : "";
});
ok(tt.includes("Целебные травы") && tt.includes("Цена") && tt.includes("В наличии") && tt.includes("Пучок сушёных трав"),
  "ховер ингредиента: картинка-карточка с ценой и описанием", tt.slice(0, 120));
await page.mouse.move(5, 5);
await page.waitForTimeout(60);

await $(".rb-entry", { hasText: "Противоядие" }).first().click();
await page.waitForTimeout(60);
await $(".rb-ing", { hasText: "Корень мандрагоры" }).first().hover();
await page.waitForTimeout(80);
tt = await page.evaluate(() => document.getElementById("rb-tooltip")?.textContent ?? "");
ok(tt.includes("Раритетный") && tt.includes("перчатках"),
  "ховер отсутствующего ингредиента берёт данные из мира (fromUuid)", tt.slice(0, 120));
await page.mouse.move(5, 5);
ok((await $(".rb-ing.is-bad", { hasText: "Перегонный куб" }).count()) === 1, "недостающий инструмент подсвечен красным");
ok((await text(".rb-right")).includes("1мес 8д 15ч 10м"), "38 дней показываются игроку как 1мес 8д 15ч 10м");
ok(((await $(".rb-entry", { hasText: "Противоядие" }).first().locator(".rb-tt-status").textContent()) ?? "").includes("инструментов"),
  "в причинах недоступности есть инструменты");

/* Лист ГМа: навыки дропдауном из базы, минуты времени */
await $(".rb-entry", { hasText: "Лечебная настойка" }).first().click();
await page.waitForTimeout(80);
await page.click("#tb-sheet");
await page.waitForTimeout(200);
const sheet = await page.evaluate(() => {
  const el = document.getElementById("rb-sheet-demo");
  const dl = el?.querySelector("datalist");
  return {
    skillOptions: dl ? dl.options.length : 0,
    hasTrade: dl ? [...dl.options].some((o) => o.value === "Ремесло (Кузнец)") : false,
    combo: !!el?.querySelector(".rb-skill-input[list]") && !!el?.querySelector(".rb-skillalt-input[list]"),
    minutes: !!el?.querySelector(".rb-time-m"),
    toolZone: !!el?.querySelector("[data-dropzone='tools']"),
    coinIcons: el?.querySelectorAll(".rb-money-fields .rb-coin-img, .rb-money-fields .rb-coin-dot").length ?? 0
  };
});
ok(sheet.skillOptions >= 10 && sheet.hasTrade && sheet.combo, "лист ГМа: навык и альт. навык - комбобоксы с поиском по базе", JSON.stringify(sheet));
const rootPad = await page.evaluate(() => getComputedStyle(document.querySelector("#rb-sheet-demo .rb-sheet-root")).paddingLeft);
ok(rootPad === "14px", "отступ от края карточки до контента держится (14px)", rootPad);
ok(await page.evaluate(() => {
  const dl = document.querySelector("#rb-sheet-demo datalist");
  return [...dl.options].some((o) => o.value === "Ремесло (Самогонщик)");
}), "в списке поиска есть навык, созданный ГМом только на персонаже");
/* ввод в комбобокс сохраняется */
await page.fill("#rb-sheet-demo .rb-skillalt-input", "Ремесло (Повар)");
await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-skillalt-input").dispatchEvent(new Event("change")));
await page.waitForTimeout(150);
ok(await page.evaluate(() => __RB_actor__.items.get("rec-0").system.skillAlt === "Ремесло (Повар)"),
  "значение из комбобокса записалось в рецепт");
ok(sheet.minutes, "лист ГМа: поле минут времени");
ok(sheet.toolZone, "лист ГМа: зона инструментов");
ok(sheet.coinIcons === 3, "лист ГМа: иконки монет как во всём модуле");
const inputH = await page.evaluate(() => {
  const el = document.querySelector("#rb-sheet-demo select");
  return el ? el.getBoundingClientRect().height : 0;
});
ok(inputH > 0 && inputH <= 30, "поля листа компактные - высота ядра Foundry перебита", `(${inputH}px)`);
ok((await $("#rb-sheet-demo [data-action='addItem'][data-zone='result']").count()) === 1, "у результата есть «+» из базы");
ok((await $("#rb-sheet-demo .rb-result-name").count()) === 1, "имя результата - редактируемое поле");
const footSizes = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("#rb-sheet-demo .rb-sheet-foot .rb-btn")];
  return [...new Set(btns.map((b) => getComputedStyle(b).fontSize))];
});
ok(footSizes.length === 1, "кнопки футера листа - один размер текста", `(${footSizes.join(", ")})`);
ok((await $("#rb-sheet-demo [data-action='saveSheet']").count()) === 1 &&
   (await $("#rb-sheet-demo [data-action='saveAsNew']").count()) === 1 &&
   (await $("#rb-sheet-demo [data-action='cancelSheet']").count()) === 1, "в листе есть «сохранить / как новый / отмена»");
ok((await $("#rb-sheet-demo .rb-coinfield .rb-num").count()) === 3, "монеты внутри полей ввода слева");

/* Пикер: добавление ингредиента через поиск по базе */
const recBefore = await page.evaluate(() => __RB_actor__.items.find((i) => i.id === "rec-0").system.ingredients.length);
await page.click("#rb-sheet-demo [data-action='addItem'][data-zone='ingredients']");
await page.waitForTimeout(100);
ok((await $("#rb-sheet-demo .rb-picker").count()) === 1, "пикер открылся по «+»");
await page.fill("#rb-sheet-demo .rb-picker-search", "мандраг");
await page.waitForTimeout(100);
const rows = await $("#rb-sheet-demo .rb-picker-row").count();
ok(rows === 1, "поиск по базе нашёл мандрагору", `(${rows})`);
await page.click("#rb-sheet-demo .rb-picker-row");
await page.waitForTimeout(150);
const recAfter = await page.evaluate(() => {
  const r = __RB_actor__.items.find((i) => i.id === "rec-0");
  return { len: r.system.ingredients.length, added: r.system.ingredients.some((i) => i.name === "Корень мандрагоры") };
});
ok(recAfter.len === recBefore + 1 && recAfter.added, "ингредиент добавлен через поиск");

/* Пикер иконки из базы: меняется ТОЛЬКО иконка рецепта, иконка результата своя */
const imgBefore = await page.evaluate(() => {
  const r = __RB_actor__.items.get("rec-0");
  return { img: r.img, resImg: r.system.result.img };
});
await page.click("#rb-sheet-demo .rb-sheet-img");
await page.waitForTimeout(100);
await page.fill("#rb-sheet-demo .rb-picker-search", "кинжал");
await page.waitForTimeout(100);
await page.click("#rb-sheet-demo .rb-picker-row");
await page.waitForTimeout(150);
const imgChanged = await page.evaluate(() => {
  const r = __RB_actor__.items.get("rec-0");
  const w = __RB_worldItems__.find((x) => x.name === "Кинжал");
  return { recipe: r.img === w.img, resImg: r.system.result.img };
});
ok(imgChanged.recipe && imgChanged.resImg === imgBefore.resImg,
  "иконка рецепта из базы; иконка результата не тронута - это разные иконки");
/* Удалил название и вписал то же - результат снова привязан к предмету базы, а не «новый» */
await page.fill("#rb-sheet-demo .rb-result-name", "");
await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-result-name").dispatchEvent(new Event("change")));
await page.waitForTimeout(150);
await page.fill("#rb-sheet-demo .rb-result-name", "Лечебная настойка");
await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-result-name").dispatchEvent(new Event("change")));
await page.waitForTimeout(200);
ok(await page.evaluate(() => !!__RB_actor__.items.get("rec-0").system.result.uuid),
  "то же имя результата - рецепт снова привязан к предмету, не «новый»");

/* Часы и минуты подрезаются: не больше 23 и 59 */
await page.fill("#rb-sheet-demo .rb-time-h", "99");
await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-time-h").dispatchEvent(new Event("change")));
await page.waitForTimeout(150);
await page.fill("#rb-sheet-demo .rb-time-m", "99");
await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-time-m").dispatchEvent(new Event("change")));
await page.waitForTimeout(150);
ok(await page.evaluate(() => {
  const sys = __RB_actor__.items.get("rec-0").system;
  return sys.timeHours === 23 && sys.timeMinutes === 59;
}), "часы и минуты подрезаны до 23 и 59");

/* Иконка результата выбирается из базы отдельно от иконки рецепта (для новых предметов) */
await page.click("#rb-sheet-demo [data-action='pickResultIcon']");
await page.waitForTimeout(100);
await page.fill("#rb-sheet-demo .rb-picker-search", "мандраг");
await page.waitForTimeout(100);
await page.click("#rb-sheet-demo .rb-picker-row");
await page.waitForTimeout(150);
ok(await page.evaluate(() => {
  const r = __RB_actor__.items.get("rec-0");
  const w = __RB_worldItems__.find((x) => x.name === "Корень мандрагоры");
  return r.system.result.img === w.img && r.img !== w.img;
}), "иконка результата выбрана из базы, иконка рецепта не тронута");

/* Переключение чекбокса не сбрасывает скролл листа наверх */
await page.evaluate(() => {
  const r = document.querySelector("#rb-sheet-demo .rb-sheet-scroll");
  r.scrollTop = 300;
});
await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-crit-on")?.click());
await page.waitForTimeout(250);
const scrollKept = await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-sheet-scroll").scrollTop);
ok(scrollKept > 150, "скролл листа сохранился после переключения чекбокса", `(${scrollKept})`);
await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-crit-on")?.click());
await page.waitForTimeout(200);

/* «Отмена» откатывает ВСЁ к моменту открытия листа: и мандрагору, и смену иконки */
await page.evaluate(() => __RB_actor__.items.get("rec-0").update({ "system.slTarget": 9 }));
await page.click("#rb-sheet-demo [data-action='cancelSheet']");
await page.waitForTimeout(200);
const reverted = await page.evaluate((before) => {
  const r = __RB_actor__.items.get("rec-0");
  return r.system.slTarget === 5 && r.img === before.img &&
    !r.system.ingredients.some((i) => i.name === "Корень мандрагоры");
}, imgBefore);
ok(reverted, "«Отмена» в листе вернула рецепт к моменту открытия");
await page.mouse.move(5, 5);
await $(".rb-entry", { hasText: "Лечебная настойка" }).first().click();
await page.waitForTimeout(60);

/* --- Крафт с успехом за один бросок --- */
const herbsBefore = await page.evaluate(() => __RB_actor__.items.find((i) => i.name === "Целебные травы")?.system.quantity.value);
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 5; });
await $(".rb-btn--craft").first().click();
await page.waitForTimeout(150);
const after = await page.evaluate(() => ({
  herbs: __RB_actor__.items.find((i) => i.name === "Целебные травы")?.system.quantity.value ?? 0,
  spirit: __RB_actor__.items.find((i) => i.name === "Спирт") ? 1 : 0,
  potion: __RB_actor__.items.find((i) => i.name === "Лечебная настойка" && i.type === "trapping")?.system.quantity.value ?? 0,
  tests: __RB_actor__.items.filter((i) => i.type === "extendedTest").length,
  moneyBp: __RB_actor__.items.filter((i) => i.type === "money").reduce((s, c) => s + c.system.quantity.value * c.system.coinValue.value, 0),
  chat: __RB_chat__.map((m) => m.content).join(" | ")
}));
ok(herbsBefore === 3 && after.herbs === 1, "травы списаны 3 → 1", `(${herbsBefore} → ${after.herbs})`);
ok(after.spirit === 0, "спирт списан полностью");
ok(after.potion === 2, "крит (УУ 6 ≥ 6): настойка создана с +1 к количеству", `(${after.potion})`);
ok(after.chat.includes("Критический успех"), "карточка крита в чате");
ok(after.tests === 0, "проект закрыт после успеха");
ok(after.moneyBp === 582 - 15, "деньги списаны: 582 − 15", `(${after.moneyBp})`);
ok(after.chat.includes("Изготовлено"), "карточка «Изготовлено» в чате");

/* --- Провал: возврат половины (настройка по умолчанию half) --- */
await $(".rb-entry", { hasText: "Успокоительный отвар" }).first().click();
await page.waitForTimeout(50);
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 100; });
await $(".rb-btn--craft").first().click();
await page.waitForTimeout(150);
const failState = await page.evaluate(() => ({
  sleep: __RB_actor__.items.find((i) => i.name === "Сонная трава")?.system.quantity.value ?? 0,
  honey: __RB_actor__.items.find((i) => i.name === "Мёд")?.system.quantity.value ?? 0,
  tests: __RB_actor__.items.filter((i) => i.type === "extendedTest").length,
  moneyBp: __RB_actor__.items.filter((i) => i.type === "money").reduce((s, c) => s + c.system.quantity.value * c.system.coinValue.value, 0),
  chat: __RB_chat__.map((m) => m.content).join(" | ")
}));
ok(failState.tests === 0, "провальный проект закрыт");
ok(failState.chat.includes("Не вышло"), "карточка «Не вышло» в чате");
ok(failState.sleep === 1, "сонная трава: потрачено 2, вернулась половина (1)", `(${failState.sleep})`);
ok(failState.honey === 0, "мёд: потрачен 1, половина от 1 - ничего");
ok(failState.moneyBp === 582 - 15 - 12 + 6, "деньги: списано 12, вернулось 6", `(${failState.moneyBp})`);
ok((await text(".rb-head h2")).includes("Успокоительный отвар"),
  "после провала выбор остался на своём рецепте, а не прыгнул на первый");

/* --- Долгий проект: прогресс и «Продолжить» --- */
await $(".rb-entry", { hasText: "Дорожный паёк" }).first().click();
await page.waitForTimeout(50);
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 55; });
await $(".rb-btn--craft").first().click();
await page.waitForTimeout(150);
ok((await $(".rb-work-title").count()) === 1, "появилась секция «В работе»");
const projFoot = await page.evaluate(() => {
  const ab = document.querySelector("[data-action='abandon']");
  const cont = document.querySelector("[data-action='continueTest']");
  if (!ab || !cont) return null;
  const a = ab.getBoundingClientRect(), c = cont.getBoundingClientRect();
  return { square: Math.abs(a.width - a.height) < 2, overlap: a.right > c.left + 1,
    sameFs: getComputedStyle(ab).fontSize === getComputedStyle(cont).fontSize };
});
ok(projFoot && projFoot.square && !projFoot.overlap && projFoot.sameFs,
  "футер проекта: корзинка квадратная, без наложений, размер текста единый", JSON.stringify(projFoot));
right = await text(".rb-right");
ok(right.includes("1") && right.includes("/ 5"), "прогресс проекта 1 / 5", right.slice(0, 120));
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 5; });
await $("[data-action='continueTest']").first().click();
await page.waitForTimeout(150);
const rations = await page.evaluate(() => __RB_actor__.items.find((i) => i.name === "Дорожный паёк")?.system.quantity.value ?? 0);
ok(rations === 5, "паёк готов ×5 после добора УУ", `(${rations})`);
ok((await text(".rb-head h2")).includes("Дорожный паёк"),
  "после завершения проекта выбор вернулся к его рецепту");

/* --- Крит-апгрейд: вместо базового результата создаётся улучшенный предмет --- */
await page.evaluate(async () => {
  await __RB_actor__.createEmbeddedDocuments("Item", [{
    name: "Рецепт: Пробная вещь", type: "wfrp4e-recipe-book.recipe", img: "",
    system: {
      result: { uuid: "", name: "Пробная вещь", img: "", count: 1 },
      skill: "Ремесло (Аптекарь)", skillAlt: "", difficulty: "average", slTarget: 1,
      ingredients: [], moneyBp: 0, needsWorkshop: false, tools: [],
      critEnabled: true, critSL: 5, critExtra: true, critCount: 2, critUpgrade: true, critRefund: false, critRandom: false,
      critResult: { uuid: "Item.res-dagger", name: "Кинжал", img: "" },
      timeDays: 0, timeHours: 0, timeMinutes: 0,
      description: { value: "" }, gmdescription: { value: "" }
    }
  }]);
});
await page.waitForTimeout(150);
await $(".rb-entry", { hasText: "Пробная вещь" }).first().click();
await page.waitForTimeout(80);
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 5; });
await $(".rb-btn--craft").first().click();
await page.waitForTimeout(250);
ok(await page.evaluate(() => {
  const d = __RB_actor__.items.find((i) => i.name === "Кинжал" && i.type !== "wfrp4e-recipe-book.recipe");
  return !!d && d.system.quantity.value === 3 && !__RB_actor__.items.find((i) => i.name === "Пробная вещь");
}), "крит И-эффекты: улучшенный предмет (Кинжал) и +2 к количеству (3 шт)");
await page.evaluate(async () => {
  for (const i of [...__RB_actor__.items].filter((x) => x.name === "Кинжал" && x.type !== "wfrp4e-recipe-book.recipe")) await i.delete();
  for (const i of [...__RB_actor__.items].filter((x) => x.name === "Рецепт: Пробная вещь")) await i.delete();
});
await page.waitForTimeout(120);

/* --- Фильтры и поиск --- */
await $("[data-action='filter'][data-filter='ready']").click();
await page.waitForTimeout(50);
const readyCount = await $(".rb-entry:not(.rb-project)").count();
ok(readyCount === 1, "фильтр «могу сделать»: после крафтов остался только клинок (своё сырьё)", `(${readyCount})`);
await $("[data-action='filter'][data-filter='all']").click();
await page.waitForTimeout(50);
await page.fill(".rb-search input", "кинжал");
await page.waitForTimeout(300);
ok((await $(".rb-entry:not(.rb-project)").count()) === 1, "поиск «кинжал»: 1 запись");
await page.fill(".rb-search input", "");
await page.waitForTimeout(300);

/* --- Настройка подсветки: без денег --- */
await page.evaluate(() => game.settings.set("wfrp4e-recipe-book", "highlightMoney", false));
await page.waitForTimeout(100);

/* --- ГМ создаёт рецепт: он в мире, книга переключается на вкладку «Мир» --- */
await $("[data-action='createRecipe']").click();
await page.waitForTimeout(250);
ok((await $(".rb-filter--world.is-active").count()) === 1, "после создания книга на вкладке «Мир»");
ok((await $(".rb-entry", { hasText: "Новый рецепт" }).count()) === 0,
  "черновик НЕ показывается в списке, пока не сохранён");
ok((await $(".rb-group-title", { hasText: "Гюнтер" }).count()) === 1 &&
   (await $(".rb-entry", { hasText: "Лечебная настойка" }).count()) === 2,
  "реестр: видны копии у персонажей - две версии настойки");
ok(await page.evaluate(() => game.items.some((i) => i.name === "Новый рецепт")), "черновик создан в мире, не на актёре");
const newSheetOpen = await page.evaluate(() =>
  [...document.querySelectorAll(".rb-sheet-root")].some((el) => el.closest(".window-app")));
ok(newSheetOpen, "лист черновика открылся сразу");

/* сохранение: черновик появляется в реестре с отметкой «новый», просмотр её снимает */
await page.evaluate(() => [...document.querySelectorAll("[id^='rb-sheet-'] [data-action='saveSheet']")].at(-1)?.click());
await page.waitForTimeout(250);
/* создан из книги игрока - спрашивает про выдачу; выбираем «не выдавать и сохранить» */
if (await $(".mock-dialog").count()) {
  await page.click(".mock-dialog footer button:nth-child(2)");
  await page.waitForTimeout(250);
}
ok((await $(".rb-entry", { hasText: "Новый рецепт" }).count()) === 1, "после сохранения рецепт появился в реестре");
ok((await $(".rb-entry", { hasText: "Новый рецепт" }).locator(".rb-new-ico").count()) === 1,
  "у сохранённого рецепта есть отметка «новый»");
await $(".rb-entry", { hasText: "Новый рецепт" }).first().click();
await page.waitForTimeout(300);
ok((await $(".rb-entry", { hasText: "Новый рецепт" }).locator(".rb-new-ico").count()) === 0,
  "после просмотра отметка «новый» снята");
ok((await $(".rb-group-title", { hasText: "Мир" }).count()) === 1, "реестр: мировые рецепты в группе «Мир»");
await $("[data-action='createRecipe']").click();
await page.waitForTimeout(250);
ok(await page.evaluate(() => {
  const el = [...document.querySelectorAll("[id^='rb-sheet-']")].at(-1);
  return !!el?.querySelector("[data-action='saveSheet']") && !el?.querySelector("[data-action='saveAsNew']");
}), "у черновика - только «Сохранить», без «Сохранить как новый»");
await page.evaluate(() => [...document.querySelectorAll("[id^='rb-sheet-'] [data-action='cancelSheet']")].at(-1)?.click());
await page.waitForTimeout(250);

/* «Отмена» при создании с нуля удаляет недосозданный рецепт */
await $("[data-action='createRecipe']").click();
await page.waitForTimeout(200);
await page.evaluate(() => [...document.querySelectorAll("[id^='rb-sheet-'] [data-action='cancelSheet']")].at(-1)?.click());
await page.waitForTimeout(200);
ok(await page.evaluate(() => game.items.filter((i) => i.name === "Новый рецепт").length === 1),
  "«Отмена» при создании удалила недосозданный рецепт");
await page.evaluate(() => {
  for (const el of document.querySelectorAll("[id^='rb-sheet-']")) el.querySelector("[data-mock-close]")?.click();
});
await page.waitForTimeout(100);

/* --- Полностью новый предмет: имя вписано руками + выдача персонажу --- */
await page.evaluate(async () => {
  const r = game.items.find((i) => i.name === "Новый рецепт");
  await r.update({
    "system.result": { uuid: "", name: "Талисман из коры", img: r.img, count: 1 },
    "system.skill": "Ремесло (Аптекарь)", "system.slTarget": 1,
    "system.moneyBp": 0, "system.ingredients": [], "system.tools": []
  });
});
/* после правки рецепта список сразу показывает имя результата */
await $(".rb-entry", { hasText: "Талисман из коры" }).first().click();
await page.waitForTimeout(100);
ok((await $("[data-action='giveRecipe']").count()) === 1 && (await $("[data-action='deleteRecipe']").count()) === 1,
  "у рецепта мира кнопки «выдать» и «удалить»");
ok((await $(".rb-foot [data-action='openRecipe']").count()) === 0 && (await $(".rb-head [data-action='openRecipe']").count()) === 1,
  "«Изменить» только в шапке, без дубля в футере");
ok((await $(".rb-foot [data-action='deleteRecipe']").count()) === 0 && (await $(".rb-head [data-action='deleteRecipe']").count()) === 1,
  "корзинка ГМа - в шапке рядом с карандашом");
await $("[data-action='giveRecipe']").click();
await page.waitForTimeout(150);
ok((await $(".rb-give-picker .rb-picker-row").count()) === 2, "выдача: только персонажи игроков (двое)");
ok((await $(".rb-give-picker .rb-picker-row", { hasText: "крыса" }).count()) === 0, "NPC в списке выдачи нет");
/* сначала выдадим Гюнтеру - рецепт уходит выбранному игроку, книга остаётся на «Мире» */
await $(".rb-give-picker .rb-picker-row", { hasText: "Гюнтер" }).click();
await page.waitForTimeout(200);
ok(await page.evaluate(() => __RB_actor2__.items.some((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.result?.name === "Талисман из коры")),
  "рецепт выдан выбранному персонажу (Гюнтеру)");
ok((await $(".rb-filter--world.is-active").count()) === 1, "после выдачи другому - книга осталась на «Мире»");
/* теперь владельцу открытой книги */
await $("[data-action='giveRecipe']").click();
await page.waitForTimeout(150);
await $(".rb-give-picker .rb-picker-row", { hasText: "Хьюго" }).click();
await page.waitForTimeout(200);
ok((await $(".rb-filter[data-filter='all'].is-active").count()) === 1, "после выдачи владельцу книга вернулась к его рецептам");
ok(await page.evaluate(() => __RB_actor__.items.some((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.result?.name === "Талисман из коры")),
  "персонаж выучил выданный рецепт");
await $(".rb-entry", { hasText: "Талисман из коры" }).first().click();
await page.waitForTimeout(80);
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 5; });
await $(".rb-btn--craft").first().click();
await page.waitForTimeout(250);
ok(await page.evaluate(() => !!__RB_actor__.items.find((i) => i.name === "Талисман из коры" && i.type === "trapping")),
  "кастомный результат: новый предмет создан при завершении крафта");

/* --- Удаление: из книги персонажа и из мира --- */
await $(".rb-entry", { hasText: "Талисман из коры" }).first().click();
await page.waitForTimeout(80);
await $("[data-action='deleteRecipe']").click();
await page.waitForTimeout(200);
ok((await $(".mock-dialog").count()) === 1 && (await text(".mock-dialog section")).includes("забудет"),
  "удаление из книги спрашивает подтверждение и называет последствия");
await page.click(".mock-dialog .rb-btn--quiet");
await page.waitForTimeout(200);
ok(await page.evaluate(() => __RB_actor__.items.some((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.result?.name === "Талисман из коры")),
  "отмена в диалоге сохранила рецепт");
await $("[data-action='deleteRecipe']").click();
await page.waitForTimeout(200);
await page.click(".mock-dialog .rb-btn--primary");
await page.waitForTimeout(250);
ok(await page.evaluate(() => !__RB_actor__.items.some((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.result?.name === "Талисман из коры")),
  "подтверждение удалило рецепт из книги персонажа");
await $("[data-action='filter'][data-filter='world']").click();
await page.waitForTimeout(80);
await $(".rb-entry", { hasText: "Талисман из коры" }).first().click();
await page.waitForTimeout(80);
await $("[data-action='deleteRecipe']").click();
await page.waitForTimeout(200);
ok((await text(".mock-dialog section")).includes("Выученные копии"),
  "удаление из мира показывает, у кого есть копии");
ok((await $(".mock-dialog [data-act='all']").count()) === 1 && (await $(".mock-dialog [data-act='world']").count()) === 1,
  "в диалоге есть выбор: удалить везде или только из реестра");
await page.click(".mock-dialog [data-act='world']");
await page.waitForTimeout(250);
ok(await page.evaluate(() => !game.items.some((i) => i.name === "Новый рецепт")), "рецепт удалён из реестра");
ok(await page.evaluate(() => __RB_actor2__.items.some((i) => i.system?.result?.name === "Талисман из коры")),
  "«только из реестра» не тронул копию у персонажа");

/* --- «Удалить везде»: рецепт и все выданные копии --- */
await page.evaluate(async () => {
  const w = await Item.create({ name: "Рецепт на снос", type: "wfrp4e-recipe-book.recipe", img: "",
    system: { result: { uuid: "", name: "Хлам", img: "", count: 1 }, skill: "Ремесло (Аптекарь)", slTarget: 1,
      ingredients: [], moneyBp: 0, tools: [], upgrades: [], critQualities: [], failPool: [],
      description: { value: "" }, gmdescription: { value: "" } } });
  const copy = w.toObject();
  delete copy._id;
  copy.flags = { "wfrp4e-recipe-book": { source: w.uuid } };
  await __RB_actor2__.createEmbeddedDocuments("Item", [copy]);
});
await page.waitForTimeout(200);
await $(".rb-entry", { hasText: "Хлам" }).first().click();
await page.waitForTimeout(150);
await $("[data-action='deleteRecipe']").click();
await page.waitForTimeout(200);
await page.click(".mock-dialog [data-act='all']");
await page.waitForTimeout(300);
ok(await page.evaluate(() => !game.items.some((i) => i.name === "Рецепт на снос")), "«удалить везде»: рецепт убран из реестра");
ok(await page.evaluate(() => !__RB_actor2__.items.some((i) => i.system?.result?.name === "Хлам")),
  "«удалить везде»: копия у персонажа тоже удалена");
await $("[data-action='filter'][data-filter='all']").click();
await page.waitForTimeout(80);

/* --- Демо-рецепт мока: улучшения видны игроку сразу --- */
await $(".rb-entry", { hasText: "Гномий клинок" }).first().click();
await page.waitForTimeout(120);
const demoUps = await $(".rb-upgrade").count();
ok(demoUps === 2 && (await text(".rb-right")).includes("Слиток мифрила"),
  "в моке есть рецепт с двумя улучшениями (мифрил и железо)", `(${demoUps})`);
/* клик по подписи (не по самому чекбоксу) должен переключать */
await page.click(".rb-upgrade .rb-prop-label");
await page.waitForTimeout(200);
ok(await page.evaluate(() => document.querySelector(".rb-upgrade input[type=checkbox]").checked),
  "клик по тексту улучшения включает его");
await page.click(".rb-upgrade .rb-prop-label");
await page.waitForTimeout(200);
ok(!(await page.evaluate(() => document.querySelector(".rb-upgrade input[type=checkbox]").checked)),
  "повторный клик по тексту выключает");

/* --- Улучшения: игрок видит цену, выбирает и получает качество --- */
await page.evaluate(async () => {
  await __RB_actor__.createEmbeddedDocuments("Item", [{
    name: "Рецепт: Пробный клинок", type: "wfrp4e-recipe-book.recipe", img: "",
    system: {
      result: { uuid: "", name: "Пробный клинок", img: "", count: 1 },
      skill: "Ремесло (Аптекарь)", skillAlt: "", difficulty: "average", slTarget: 1,
      ingredients: [], moneyBp: 0, needsWorkshop: false, tools: [],
      upgrades: [{ quality: "fast", name: "Быстрое", slBonus: 5, moneyBp: 0,
        ingredients: [{ uuid: "", name: "Целебные травы", img: "", count: 1 }] }],
      critEnabled: false, critSL: 99, critQualities: [], critResult: { uuid: "", name: "", img: "" },
      failPool: [], timeDays: 0, timeHours: 0, timeMinutes: 0,
      description: { value: "" }, gmdescription: { value: "" }
    }
  }]);
});
await page.waitForTimeout(150);
await $(".rb-entry", { hasText: "Пробный клинок" }).first().click();
await page.waitForTimeout(100);
ok((await $(".rb-upgrade").count()) === 1 && (await text(".rb-upgrade")).includes("Целебные травы"),
  "игрок видит улучшение и его цену");
const slBefore = await text(".rb-right");
await page.click(".rb-upgrade input[data-action='toggleUpgrade']");
await page.waitForTimeout(200);
const slAfter = await text(".rb-right");
ok(slBefore.includes("1") && slAfter.includes("6"), "выбор улучшения поднял требуемый УУ на 5");
ok((await text(".rb-ing", { hasText: "Целебные травы" })).includes("/ 1") ||
   (await $(".rb-ing", { hasText: "Целебные травы" }).count()) > 0, "сырьё улучшения добавилось в список");
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 1; });
await $(".rb-btn--primary, .rb-btn--craft").first().click();
await page.waitForTimeout(300);
const upRes = await page.evaluate(() => {
  const it = [...__RB_actor__.items].find((i) => i.name === "Пробный клинок" && i.type === "trapping");
  return { made: !!it, fast: !!it?.system.qualities?.value?.some((q) => q.name === "fast"), chat: __RB_chat__.at(-1)?.content ?? "" };
});
ok(upRes.made && upRes.fast && upRes.chat.includes("лучшения"),
  "готовый предмет получил качество улучшения, в чате отмечено", JSON.stringify(upRes).slice(0, 160));
await page.evaluate(async () => {
  for (const i of [...__RB_actor__.items].filter((x) => x.name.includes("Пробный клинок"))) await i.delete();
});
await page.waitForTimeout(150);

/* --- Пустая выдача фильтров: объяснение и сброс --- */
await page.fill(".rb-search input", "щщщ");
await page.waitForTimeout(300);
ok((await $(".rb-entry:not(.rb-project)").count()) === 0 && (await $(".rb-noresults").count()) === 1,
  "пустая выдача показывает плашку «ничего не найдено»");
await $("[data-action='resetFilters']").click();
await page.waitForTimeout(200);
ok((await $(".rb-noresults").count()) === 0 && (await $(".rb-entry:not(.rb-project)").count()) > 0,
  "«Сбросить фильтры» вернул полный список");
ok(await page.evaluate(() => document.querySelector(".rb-search input").value === ""), "поиск очищен сбросом");

/* --- Сервисный переключатель «как видит игрок» (панель мока; в Foundry - настройка модуля) --- */
ok((await $(".rb-view-toggle").count()) === 0, "в самой книге переключателя вида нет - он сервисный");
await page.click("#tb-view");
await page.waitForTimeout(150);
const playerView = await page.evaluate(() => ({
  world: document.querySelectorAll(".rb-filter--world").length,
  newBtn: document.querySelectorAll("[data-action='createRecipe']").length,
  trash: document.querySelectorAll("[data-action='deleteRecipe']").length,
  pen: document.querySelectorAll("[data-action='openRecipe']").length
}));
ok(playerView.world === 0 && playerView.newBtn === 0 && playerView.trash === 0 && playerView.pen === 0,
  "вид игрока: ГМ-интерфейс скрыт (мир, создание, изменение, удаление)", JSON.stringify(playerView));
/* случайный крит: игрок видит «особый бонус», расклад не раскрывается */
await page.evaluate(() => __RB_actor__.items.get("rec-0").update({ "system.critRefund": true, "system.critRandom": true }));
await page.waitForTimeout(150);
await $(".rb-entry", { hasText: "Лечебная настойка" }).first().click();
await page.waitForTimeout(100);
const playerCrit = await text(".rb-right");
ok(!playerCrit.includes("Крит") && !playerCrit.includes("случайно") && !playerCrit.includes("особый"),
  "вид игрока: условия крита полностью скрыты");
await page.click("#tb-view");
await page.waitForTimeout(150);
ok((await $(".rb-filter--world").count()) === 1, "вид ГМа вернулся");
ok((await text(".rb-right")).includes("случайно один из"), "вид ГМа: расклад случайного крита виден");
await page.evaluate(() => __RB_actor__.items.get("rec-0").update({ "system.critRefund": false, "system.critRandom": false }));
await page.waitForTimeout(120);

/* --- Сохранение рецепта из книги игрока: вопрос «выдать игроку?» --- */
await $("[data-action='createRecipe']").click();
await page.waitForTimeout(200);
await page.evaluate(() => { window.__RB_DIALOG_CHOICE__ = "give"; });
await page.evaluate(() => [...document.querySelectorAll("[id^='rb-sheet-'] [data-action='saveSheet']")].at(-1)?.click());
await page.waitForTimeout(250);
ok(await page.evaluate(() =>
  __RB_actor__.items.some((i) => i.type === "wfrp4e-recipe-book.recipe" && i.name === "Новый рецепт")),
  "«Выдать рецепт» при сохранении - копия ушла игроку");
await page.evaluate(async () => {
  for (const i of [...__RB_actor__.items].filter((x) => x.name === "Новый рецепт")) await i.delete();
  for (const i of [...game.items].filter((x) => x.name === "Новый рецепт")) await i.delete();
});
await page.waitForTimeout(150);

await $("[data-action='createRecipe']").click();
await page.waitForTimeout(200);
await page.evaluate(() => { window.__RB_DIALOG_CHOICE__ = "cancel"; });
await page.evaluate(() => [...document.querySelectorAll("[id^='rb-sheet-'] [data-action='saveSheet']")].at(-1)?.click());
await page.waitForTimeout(250);
ok(await page.evaluate(() =>
  [...document.querySelectorAll("[id^='rb-sheet-']")].length > 0 && game.items.some((i) => i.name === "Новый рецепт")),
  "«Отмена» в вопросе вернула к созданию рецепта");
await page.evaluate(() => { window.__RB_DIALOG_CHOICE__ = undefined; });
await page.evaluate(() => [...document.querySelectorAll("[id^='rb-sheet-'] [data-action='cancelSheet']")].at(-1)?.click());
await page.waitForTimeout(200);
ok(await page.evaluate(() => !game.items.some((i) => i.name === "Новый рецепт")), "черновик убран отменой создания");
await $("[data-action='filter'][data-filter='all']").click();
await page.waitForTimeout(100);

/* --- Доп. фильтры: у ГМа всегда, у игрока - по настройке --- */
ok((await $(".rb-extra-filters select").count()) === 2, "ГМ видит фильтры ремесла и типа без настройки");
await page.click("#tb-view");
await page.waitForTimeout(150);
ok((await $(".rb-extra-filters").count()) === 0, "вид игрока: фильтры скрыты (настройка выключена)");
await page.click("#tb-view");
await page.waitForTimeout(150);
await page.evaluate(() => game.settings.set("wfrp4e-recipe-book", "extraFilters", true));
await page.waitForTimeout(150);
await page.selectOption(".rb-skill-filter", "Ремесло (Аптекарь)");
await page.evaluate(() => document.querySelector(".rb-skill-filter").dispatchEvent(new Event("change")));
await page.waitForTimeout(150);
ok((await $(".rb-entry:not(.rb-project)").count()) === 3, "фильтр по ремеслу: только аптекарь (3)");
await page.selectOption(".rb-skill-filter", "");
await page.evaluate(() => document.querySelector(".rb-skill-filter").dispatchEvent(new Event("change")));
await page.waitForTimeout(150);
await page.selectOption(".rb-type-filter", "weapon");
await page.evaluate(() => document.querySelector(".rb-type-filter").dispatchEvent(new Event("change")));
await page.waitForTimeout(150);
const weaponEntries = await $(".rb-entry:not(.rb-project) .rb-entry-name").allTextContents();
ok(weaponEntries.length === 2 && weaponEntries.join(";").includes("Кинжал") && weaponEntries.join(";").includes("Гномий клинок"),
  "фильтр по типу: только оружие (кинжал и гномий клинок)", weaponEntries.join(";"));
await page.selectOption(".rb-type-filter", "");
await page.evaluate(() => document.querySelector(".rb-type-filter").dispatchEvent(new Event("change")));
await page.waitForTimeout(120);
await page.evaluate(() => game.settings.set("wfrp4e-recipe-book", "extraFilters", false));
await page.waitForTimeout(150);
ok((await $(".rb-extra-filters select").count()) === 2, "у ГМа фильтры остаются и без настройки");
/* Реестр: фильтр по владельцу */
await $("[data-action='filter'][data-filter='world']").click();
await page.waitForTimeout(120);
ok((await $(".rb-owner-filter").count()) === 1, "в реестре появился фильтр по владельцу");
ok((await $(".rb-extra-filters select[data-rb-tip]").count()) === 0, "у дропдаунов фильтров нет тултипов - не мешают спискам");
/* ГМ создаёт предмет в мир по мировому рецепту, без персонажа */
await page.evaluate(async () => { await Item.create({ name: "Рецепт мира", type: "wfrp4e-recipe-book.recipe", img: "",
  system: { result: { uuid: "Item.res-heal", name: "Лечебная настойка", img: "", count: 3 }, skill: "Ремесло (Аптекарь)", slTarget: 5,
    ingredients: [], moneyBp: 0, tools: [], critQualities: [], failPool: [], description: { value: "" }, gmdescription: { value: "" } } }); });
await page.waitForTimeout(150);
await $(".rb-entry", { hasText: "Лечебная настойка" }).first().click();
await page.waitForTimeout(100);
ok((await $("[data-action='makeToWorld']").count()) === 1, "у мирового рецепта есть «Создать в мир»");
await $("[data-action='makeToWorld']").click();
await page.waitForTimeout(200);
ok(await page.evaluate(() => {
  const it = game.items.find((i) => i.name === "Лечебная настойка" && i.type === "trapping");
  return !!it && it.system.quantity.value === 3;
}), "предмет создан в мире ×3 без персонажа и броска");
await page.evaluate(async () => {
  for (const i of [...game.items].filter((x) => x.name === "Рецепт мира" || (x.name === "Лечебная настойка" && x.type === "trapping"))) await i.delete();
});
await page.waitForTimeout(120);

await page.selectOption(".rb-owner-filter", await page.evaluate(() => __RB_actor2__.id));
await page.evaluate(() => document.querySelector(".rb-owner-filter").dispatchEvent(new Event("change")));
await page.waitForTimeout(150);
const ownerEntries = await $(".rb-entry:not(.rb-project)").count();
ok(ownerEntries === 2, "фильтр «Гюнтер»: только его рецепты (настойка + выданный талисман)", `(${ownerEntries})`);
await page.selectOption(".rb-owner-filter", "");
await page.evaluate(() => document.querySelector(".rb-owner-filter").dispatchEvent(new Event("change")));
await page.waitForTimeout(120);
await $("[data-action='filter'][data-filter='all']").click();
await page.waitForTimeout(120);

/* --- Переключатель языка модуля --- */
await page.evaluate(() => game.settings.set("wfrp4e-recipe-book", "lang", "en"));
await page.waitForTimeout(200);
const enText = await text(".rb-filters");
ok(enText.includes("All") && enText.includes("Can craft"), "язык en: фильтры по-английски", enText.slice(0, 60));
ok((await text(".rb-btn--craft")).includes("Craft"), "язык en: кнопка Craft");
await page.evaluate(() => game.settings.set("wfrp4e-recipe-book", "lang", "ru"));
await page.waitForTimeout(200);
ok((await text(".rb-filters")).includes("Все"), "язык ru вернулся");
await page.evaluate(() => game.settings.set("wfrp4e-recipe-book", "lang", "auto"));
await page.waitForTimeout(150);

/* --- Мастер «Создать с нуля»: предмет мира с качествами + настройка рецепта --- */
const forgeRec = await page.evaluate(async () => {
  const r = await Item.create({ name: "Рецепт кузни", type: "wfrp4e-recipe-book.recipe", img: "" });
  r.sheet.render(true);
  return r.id;
});
await page.waitForTimeout(200);
await page.click(`#rb-sheet-${forgeRec} [data-action='openForge']`);
await page.waitForTimeout(200);
const forge = `#rb-forge-${forgeRec}`;
ok((await $(forge).count()) === 1, "мастер открылся отдельным окном");
await page.fill(`${forge} .rb-forge-name`, "Пробный меч");
await page.evaluate((f) => document.querySelector(`${f} .rb-forge-name`).dispatchEvent(new Event("change")), forge);
await page.click(`${forge} .rb-qrow[data-key='durable'] .rb-prop-on`);
await page.waitForTimeout(150);
await page.fill(`${forge} .rb-qrow[data-key='durable'] .rb-prop-value`, "2");
await page.evaluate((f) => document.querySelector(`${f} .rb-qrow[data-key='durable'] .rb-prop-value`).dispatchEvent(new Event("change")), forge);
ok((await text(`${forge} .rb-forge-prognosis`)).includes("10"), "прогноз УУ: 5 базовых + 5 за достоинство = 10");
/* доп. сырьё за «Прочный»: железный слиток ×2 и 12 пенни */
await page.click(`${forge} .rb-qrow[data-key='durable'] [data-action='pickExtra']`);
await page.waitForTimeout(120);
await page.fill(`${forge} .rb-picker-search`, "мандраг");
await page.waitForTimeout(120);
await page.click(`${forge} .rb-picker-row`);
await page.waitForTimeout(150);
await page.fill(`${forge} .rb-qrow[data-key='durable'] .rb-extra-count`, "2");
await page.evaluate((f) => document.querySelector(`${f} .rb-qrow[data-key='durable'] .rb-extra-count`).dispatchEvent(new Event("change")), forge);
await page.fill(`${forge} .rb-qrow[data-key='durable'] .rb-extra-bp`, "12");
await page.evaluate((f) => document.querySelector(`${f} .rb-qrow[data-key='durable'] .rb-extra-bp`).dispatchEvent(new Event("change")), forge);
/* вес и базовая цена */
await page.fill(`${forge} .rb-forge-enc`, "2");
await page.evaluate((f) => document.querySelector(`${f} .rb-forge-enc`).dispatchEvent(new Event("change")), forge);
await page.fill(`${forge} .rb-forge-gc`, "1");
await page.evaluate((f) => document.querySelector(`${f} .rb-forge-gc`).dispatchEvent(new Event("change")), forge);
await page.fill(`${forge} .rb-forge-ss`, "4");
await page.evaluate((f) => document.querySelector(`${f} .rb-forge-ss`).dispatchEvent(new Event("change")), forge);
/* иконка будущего предмета - из базы */
await page.click(`${forge} .rb-forge-imgwrap`);
await page.waitForTimeout(120);
await page.fill(`${forge} .rb-picker-search`, "кинжал");
await page.waitForTimeout(120);
await page.click(`${forge} .rb-picker-row`);
await page.waitForTimeout(150);
ok(await page.evaluate((f) => {
  const img = document.querySelector(`${f} .rb-forge-img`);
  const w = __RB_worldItems__.find((x) => x.name === "Кинжал");
  return img.getAttribute("src") === w.img;
}, forge), "иконка предмета в мастере выбрана из базы");
const cbSize = await page.evaluate((f) => {
  const cb = document.querySelector(`${f} input[type=checkbox]`);
  return cb ? cb.getBoundingClientRect().width : 0;
}, forge);
ok(cbSize > 0 && cbSize <= 18, "чекбоксы прижаты против скина ядра", `(${cbSize}px)`);
/* табы и каунтеры */
ok((await $(`${forge} .rb-tab`).count()) === 4, "мастер разбит на 4 таба");
ok((await $(`${forge} .rb-forge-replace`).count()) === 1, "у иконки есть оверлей «Заменить»");
await page.focus(`${forge} .rb-forge-name`);
await page.waitForTimeout(100);
const focusFit = await page.evaluate((f) => {
  const el = document.querySelector(`${f} .rb-forge-name`);
  const box = document.querySelector(`${f} .rb-forge-scroll`);
  const s = getComputedStyle(el);
  const off = parseFloat(s.outlineOffset) || 0;
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  return { inside: r.right + off <= b.right + 0.5 && r.left - off >= b.left - 0.5, off };
}, forge);
ok(focusFit.inside && focusFit.off <= 0, "обводка фокуса не выходит за прокручиваемую область", JSON.stringify(focusFit));
const forgeImgW = await page.evaluate((f) => document.querySelector(`${f} .rb-forge-img`).getBoundingClientRect().width, forge);
ok(Math.abs(forgeImgW - 150) < 3, "иконка-карточка 144px (+рамка)", `(${forgeImgW}px)`);
/* высота строк свойств не скачет при включении доп. контента */
const rowH = async () => page.evaluate((f) => {
  const rows = [...document.querySelectorAll(`${f} .rb-qrow`)].slice(0, 3);
  return rows.map((r) => Math.round(r.getBoundingClientRect().height));
}, forge);
const hBefore = await rowH();
await page.click(`${forge} .rb-qrow[data-key='accurate'] .rb-prop-label`);
await page.waitForTimeout(200);
const hAfter = await rowH();
ok(JSON.stringify(hBefore) === JSON.stringify(hAfter),
  "включение качества не меняет высоту строк - соседние чекбоксы не прыгают", `${hBefore} -> ${hAfter}`);
await page.click(`${forge} .rb-qrow[data-key='accurate'] .rb-prop-label`);
await page.waitForTimeout(150);

/* в мастере тоже: подпись качества кликабельна */
await page.click(`${forge} .rb-qrow[data-key='fine'] .rb-prop-label`);
await page.waitForTimeout(200);
ok(await page.evaluate((f) => document.querySelector(`${f} .rb-qrow[data-key='fine'] .rb-prop-on`).checked, forge),
  "клик по тексту качества в мастере включает его");
await page.click(`${forge} .rb-qrow[data-key='fine'] .rb-prop-label`);
await page.waitForTimeout(200);
ok((await text(`${forge} .rb-tab.is-active`)).includes("Достоинства") &&
   (await text(`${forge} [data-tab='qualities'] .rb-tab-count`)) === "1",
  "каунтер на табе достоинств: 1 включено");
/* тултип-описание качества */
ok(((await page.getAttribute(`${forge} .rb-qrow[data-key='durable']`, "data-rb-tip")) ?? "").includes("ыдерживает"),
  "у качества есть тултип с описанием эффекта");
/* крит и провал - в своих табах */
await page.click(`${forge} [data-tab='crit']`);
await page.waitForTimeout(120);
await page.click(`${forge} .rb-critrow[data-key='damaging'] .rb-prop-on`);
await page.waitForTimeout(120);
ok((await text(`${forge} [data-tab='crit'] .rb-tab-count`)) === "1", "каунтер на табе крита: 1");
await page.click(`${forge} [data-tab='fail']`);
await page.waitForTimeout(120);
await page.click(`${forge} .rb-forge-failflawed`);
await page.waitForTimeout(150);
await page.fill(`${forge} .rb-forge-cleansl`, "2");
await page.evaluate((f) => document.querySelector(`${f} .rb-forge-cleansl`).dispatchEvent(new Event("change")), forge);
await page.waitForTimeout(150);
ok((await text(`${forge} [data-tab='fail'] .rb-tab-count`)) === "2", "каунтер на табе провала: 2 (брак + порог)");
await page.click(`${forge} [data-action='forgeCreate']`);
await page.waitForTimeout(250);
const forged = await page.evaluate((rid) => {
  const item = game.items.find((i) => i.name === "Пробный меч");
  const r = game.items.find((i) => i.id === rid);
  const up = r.system.upgrades.find((u) => u.quality === "durable");
  return {
    item: !!item, type: item?.type,
    img: item?.img === __RB_worldItems__.find((x) => x.name === "Кинжал")?.img,
    enc: item?.system.encumbrance?.value, price: item?.system.price,
    durableOnItem: !!item?.system.qualities.value.find((q) => q.name === "durable"),
    slTarget: r.system.slTarget,
    upSl: up?.slBonus, upBp: up?.moneyBp,
    upIng: up?.ingredients?.find((i) => i.name === "Корень мандрагоры")?.count,
    critQ: r.system.critQualities.map((q) => q.name).join(","),
    failFlawed: r.system.failFlawed, cleanSL: r.system.cleanSL,
    pool: r.system.failPool.length,
    linked: r.system.result.uuid === item?.uuid
  };
}, forgeRec);
ok(forged.item && forged.type === "weapon" && forged.img && !forged.durableOnItem,
  "создан предмет мира: оружие с выбранной иконкой; «Прочный» ушёл в улучшения, а не вшит", JSON.stringify(forged));
ok(forged.enc === 2 && forged.price?.gc === 1 && forged.price?.ss === 4, "вес 2 и базовая цена 1зк 4сш записаны в предмет", JSON.stringify({enc: forged.enc, price: forged.price}));
ok(forged.slTarget === 5 && forged.upSl === 5 && forged.upIng === 2 && forged.upBp === 12,
  "улучшение записано: +5 УУ за мандрагору ×2 и 12 пенни", JSON.stringify(forged));
ok(forged.critQ === "damaging" && forged.failFlawed && forged.cleanSL === 2 && forged.pool > 0 && forged.linked,
  "крит-качества и правила брака записаны, результат привязан");
await page.evaluate(() => {
  for (const el of document.querySelectorAll("[id^='rb-sheet-'],[id^='rb-forge-']")) el.querySelector("[data-mock-close]")?.click();
});
await page.waitForTimeout(100);

/* --- Брак при провале и порог чистой работы (e2e на крафте) --- */
await page.evaluate(async () => {
  await __RB_actor__.createEmbeddedDocuments("Item", [{
    name: "Рецепт: Кривой нож", type: "wfrp4e-recipe-book.recipe", img: "",
    system: {
      result: { uuid: "", name: "Кривой нож", img: "", count: 1 },
      skill: "Ремесло (Аптекарь)", skillAlt: "", difficulty: "average", slTarget: 1,
      ingredients: [], moneyBp: 0, needsWorkshop: false, tools: [],
      critEnabled: false, critSL: 99, critExtra: false, critCount: 1, critUpgrade: false, critRefund: false, critRandom: false,
      critQualities: [], critQualMode: "and", critResult: { uuid: "", name: "", img: "" },
      failFlawed: true, cleanSL: 5, failPool: ["shoddy"],
      timeDays: 0, timeHours: 0, timeMinutes: 0,
      description: { value: "" }, gmdescription: { value: "" }
    }
  }]);
});
await page.waitForTimeout(150);
await $(".rb-entry", { hasText: "Кривой нож" }).first().click();
await page.waitForTimeout(80);
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 100; });
await $(".rb-btn--craft").first().click();
await page.waitForTimeout(250);
ok(await page.evaluate(() => {
  const it = [...__RB_actor__.items].find((i) => i.name === "Кривой нож" && i.type === "trapping");
  return !!it && it.system.flaws.value.some((f) => f.name === "shoddy");
}), "брак при провале: предмет создан со случайным изъяном из пула");
await $(".rb-entry", { hasText: "Кривой нож" }).first().click();
await page.waitForTimeout(80);
await page.evaluate(() => { window.__RB_FORCE_ROLL__ = 42; });
await $(".rb-btn--craft").first().click();
await page.waitForTimeout(250);
ok(await page.evaluate(() => {
  const items = [...__RB_actor__.items].filter((i) => i.name === "Кривой нож" && i.type === "trapping");
  const second = items.at(-1);
  return items.length === 2 && second.system.flaws.value.some((f) => f.name === "shoddy");
}), "порог чистой работы: успех с низким УУ дал предмет с изъяном");
await page.evaluate(async () => {
  for (const i of [...__RB_actor__.items].filter((x) => x.name === "Кривой нож" || x.name === "Рецепт: Кривой нож")) await i.delete();
  for (const i of [...game.items].filter((x) => ["Пробный меч", "Рецепт кузни"].includes(x.name))) await i.delete();
});
await page.waitForTimeout(120);

/* --- Стартовые рецепты профессий: установка из настроек ГМа --- */
await page.click("#tb-starter");
await page.waitForTimeout(250);
ok((await $("#rb-starter .rb-starter-row").count()) === 7, "окно стартовых рецептов: 7 профессий");
/* раскрытие профессии показывает её рецепты */
ok((await $("#rb-starter .rb-starter-recipe").count()) === 0, "списки рецептов свёрнуты по умолчанию");
await page.click("#rb-starter .rb-starter-row[data-key='apothecary'] [data-action='toggleProf']");
await page.waitForTimeout(250);
ok((await $("#rb-starter .rb-starter-recipe").count()) === 3, "раскрытая профессия показала свои 3 рецепта");
/* ховер по рецепту показывает параметры будущего предмета */
await $("#rb-starter .rb-starter-recipe").first().hover();
await page.waitForTimeout(450);
const starterTip = await page.evaluate(() => document.getElementById("rb-tooltip")?.textContent ?? "");
ok(starterTip.includes("Цена") && starterTip.includes("Ремесло (Аптекарь)") && starterTip.includes("Ингредиенты"),
  "ховер рецепта в окне показывает цену, навык и ингредиенты", starterTip.replace(/\s+/g, " ").slice(0, 100));
await page.mouse.move(5, 5);
await page.waitForTimeout(100);
/* снимаем всё и берём ровно один рецепт аптекаря */
await page.click("#rb-starter [data-action='toggleAll']");
await page.waitForTimeout(250);
ok((await text("#rb-starter .rb-starter-total")).includes("0"), "«снять всё» очистило выбор");
await page.click("#rb-starter .rb-starter-recipe:nth-child(2) input");
await page.waitForTimeout(250);
const partial = await page.evaluate(() => {
  const row = document.querySelector("#rb-starter .rb-starter-row[data-key='apothecary']");
  return { some: row.dataset.some, indeterminate: row.querySelector("input").indeterminate, count: row.querySelector(".rb-starter-count").textContent.trim() };
});
ok(partial.some === "true" && partial.indeterminate && partial.count === "1 / 3",
  "частичный выбор: галка профессии в промежуточном состоянии, счётчик 1 / 3", JSON.stringify(partial));
await page.click("#rb-starter [data-action='install']");
await page.waitForTimeout(600);
const starter = await page.evaluate(() => {
  const recipes = game.items.filter((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.skill === "Ремесло (Аптекарь)");
  const r = recipes[0];
  const result = r && game.items.find((i) => i.uuid === r.system.result.uuid);
  return {
    count: recipes.length,
    hasOther: game.items.some((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.skill === "Ремесло (Кузнец)"),
    ingOk: r?.system.ingredients.every((i) => !!i.uuid && !!i.img),
    resType: result?.type, resTrap: result?.system.trappingType?.value,
    resPrice: result?.system.price, resEnc: result?.system.encumbrance?.value,
    resImg: (result?.img ?? "").startsWith("data:") || (result?.img ?? "").includes("assets/icons"),
    resDesc: (result?.system.description?.value ?? "").length > 10
  };
});
ok(starter.count === 1 && !starter.hasOther, "поставлен ровно один выбранный рецепт", JSON.stringify({c: starter.count, other: starter.hasOther}));
ok(starter.ingOk, "сырьё рецептов - настоящие предметы мира (есть uuid и иконка)");
ok(starter.resType === "trapping" && starter.resTrap === "drugsPoisonsHerbsDraughts",
  "результат - зелье нужного подтипа (применяется кликом в paperdoll)", JSON.stringify(starter));
ok(starter.resEnc !== undefined && starter.resPrice && starter.resImg && starter.resDesc,
  "у результата есть вес, цена, иконка и описание", JSON.stringify({enc: starter.resEnc, price: starter.resPrice}));
/* повторная установка не плодит дубли */
await page.click("#rb-starter [data-action='install']");
await page.waitForTimeout(500);
ok(await page.evaluate((n) => game.items.filter((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.skill === "Ремесло (Аптекарь)").length === n, starter.count),
  "повторная установка не создаёт дубли");
/* теперь ставим всю профессию - добавятся только недостающие */
await page.click("#rb-starter .rb-starter-row[data-key='apothecary'] > .rb-ing-name input");
await page.waitForTimeout(250);
await page.click("#rb-starter [data-action='install']");
await page.waitForTimeout(600);
ok(await page.evaluate(() => game.items.filter((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.skill === "Ремесло (Аптекарь)").length === 3),
  "выбор всей профессии доставил остальные рецепты");
await page.evaluate(() => document.querySelector("#rb-starter [data-mock-close]")?.click());
await page.waitForTimeout(150);

/* --- Кнопка ГМа «Создать рецепт» из предмета --- */
await page.click("#tb-fromitem");
await page.waitForTimeout(200);
ok((await $("#mock-bar .rb-picker").count()) === 1, "пикер предметов открылся из панели");
const pickerImg = await page.evaluate(() => {
  const img = document.querySelector("#mock-bar .rb-picker-row img");
  const list = document.querySelector("#mock-bar .rb-picker-list");
  return { w: img ? Math.round(img.getBoundingClientRect().width) : 0, maxH: getComputedStyle(list).maxHeight };
});
const pickerType = await page.evaluate(() => {
  const row = document.querySelector("#mock-bar .rb-picker-row");
  const s = getComputedStyle(row);
  return { fs: s.fontSize, color: s.color };
});
ok(pickerType.fs === "12px" && pickerType.color === "rgb(42, 33, 25)",
  "в пикере свой кегль и цвет, чужие стили не перебивают", JSON.stringify(pickerType));
ok(pickerImg.w === 26 && pickerImg.maxH === "220px",
  "пикер вне окна модуля стилизован (иконка 24px с рамкой, список с прокруткой)", JSON.stringify(pickerImg));
await page.fill("#mock-bar .rb-picker-search", "перегонный");
await page.waitForTimeout(150);
await page.click("#mock-bar .rb-picker-row");
await page.waitForTimeout(400);
const fromItem = await page.evaluate(() => {
  const r = game.items.find((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.result?.name === "Перегонный куб");
  const src = __RB_worldItems__.find((w) => w.name === "Перегонный куб");
  return r ? {
    name: r.name, linked: r.system.result.uuid === src.uuid,
    difficulty: r.system.difficulty, slTarget: r.system.slTarget, moneyBp: r.system.moneyBp,
    descr: (r.system.description?.value ?? "").includes("змеевиком"),
    sheet: !!document.querySelector(`#rb-sheet-${r.id}`)
  } : null;
});
ok(fromItem && fromItem.linked && fromItem.name.includes("Перегонный куб"),
  "рецепт создан из предмета и привязан к нему", JSON.stringify(fromItem));
ok(fromItem.difficulty === "challenging" && fromItem.slTarget === 15 && fromItem.moneyBp === 60,
  "подставлены правила: редкий → серьёзная, цена 1 зк → УУ 15, сырьё 60 п", JSON.stringify(fromItem));
ok(fromItem.descr && fromItem.sheet, "описание предмета перенесено, лист рецепта открыт сразу");
/* повторное создание не плодит дубли */
await page.evaluate(() => document.querySelector("[id^='rb-sheet-'] [data-mock-close]")?.click());
await page.waitForTimeout(150);
await page.click("#tb-fromitem");
await page.waitForTimeout(200);
await page.fill("#mock-bar .rb-picker-search", "перегонный");
await page.waitForTimeout(150);
await page.click("#mock-bar .rb-picker-row");
await page.waitForTimeout(300);
ok(await page.evaluate(() => game.items.filter((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.result?.name === "Перегонный куб").length === 1),
  "повторный вызов открывает существующий рецепт, а не создаёт второй");
await page.evaluate(() => document.querySelector("[id^='rb-sheet-'] [data-mock-close]")?.click());
await page.waitForTimeout(150);

/* --- Скриншот для Михаила --- */
await $(".rb-entry", { hasText: "Противоядие" }).first().click();
await page.waitForTimeout(80);
await page.screenshot({ path: path.join(root, "docs", "book-mock.png"), fullPage: false });

console.log(`\nИтог: PASS ${pass}, FAIL ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
