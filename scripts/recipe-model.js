/* Модель предмета «Рецепт» (подтип модуля, Foundry v11+ documentTypes).
   Вся математика броска - у системы; здесь только данные рецепта. */

export const MODULE_ID = "wfrp4e-recipe-book";
export const RECIPE_TYPE = `${MODULE_ID}.recipe`;

/* Запасные таблицы на случай отсутствия системы (мок). Живые значения берём из game.wfrp4e.config. */
export const FALLBACK_DIFFICULTIES = {
  veryEasy: { label: "WFRPRB.Difficulty.veryEasy", mod: 60 },
  easy: { label: "WFRPRB.Difficulty.easy", mod: 40 },
  average: { label: "WFRPRB.Difficulty.average", mod: 20 },
  challenging: { label: "WFRPRB.Difficulty.challenging", mod: 0 },
  difficult: { label: "WFRPRB.Difficulty.difficult", mod: -10 },
  hard: { label: "WFRPRB.Difficulty.hard", mod: -20 },
  veryHard: { label: "WFRPRB.Difficulty.veryHard", mod: -30 }
};

export function difficultyMod(key) {
  const sys = game.wfrp4e?.config?.difficultyModifiers;
  if (sys && key in sys) return Number(sys[key]) || 0;
  return FALLBACK_DIFFICULTIES[key]?.mod ?? 0;
}

export function difficultyLabel(key) {
  const sys = game.wfrp4e?.config?.difficultyLabels;
  if (sys && key in sys) return game.i18n.localize(sys[key]);
  return game.i18n.localize(FALLBACK_DIFFICULTIES[key]?.label ?? key);
}

const f = () => foundry.data.fields;

/* Модель собирается на init: база - BaseWarhammerItemModel из warhammer-lib
   (глобал появляется после загрузки всех скриптов). Без неё система wfrp4e
   падает на своих предметных методах (getOtherEffects и прочий контракт
   warhammer-lib) - на этом ломается и beavers-crafting. */
export let RecipeModel = null;

export function buildRecipeModel() {
  if (RecipeModel) return RecipeModel;
  const Base = globalThis.warhammer?.models?.BaseWarhammerItemModel ?? foundry.abstract.TypeDataModel;
  RecipeModel = class RecipeModel extends Base {
  static defineSchema() {
    const F = f();
    const base = typeof super.defineSchema === "function" ? super.defineSchema() : {};
    return {
      ...base,
      result: new F.SchemaField({
        uuid: new F.StringField({ initial: "" }),   // предмет-результат (компендиум или мир)
        name: new F.StringField({ initial: "" }),   // имя на случай недоступного uuid
        img: new F.StringField({ initial: "" }),
        count: new F.NumberField({ initial: 1, min: 1, integer: true })
      }),
      skill: new F.StringField({ initial: "" }),     // «Ремесло (Аптекарь)»
      skillAlt: new F.StringField({ initial: "" }),  // альтернативный навык (может быть пусто)
      difficulty: new F.StringField({ initial: "average" }),
      slTarget: new F.NumberField({ initial: 5, min: 1, integer: true }),
      ingredients: new F.ArrayField(new F.SchemaField({
        uuid: new F.StringField({ initial: "" }),
        name: new F.StringField({ initial: "" }),
        img: new F.StringField({ initial: "" }),
        count: new F.NumberField({ initial: 1, min: 1, integer: true })
      })),
      moneyBp: new F.NumberField({ initial: 0, min: 0, integer: true }), // прочее сырьё, в пенни
      needsWorkshop: new F.BooleanField({ initial: false }),
      tools: new F.ArrayField(new F.SchemaField({   // инструменты: нужны, но не расходуются
        uuid: new F.StringField({ initial: "" }),
        name: new F.StringField({ initial: "" }),
        img: new F.StringField({ initial: "" })
      })),
      // Критический успех: если накопленный УУ при завершении >= critSL
      critEnabled: new F.BooleanField({ initial: false }),
      critSL: new F.NumberField({ initial: 8, min: 1, integer: true }),
      // Эффекты складываются (И); critRandom - вместо всех выдать один случайный
      critExtra: new F.BooleanField({ initial: false }),
      critCount: new F.NumberField({ initial: 1, min: 1, integer: true }),
      critUpgrade: new F.BooleanField({ initial: false }),
      critRefund: new F.BooleanField({ initial: false }),
      critRandom: new F.BooleanField({ initial: false }),
      critResult: new F.SchemaField({
        uuid: new F.StringField({ initial: "" }),
        name: new F.StringField({ initial: "" }),
        img: new F.StringField({ initial: "" })
      }),
      timeDays: new F.NumberField({ initial: 0, min: 0, integer: true }),
      timeHours: new F.NumberField({ initial: 0, min: 0, max: 23, integer: true }),
      timeMinutes: new F.NumberField({ initial: 0, min: 0, max: 59, integer: true }),
      // Форма как у предметов системы: миграция wfrp4e читает .value у ЛЮБОГО предмета
      description: new F.SchemaField({ value: new F.HTMLField({ initial: "" }) }),
      gmdescription: new F.SchemaField({ value: new F.HTMLField({ initial: "" }) })
    };
  }
  };
  return RecipeModel;
}
