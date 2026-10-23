/* «Рецепт из предмета»: кнопка на листе любого предмета (только ГМ).
   Создаёт рецепт в мире, подставляя сложность по доступности, требуемый УУ по цене
   и сырьё в четверть цены - по правилам «Создание предмета» (Книга правил, стр. 199). */

import { MODULE_ID, RECIPE_TYPE } from "./recipe-model.js";
import { L, F, priceBp, COIN_VALUE, RecipeBookApp } from "./recipe-book.js";

const AVAIL_TO_DIFF = { common: "average", scarce: "challenging", rare: "difficult", exotic: "veryHard" };

/** Типы, из которых осмысленно делать рецепт (всё физическое, что можно изготовить) */
const CRAFTABLE = ["weapon", "armour", "trapping", "ammunition", "container", "money"];

export function canMakeRecipe(item) {
  if (!item || item.type === RECIPE_TYPE) return false;
  if (item.type === "money") return false;          // монеты не куют
  return CRAFTABLE.includes(item.type);
}

/** Подсказки по правилам: сложность по доступности, УУ по цене, сырьё = 1/4 цены */
export function suggestFromItem(doc) {
  const sys = doc.system ?? {};
  const bp = priceBp(sys);
  const avail = sys.availability?.value ?? "common";
  return {
    difficulty: AVAIL_TO_DIFF[avail] ?? "challenging",
    slTarget: bp >= COIN_VALUE.gc ? 15 : bp >= COIN_VALUE.ss ? 10 : 5,
    moneyBp: Math.floor(bp / 4)
  };
}

/** Уже есть рецепт на этот предмет? (ищем по uuid результата, иначе по имени) */
export function existingRecipeFor(item) {
  return (game.items ?? []).find((i) =>
    i.type === RECIPE_TYPE &&
    (i.system.result?.uuid === item.uuid || i.system.result?.name === item.name)) ?? null;
}

/**
 * Создать рецепт по предмету. Если рецепт уже есть - просто открыть его.
 * @returns {Promise<Item|null>}
 */
export async function createRecipeFromItem(item, { open = true } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(L("WFRPRB.FromItem.GMOnly"));
    return null;
  }
  if (!canMakeRecipe(item)) {
    ui.notifications.warn(L("WFRPRB.FromItem.Unsupported"));
    return null;
  }

  const already = existingRecipeFor(item);
  if (already) {
    ui.notifications.info(F("WFRPRB.FromItem.Exists", { name: item.name }));
    if (open) already.sheet?.render(true);
    return already;
  }

  const s = suggestFromItem(item);
  const recipe = await Item.create({
    name: F("WFRPRB.Sheet.DefaultName", { name: item.name }),
    type: RECIPE_TYPE,
    img: `modules/${MODULE_ID}/assets/icons/recipe-default.png`,
    system: {
      result: { uuid: item.uuid, name: item.name, img: item.img, count: 1 },
      skill: "", skillAlt: "",
      difficulty: s.difficulty, slTarget: s.slTarget,
      ingredients: [], moneyBp: s.moneyBp,
      needsWorkshop: false, tools: [], upgrades: [],
      timeDays: 0, timeHours: 0, timeMinutes: 0,
      critEnabled: false, critSL: 8, critExtra: false, critCount: 1,
      critUpgrade: false, critRefund: false, critRandom: false,
      critQualities: [], critQualMode: "and", critResult: { uuid: "", name: "", img: "" },
      failFlawed: false, cleanSL: 0, failPool: [],
      description: { value: item.system?.description?.value ?? "" },
      gmdescription: { value: "" }
    }
  });
  if (!recipe) return null;

  ui.notifications.info(F("WFRPRB.FromItem.Created", { name: item.name }));
  RecipeBookApp.renderAll();
  if (open) recipe.sheet?.render(true);
  return recipe;
}
