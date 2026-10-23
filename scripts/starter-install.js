/* Установка стартовых рецептов: кнопка в настройках модуля (только ГМ).
   Создаёт в мире сырьё, предметы-результаты и рецепты профессий по каталогу.
   Повторный запуск безопасен: предметы ищутся по имени и переиспользуются. */

import { MODULE_ID, RECIPE_TYPE } from "./recipe-model.js";
import { L, F, moneyText, COIN_VALUE, RBTooltip, RecipeBookApp } from "./recipe-book.js";
import { STARTER_CATALOGUE } from "./starter-data.js";

const { ApplicationV2: StarterBase, HandlebarsApplicationMixin: StarterMixin } = foundry.applications.api;

const img = (file) => {
  const rel = `assets/icons/${file}`;
  // В моке ассеты вшиты в страницу (карта __RB_ASSETS__), в Foundry отдаёт сервер
  return globalThis.__RB_ASSETS__?.[rel] ?? `modules/${MODULE_ID}/${rel}`;
};

/** Папка предметов (с поддержкой вложенности), создаётся один раз */
async function ensureFolder(name, parent = null) {
  const found = game.folders?.find?.((f) => f.type === "Item" && f.name === name &&
    (parent ? (f.folder?.id ?? f.folder) === parent.id : true));
  if (found) return found;
  return Folder.create({ name, type: "Item", color: "#7a4c08", folder: parent?.id ?? null }).catch(() => null);
}

function findItem(name, type) {
  return game.items.find((i) => i.name === name && i.type === type) ?? null;
}

/** Данные предмета системы: цена, вес, доступность, описание, иконка */
function itemData(src, { type, trappingType, folder }) {
  const system = {
    quantity: { value: 1 },
    encumbrance: { value: Number(src.enc) || 0 },
    price: { gc: src.price?.gc ?? 0, ss: src.price?.ss ?? 0, bp: src.price?.bp ?? 0 },
    availability: { value: src.availability ?? "common" },
    description: { value: `<p>${src.description ?? ""}</p>` },
    gmdescription: { value: "" }
  };
  if (type === "trapping") system.trappingType = { value: trappingType ?? "misc" };
  return { name: src.name, type, img: img(src.img), folder: folder?.id ?? null, system };
}

/** Идентификатор рецепта в выборе: «профессия::название» */
export const recipeId = (profKey, name) => `${profKey}::${name}`;

/**
 * Поставить выбранные рецепты.
 * @param {string[]} selection элементы «профессия::рецепт» либо ключи профессий (вся профессия)
 * @returns {Promise<{recipes:number, items:number, skipped:number}>}
 */
