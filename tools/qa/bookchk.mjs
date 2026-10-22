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
ok((await $(".rb-entry:not(.rb-project)").count()) === 5, "в списке 5 рецептов");
ok((await $(".rb-group-title").count()) >= 3, "рецепты сгруппированы по ремёслам");
const readyNames = await $(".rb-entry.rb-ready .rb-entry-name").allTextContents();
ok(readyNames.length === 3, "подсвечено 3 доступных", `(${readyNames.join("; ")})`);
ok(readyNames.some((n) => n.includes("Лечебная настойка")), "настойка подсвечена");
ok(!readyNames.some((n) => n.includes("Кинжал")), "кинжал без навыка не подсвечен");
ok(!readyNames.some((n) => n.includes("Противоядие")), "противоядие без мандрагоры не подсвечено");

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

/* --- Понятность: подсказки и богатый ховер (свой тултип, системный отключён) --- */
ok((await $("[data-tooltip]").count()) === 0, "системные тултипы Foundry не используются");
ok((await $(".rb-entry", { hasText: "Кинжал" }).first().getAttribute("data-rb-tip") ?? "").includes("навык"),
  "подсказка на записи: почему кинжал недоступен");
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
ok(((await $(".rb-entry", { hasText: "Противоядие" }).first().getAttribute("data-rb-tip")) ?? "").includes("инструменты"),
  "в причинах недоступности есть инструменты");

/* Лист ГМа: навыки дропдауном из базы, минуты времени */
await $(".rb-entry", { hasText: "Лечебная настойка" }).first().click();
await page.waitForTimeout(80);
await page.click("#tb-sheet");
await page.waitForTimeout(200);
const sheet = await page.evaluate(() => {
  const el = document.getElementById("rb-sheet-demo");
  const sel = el?.querySelector("select[name='system.skill']");
  return {
    skillOptions: sel ? sel.options.length : 0,
    hasTrade: sel ? [...sel.options].some((o) => o.value === "Ремесло (Кузнец)") : false,
    minutes: !!el?.querySelector(".rb-time-m"),
    toolZone: !!el?.querySelector("[data-dropzone='tools']"),
    coinIcons: el?.querySelectorAll(".rb-money-fields .rb-coin-img, .rb-money-fields .rb-coin-dot").length ?? 0
  };
});
ok(sheet.skillOptions >= 10 && sheet.hasTrade, "лист ГМа: навык - дропдаун из базы", JSON.stringify(sheet));
ok(await page.evaluate(() => {
  const sel = document.querySelector("#rb-sheet-demo select[name='system.skill']");
  return [...sel.options].some((o) => o.value === "Ремесло (Самогонщик)");
}), "в дропдауне есть навык, созданный ГМом только на персонаже");
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
  const r = document.querySelector("#rb-sheet-demo .rb-sheet-root");
  r.scrollTop = 300;
});
await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-crit-on")?.click());
await page.waitForTimeout(250);
const scrollKept = await page.evaluate(() => document.querySelector("#rb-sheet-demo .rb-sheet-root").scrollTop);
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
ok(after.chat.includes("Создано"), "карточка «Создано» в чате");

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
ok(readyCount === 0, "фильтр «могу сделать»: после трёх крафтов сырья нет - пусто", `(${readyCount})`);
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
ok((await $(".rb-entry", { hasText: "Новый рецепт" }).count()) === 1, "новый рецепт виден во вкладке «Мир»");
ok((await $(".rb-group-title", { hasText: "Мир" }).count()) === 1, "реестр: мировые рецепты в группе «Мир»");
ok((await $(".rb-group-title", { hasText: "Гюнтер" }).count()) === 1 &&
   (await $(".rb-entry", { hasText: "Лечебная настойка" }).count()) === 2,
  "реестр: видны копии у персонажей - две версии настойки");
ok(await page.evaluate(() => game.items.some((i) => i.name === "Новый рецепт")), "рецепт создан именно в мире, не на актёре");
const newSheetOpen = await page.evaluate(() =>
  [...document.querySelectorAll(".rb-sheet-root")].some((el) => el.closest(".window-app")));
ok(newSheetOpen, "лист нового рецепта открылся сразу");
ok(await page.evaluate(() => {
  const sheets = [...document.querySelectorAll("[id^='rb-sheet-']")];
  const el = sheets.at(-1);
  return !!el?.querySelector("[data-action='saveSheet']") && !el?.querySelector("[data-action='saveAsNew']");
}), "у рецепта с нуля - только «Сохранить», без «Сохранить как новый»");

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
await $(".rb-entry", { hasText: "Новый рецепт" }).first().click();
await page.waitForTimeout(100);
ok((await $("[data-action='giveRecipe']").count()) === 1 && (await $("[data-action='deleteRecipe']").count()) === 1,
  "у рецепта мира кнопки «выдать» и «удалить»");
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
ok(await page.evaluate(() => !__RB_actor__.items.some((i) => i.type === "wfrp4e-recipe-book.recipe" && i.system.result?.name === "Талисман из коры")),
  "ГМ удалил рецепт из книги персонажа");
await $("[data-action='filter'][data-filter='world']").click();
await page.waitForTimeout(80);
await $(".rb-entry", { hasText: "Талисман из коры" }).first().click();
await page.waitForTimeout(80);
await $("[data-action='deleteRecipe']").click();
await page.waitForTimeout(200);
ok(await page.evaluate(() => !game.items.some((i) => i.name === "Новый рецепт")), "ГМ удалил рецепт из мира");
await $("[data-action='filter'][data-filter='all']").click();
await page.waitForTimeout(80);

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

/* --- Доп. фильтры по ремеслу и типу (настройка, по умолчанию выключены) --- */
ok((await $(".rb-extra-filters").count()) === 0, "доп. фильтры по умолчанию выключены");
await page.evaluate(() => game.settings.set("wfrp4e-recipe-book", "extraFilters", true));
await page.waitForTimeout(150);
ok((await $(".rb-extra-filters select").count()) === 2, "настройка включила фильтры ремесла и типа");
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
ok(weaponEntries.length === 1 && weaponEntries[0].includes("Кинжал"), "фильтр по типу: только оружие (Кинжал)", weaponEntries.join(";"));
await page.evaluate(() => game.settings.set("wfrp4e-recipe-book", "extraFilters", false));
await page.waitForTimeout(150);
ok((await $(".rb-extra-filters").count()) === 0, "выключение настройки спрятало фильтры");

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

/* --- Скриншот для Михаила --- */
await $(".rb-entry", { hasText: "Противоядие" }).first().click();
await page.waitForTimeout(80);
await page.screenshot({ path: path.join(root, "docs", "book-mock.png"), fullPage: false });

console.log(`\nИтог: PASS ${pass}, FAIL ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
