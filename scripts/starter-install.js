/* Установка стартовых рецептов: кнопка в настройках модуля (только ГМ).
   Создаёт в мире сырьё, предметы-результаты и рецепты профессий по каталогу.
   Повторный запуск безопасен: предметы ищутся по имени и переиспользуются. */

import { MODULE_ID, RECIPE_TYPE } from "./recipe-model.js";
import { L, F, RecipeBookApp } from "./recipe-book.js";
import { STARTER_CATALOGUE } from "./starter-data.js";

const { ApplicationV2: StarterBase, HandlebarsApplicationMixin: StarterMixin } = foundry.applications.api;

const img = (file) => {
  const rel = `assets/icons/${file}`;
  // В моке ассеты вшиты в страницу (карта __RB_ASSETS__), в Foundry отдаёт сервер
  return globalThis.__RB_ASSETS__?.[rel] ?? `modules/${MODULE_ID}/${rel}`;
};

/** Папка для стартовых предметов (чтобы не захламлять вкладку «Предметы») */
async function ensureFolder(name) {
  const found = game.folders?.find((f) => f.type === "Item" && f.name === name);
  if (found) return found;
  return Folder.create({ name, type: "Item", color: "#7a4c08" }).catch(() => null);
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

/**
 * Поставить выбранные профессии.
 * @param {string[]} keys ключи профессий каталога
 * @returns {Promise<{recipes:number, items:number, skipped:number}>}
 */
export async function installStarter(keys) {
  const picked = STARTER_CATALOGUE.filter((p) => keys.includes(p.key));
  const stuffFolder = await ensureFolder(L("WFRPRB.Starter.FolderItems"));
  const recipeFolder = await ensureFolder(L("WFRPRB.Starter.FolderRecipes"));
  let madeItems = 0;
  let madeRecipes = 0;
  let skipped = 0;

  for (const prof of picked) {
    // 1. Сырьё профессии
    const stock = {};
    for (const ing of prof.ingredients) {
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

/** Окно выбора профессий (вызывается из настроек модуля) */
export class StarterRecipesApp extends StarterMixin(StarterBase) {
  static DEFAULT_OPTIONS = {
    id: "rb-starter",
    classes: ["wfrp-recipe-book", "rb-starter"],
    window: { title: "WFRPRB.Starter.Title", resizable: true },
    position: { width: 480, height: 560 },
    actions: { install: StarterRecipesApp.#onInstall, toggleAll: StarterRecipesApp.#onToggleAll }
  };

  static PARTS = { starter: { template: `modules/${MODULE_ID}/templates/starter.hbs`, scrollable: [".rb-starter-scroll"] } };

  constructor(options = {}) {
    super(options);
    this.picked = new Set(STARTER_CATALOGUE.map((p) => p.key));
  }

  async _prepareContext() {
    return {
      professions: STARTER_CATALOGUE.map((p) => ({
        key: p.key, label: p.label, skill: p.skill,
        on: this.picked.has(p.key),
        recipes: p.recipes.map((r) => r.name).join(", "),
        installed: p.recipes.every((r) => !!findItem(F("WFRPRB.Sheet.DefaultName", { name: r.name }), RECIPE_TYPE))
      })),
      total: [...this.picked].length
    };
  }

  _onRender() {
    const root = this.element;
    root.classList.toggle("rb-theme-dark", game.settings.get(MODULE_ID, "bookTheme") === "dark");
    for (const el of root.querySelectorAll(".rb-starter-row input")) {
      el.addEventListener("change", (ev) => {
        const key = ev.currentTarget.closest(".rb-starter-row").dataset.key;
        if (ev.currentTarget.checked) this.picked.add(key);
        else this.picked.delete(key);
        this.render();
      });
    }
  }

  static #onToggleAll() {
    if (this.picked.size === STARTER_CATALOGUE.length) this.picked.clear();
    else this.picked = new Set(STARTER_CATALOGUE.map((p) => p.key));
    this.render();
  }

  static async #onInstall() {
    if (!this.picked.size) return ui.notifications.warn(L("WFRPRB.Starter.PickSome"));
    const res = await installStarter([...this.picked]);
    ui.notifications.info(F("WFRPRB.Starter.Done", res));
    this.render();
  }
}