export async function installStarter(selection) {
  const wanted = new Set(selection);
  const picked = STARTER_CATALOGUE
    .map((p) => {
      const whole = wanted.has(p.key);
      const recipes = p.recipes.filter((r) => whole || wanted.has(recipeId(p.key, r.name)));
      return recipes.length ? { ...p, recipes } : null;
    })
    .filter(Boolean);
  // Дерево папок: «Книга рецептов» → «Рецепты»/«Сырьё и товары» → профессия
  const rootFolder = await ensureFolder(L("WFRPRB.Starter.FolderRoot"));
  const recipesRoot = await ensureFolder(L("WFRPRB.Starter.FolderRecipes"), rootFolder);
  const itemsRoot = await ensureFolder(L("WFRPRB.Starter.FolderItems"), rootFolder);
  let madeItems = 0;
  let madeRecipes = 0;
  let skipped = 0;

  for (const prof of picked) {
    // Своя подпапка профессии - и для рецептов, и для предметов
    const recipeFolder = await ensureFolder(prof.label, recipesRoot);
    const stuffFolder = await ensureFolder(prof.label, itemsRoot);

    // 1. Сырьё, нужное выбранным рецептам (вместе с сырьём их улучшений)
    const needed = new Set();
    for (const r of prof.recipes) {
      for (const i of r.ingredients ?? []) needed.add(i.name);
      for (const u of r.upgrades ?? []) if (u.ingredientName) needed.add(u.ingredientName);
    }
    const stock = {};
    for (const ing of prof.ingredients.filter((i) => needed.has(i.name))) {
      let doc = findItem(ing.name, "trapping");
      if (!doc) {
        doc = await Item.create(itemData(ing, { type: "trapping", trappingType: "misc", folder: stuffFolder }));
        madeItems++;
      }
      stock[ing.name] = doc;
    }

    // 2. Результаты и рецепты
    for (const rec of prof.recipes) {
      let result = findItem(rec.name, rec.type);
      if (!result) {
        result = await Item.create(itemData(rec, { type: rec.type, trappingType: rec.trappingType, folder: stuffFolder }));
        madeItems++;
      }
      const recipeName = F("WFRPRB.Sheet.DefaultName", { name: rec.name });
      if (findItem(recipeName, RECIPE_TYPE)) { skipped++; continue; }

      const upgrades = (rec.upgrades ?? []).map((u) => ({
        quality: u.quality,
        name: "",                     // подпись подставит propertyLabel из системы
        slBonus: 5,
        moneyBp: Number(u.moneyBp) || 0,
        ingredients: u.ingredientName && stock[u.ingredientName]
          ? [{ uuid: stock[u.ingredientName].uuid, name: u.ingredientName, img: stock[u.ingredientName].img, count: Number(u.count) || 1 }]
          : []
      }));
      const crit = rec.crit ?? null;

      await Item.create({
        name: recipeName,
        type: RECIPE_TYPE,
        img: img("recipe-default.png"),
        folder: recipeFolder?.id ?? null,
        system: {
          result: { uuid: result.uuid, name: result.name, img: result.img, count: Number(rec.count) || 1 },
          skill: prof.skill, skillAlt: "",
          difficulty: rec.difficulty, slTarget: Number(rec.slTarget) || 5,
          ingredients: (rec.ingredients ?? []).map((i) => ({
            uuid: stock[i.name]?.uuid ?? "", name: i.name, img: stock[i.name]?.img ?? "", count: Number(i.count) || 1
          })),
          moneyBp: Number(rec.moneyBp) || 0,
          needsWorkshop: !!rec.needsWorkshop,
          tools: [],
          timeDays: rec.timeDays ?? 0, timeHours: rec.timeHours ?? 0, timeMinutes: rec.timeMinutes ?? 0,
          upgrades,
          critEnabled: !!crit,
          critSL: crit?.sl ?? 8,
          critExtra: false, critCount: 1, critUpgrade: false,
          critRefund: !!crit?.refund, critRandom: false,
          critQualities: (crit?.qualities ?? []).map((q) => ({ name: q, value: null })),
          critQualMode: "and",
          critResult: { uuid: "", name: "", img: "" },
          failFlawed: true, cleanSL: 0, failPool: ["shoddy", "ugly"],
          description: { value: `<p>${rec.description ?? ""}</p>` },
          gmdescription: { value: "" }
        }
      });
      madeRecipes++;
    }
  }

  RecipeBookApp.renderAll();
  return { recipes: madeRecipes, items: madeItems, skipped };
}

/** Подсказка-карточка рецепта каталога: что получится и чего это стоит */
function recipeTip(prof, rec) {
  const bp = (rec.price?.gc ?? 0) * COIN_VALUE.gc + (rec.price?.ss ?? 0) * COIN_VALUE.ss + (rec.price?.bp ?? 0);
  const time = [rec.timeDays && `${rec.timeDays}${L("WFRPRB.Time.d")}`, rec.timeHours && `${rec.timeHours}${L("WFRPRB.Time.h")}`,
    rec.timeMinutes && `${rec.timeMinutes}${L("WFRPRB.Time.m")}`].filter(Boolean).join(" ");
  const typeKey = `TYPES.Item.${rec.type}`;
  const lines = [
    `${rec.name}${rec.count > 1 ? ` ×${rec.count}` : ""}`,
    `${L("WFRPRB.Check")}	${prof.skill}`,
    `${L("WFRPRB.SLTarget")}	${rec.slTarget}`,
    `${L("WFRPRB.Tip.Price")}	${moneyText(bp)}`,
    rec.enc ? `${L("WFRPRB.Tip.Weight")}	${rec.enc}` : "",
    game.i18n.has(typeKey) ? `${L("WFRPRB.Forge.Type")}	${L(typeKey)}` : "",
    time ? `${L("WFRPRB.Time.Label")}	${time}` : "",
    `## ${L("WFRPRB.Ingredients")}`,
    ...(rec.ingredients ?? []).map((i) => `· ${i.name} ×${i.count}`),
    (rec.upgrades ?? []).length ? `## ${L("WFRPRB.Upgrades")}` : "",
    ...(rec.upgrades ?? []).map((u) => `· ${u.ingredientName ?? ""}${u.ingredientName && u.count > 1 ? ` ×${u.count}` : ""}`.trim()),
    rec.description ? `~ ${rec.description}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}

/** Окно выбора профессий (вызывается из настроек модуля) */
export class StarterRecipesApp extends StarterMixin(StarterBase) {
  static DEFAULT_OPTIONS = {
    id: "rb-starter",
    classes: ["wfrp-recipe-book", "rb-starter"],
    window: { title: "WFRPRB.Starter.Title", resizable: true },
    position: { width: 480, height: 560 },
    actions: {
      install: StarterRecipesApp.#onInstall,
      toggleAll: StarterRecipesApp.#onToggleAll,
      toggleProf: StarterRecipesApp.#onToggleProf
    }
  };

  static PARTS = { starter: { template: `modules/${MODULE_ID}/templates/starter.hbs`, scrollable: [".rb-starter-scroll"] } };

  constructor(options = {}) {
    super(options);
    // Выбор хранится по рецептам: «профессия::рецепт»
    this.picked = new Set(STARTER_CATALOGUE.flatMap((p) => p.recipes.map((r) => recipeId(p.key, r.name))));
    this.open = new Set();   // раскрытые профессии
  }

  get allIds() {
    return STARTER_CATALOGUE.flatMap((p) => p.recipes.map((r) => recipeId(p.key, r.name)));
  }

  async _prepareContext() {
    const professions = STARTER_CATALOGUE.map((p) => {
      const recipes = p.recipes.map((r) => ({
        id: recipeId(p.key, r.name),
        name: r.name,
        on: this.picked.has(recipeId(p.key, r.name)),
        installed: !!findItem(F("WFRPRB.Sheet.DefaultName", { name: r.name }), RECIPE_TYPE),
        tip: recipeTip(p, r)
      }));
      const chosen = recipes.filter((r) => r.on).length;
      return {
        key: p.key, label: p.label, skill: p.skill, recipes,
        list: p.recipes.map((r) => r.name).join(", "),
        open: this.open.has(p.key),
        on: chosen > 0, some: chosen > 0 && chosen < recipes.length,
        chosen, count: recipes.length,
        installed: recipes.every((r) => r.installed)
      };
    });
    return { professions, total: this.picked.size };
  }

  _onRender() {
    const root = this.element;
    root.classList.toggle("rb-theme-dark", game.settings.get(MODULE_ID, "bookTheme") === "dark");
    RBTooltip.adoptTips();

    // Галка профессии: включает/выключает все её рецепты, частичный выбор - промежуточное состояние
    for (const el of root.querySelectorAll(".rb-starter-row > .rb-ing-name input")) {
      const row = el.closest(".rb-starter-row");
      const prof = STARTER_CATALOGUE.find((p) => p.key === row.dataset.key);
      const ids = prof.recipes.map((r) => recipeId(prof.key, r.name));
      const partial = row.dataset.some === "true";
      el.indeterminate = partial;
      el.addEventListener("change", (ev) => {
        // Частичный выбор по клику ДОБИРАЕТ всю профессию (стандартное поведение три-состояния)
        const selectAll = partial || ev.currentTarget.checked;
        if (selectAll) for (const id of ids) this.picked.add(id);
        else for (const id of ids) this.picked.delete(id);
        this.render();
      });
    }
    // Галка отдельного рецепта
    for (const el of root.querySelectorAll(".rb-starter-recipe input")) {
      el.addEventListener("change", (ev) => {
        const id = ev.currentTarget.closest(".rb-starter-recipe").dataset.id;
        if (ev.currentTarget.checked) this.picked.add(id);
        else this.picked.delete(id);
        this.render();
      });
    }
  }

  static #onToggleProf(event, target) {
    const key = target.closest(".rb-starter-row").dataset.key;
    if (this.open.has(key)) this.open.delete(key);
    else this.open.add(key);
    this.render();
  }

  static #onToggleAll() {
    if (this.picked.size === this.allIds.length) this.picked.clear();
    else this.picked = new Set(this.allIds);
    this.render();
  }

  static async #onInstall() {
    if (!this.picked.size) return ui.notifications.warn(L("WFRPRB.Starter.PickSome"));
    const res = await installStarter([...this.picked]);
    ui.notifications.info(F("WFRPRB.Starter.Done", res));
    this.render();
  }
}
