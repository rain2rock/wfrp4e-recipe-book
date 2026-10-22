/* Тестовые данные мока: конфиг системы, персонаж «Хьюго», мировые предметы-результаты. */

export const CONFIG_WFRP = {
  difficultyModifiers: { veryEasy: 60, easy: 40, average: 20, challenging: 0, difficult: -10, hard: -20, veryHard: -30 },
  difficultyLabels: {
    veryEasy: "Элементарная (+60)", easy: "Лёгкая (+40)", average: "Заурядная (+20)",
    challenging: "Серьёзная (+0)", difficult: "Трудная (−10)", hard: "Тяжёлая (−20)", veryHard: "Безумная (−30)"
  }
};

/** Мировые предметы-результаты и ингредиенты (для fromUuid и выдачи результата) */
export const WORLD_ITEMS = [
  { id: "tool-still", name: "Перегонный куб", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/spirits-pint.png", system: { trappingType: { value: "toolsAndKits" }, quantity: { value: 1 }, price: { gc: 1, ss: 0, bp: 0 }, availability: { value: "scarce" }, description: { value: '<p>Медный куб со змеевиком. Гордость любой алхимической мастерской.</p>' } } },
  { id: "res-mandrake", name: "Корень мандрагоры", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/mandrake-root.png", system: { trappingType: { value: "ingredient" }, quantity: { value: 1 }, price: { gc: 0, ss: 2, bp: 6 }, availability: { value: "rare" }, description: { value: '<p>Скрюченный корень, похожий на человечка. Выкапывать советуют в перчатках и молча.</p>' } } },
  { id: "res-heal", name: "Лечебная настойка", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/healing-draught.png", system: { trappingType: { value: "drugsPoisonsHerbsDraughts" }, quantity: { value: 1 }, price: { gc: 0, ss: 1, bp: 0 }, availability: { value: "common" }, description: { value: '<p>Горькая настойка тёмного стекла. Ставит на ноги - если выпить вовремя.</p>' } } },
  { id: "res-calm", name: "Успокоительный отвар", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/vitality-draught.png", system: { trappingType: { value: "drugsPoisonsHerbsDraughts" }, quantity: { value: 1 }, price: { gc: 0, ss: 1, bp: 0 }, availability: { value: "common" }, description: { value: '<p>Сладковатый отвар. Унимает дрожь в руках и дурные сны.</p>' } } },
  { id: "res-anti", name: "Противоядие", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/antitoxin-kit.png", system: { trappingType: { value: "drugsPoisonsHerbsDraughts" }, quantity: { value: 1 }, price: { gc: 0, ss: 10, bp: 0 }, availability: { value: "scarce" }, description: { value: '<p>Мутная жидкость с резким запахом. Против большинства известных ядов.</p>' } } },
  { id: "res-dagger", name: "Кинжал", type: "weapon", img: "modules/wfrp4e-recipe-book/assets/icons/main-gauche.png", system: { quantity: { value: 1 }, price: { gc: 0, ss: 1, bp: 0 }, availability: { value: "common" }, description: { value: '<p>Простой клинок в ладонь длиной. Последний довод в кабацком споре.</p>' } } },
  { id: "res-ration", name: "Дорожный паёк", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/rations-1-day.png", system: { trappingType: { value: "foodAndDrink" }, quantity: { value: 1 }, price: { gc: 0, ss: 0, bp: 12 }, availability: { value: "common" }, description: { value: '<p>Свёрток с сухарями, вяленым мясом и сыром. На день пути хватит.</p>' } } }
];

/** Рецепты на персонаже (type подставит сборка) */
export const RECIPES = [
  {
    name: "Рецепт: Лечебная настойка",
    img: "modules/wfrp4e-recipe-book/assets/icons/recipe-default.png",
    system: {
      result: { uuid: "Item.res-heal", name: "Лечебная настойка", img: "modules/wfrp4e-recipe-book/assets/icons/healing-draught.png", count: 1 },
      skill: "Ремесло (Аптекарь)", skillAlt: "",
      difficulty: "average", slTarget: 5,
      ingredients: [
        { uuid: "", name: "Целебные травы", img: "modules/wfrp4e-recipe-book/assets/icons/salwort.png", count: 2 },
        { uuid: "", name: "Спирт", img: "modules/wfrp4e-recipe-book/assets/icons/spirits-pint.png", count: 1 }
      ],
      moneyBp: 15, needsWorkshop: false,
      tools: [{ uuid: "", name: "Ступка и пестик", img: "modules/wfrp4e-recipe-book/assets/icons/antitoxin-kit.png" }], timeDays: 0, timeHours: 1, timeMinutes: 0,
      description: { value: "<p>Горькая настойка на целебных травах - первая помощь искателя приключений.</p>" }
    }
  },
  {
    name: "Рецепт: Успокоительный отвар",
    img: "modules/wfrp4e-recipe-book/assets/icons/recipe-default.png",
    system: {
      result: { uuid: "Item.res-calm", name: "Успокоительный отвар", img: "modules/wfrp4e-recipe-book/assets/icons/vitality-draught.png", count: 1 },
      skill: "Ремесло (Аптекарь)", skillAlt: "Ремесло (Травник)",
      difficulty: "average", slTarget: 5,
      ingredients: [
        { uuid: "", name: "Сонная трава", img: "modules/wfrp4e-recipe-book/assets/icons/nightshade.png", count: 2 },
        { uuid: "", name: "Мёд", img: "modules/wfrp4e-recipe-book/assets/icons/digestive-tonic.png", count: 1 }
      ],
      moneyBp: 12, needsWorkshop: false, tools: [], timeDays: 0, timeHours: 0, timeMinutes: 30,
      description: { value: "<p>Сладковатый отвар, унимающий дрожь в руках и дурные сны.</p>" }
    }
  },
  {
    name: "Рецепт: Противоядие",
    img: "modules/wfrp4e-recipe-book/assets/icons/recipe-default.png",
    system: {
      result: { uuid: "Item.res-anti", name: "Противоядие", img: "modules/wfrp4e-recipe-book/assets/icons/antitoxin-kit.png", count: 1 },
      skill: "Ремесло (Аптекарь)", skillAlt: "",
      difficulty: "challenging", slTarget: 10,
      ingredients: [
        { uuid: "Item.res-mandrake", name: "Корень мандрагоры", img: "modules/wfrp4e-recipe-book/assets/icons/mandrake-root.png", count: 1 },
        { uuid: "", name: "Целебные травы", img: "modules/wfrp4e-recipe-book/assets/icons/salwort.png", count: 1 }
      ],
      moneyBp: 60, needsWorkshop: true, tools: [{ uuid: "Item.tool-still", name: "Перегонный куб", img: "modules/wfrp4e-recipe-book/assets/icons/spirits-pint.png" }], timeDays: 38, timeHours: 15, timeMinutes: 10,
      description: { value: "<p>Против большинства известных ядов. Против неизвестных - как повезёт.</p>" }
    }
  },
  {
    name: "Рецепт: Кинжал",
    img: "modules/wfrp4e-recipe-book/assets/icons/recipe-default.png",
    system: {
      result: { uuid: "Item.res-dagger", name: "Кинжал", img: "modules/wfrp4e-recipe-book/assets/icons/main-gauche.png", count: 1 },
      skill: "Ремесло (Кузнец)", skillAlt: "",
      difficulty: "challenging", slTarget: 10,
      ingredients: [{ uuid: "", name: "Железный слиток", img: "modules/wfrp4e-recipe-book/assets/icons/rock.png", count: 1 }],
      moneyBp: 6, needsWorkshop: true, tools: [], timeDays: 1, timeHours: 3, timeMinutes: 0,
      description: { value: "<p>Простой клинок - было бы железо да горн.</p>" }
    }
  },
  {
    name: "Рецепт: Дорожный паёк",
    img: "modules/wfrp4e-recipe-book/assets/icons/recipe-default.png",
    system: {
      result: { uuid: "Item.res-ration", name: "Дорожный паёк", img: "modules/wfrp4e-recipe-book/assets/icons/rations-1-day.png", count: 5 },
      skill: "Ремесло (Повар)", skillAlt: "",
      difficulty: "average", slTarget: 5,
      ingredients: [
        { uuid: "", name: "Вяленое мясо", img: "modules/wfrp4e-recipe-book/assets/icons/meal-inn.png", count: 2 },
        { uuid: "", name: "Сухари", img: "modules/wfrp4e-recipe-book/assets/icons/food-groceries-day.png", count: 2 }
      ],
      moneyBp: 10, needsWorkshop: false, tools: [], timeDays: 0, timeHours: 4, timeMinutes: 0,
      description: { value: "<p>Не роскошь, но в дороге не до жиру.</p>" }
    }
  }
];

export const ACTOR = {
  id: "hugo",
  name: "Хьюго",
  type: "character",
  system: { characteristics: { ws: { value: 35 }, dex: { value: 35 }, int: { value: 30 } } },
  items: [
    { id: "sk-apoth", name: "Ремесло (Аптекарь)", type: "skill", system: { characteristic: { value: "dex" }, advances: { value: 10 } } },
    { id: "sk-cook", name: "Ремесло (Повар)", type: "skill", system: { characteristic: { value: "dex" }, advances: { value: 5 } } },
    { id: "tal-master", name: "Мастер своего дела (Ремесло (Аптекарь))", type: "talent", system: { advances: { value: 2 } } },
    { id: "coin-gc", name: "Золотая крона", type: "money", img: "data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#e0b020" stroke="#8a6408" stroke-width="2"/><circle cx="9" cy="9" r="3.5" fill="#fff" opacity=".35"/></svg>'), system: { coinValue: { value: 240 }, quantity: { value: 2 } } },
    { id: "coin-ss", name: "Серебряный шиллинг", type: "money", img: "data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#c8ccd0" stroke="#6e7378" stroke-width="2"/><circle cx="9" cy="9" r="3.5" fill="#fff" opacity=".35"/></svg>'), system: { coinValue: { value: 12 }, quantity: { value: 8 } } },
    { id: "coin-bp", name: "Медное пенни", type: "money", img: "data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#c07a38" stroke="#6a3a12" stroke-width="2"/><circle cx="9" cy="9" r="3.5" fill="#fff" opacity=".35"/></svg>'), system: { coinValue: { value: 1 }, quantity: { value: 6 } } },
    { id: "ing-herbs", name: "Целебные травы", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/salwort.png", system: { trappingType: { value: "ingredient" }, quantity: { value: 3 }, price: { gc: 0, ss: 0, bp: 8 }, availability: { value: "common" }, description: { value: '<p>Пучок сушёных трав с заливных лугов Рейкланда. Пахнет летом и немного - болотом.</p>' } } },
    { id: "ing-spirit", name: "Спирт", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/spirits-pint.png", system: { trappingType: { value: "ingredient" }, quantity: { value: 1 }, price: { gc: 0, ss: 1, bp: 0 }, availability: { value: "common" }, description: { value: '<p>Жгучая прозрачная жидкость. Аптекари настаивают, что это сырьё, а не напиток.</p>' } } },
    { id: "ing-sleep", name: "Сонная трава", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/nightshade.png", system: { trappingType: { value: "ingredient" }, quantity: { value: 2 }, price: { gc: 0, ss: 0, bp: 6 }, availability: { value: "scarce" }, description: { value: '<p>Тёмные листья с горьким запахом. Собирают в сумерках - днём трава «спит».</p>' } } },
    { id: "ing-honey", name: "Мёд", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/digestive-tonic.png", system: { trappingType: { value: "ingredient" }, quantity: { value: 1 }, price: { gc: 0, ss: 0, bp: 4 }, availability: { value: "common" }, description: { value: '<p>Густой мёд из пригородной пасеки. Слегка отдаёт дымом.</p>' } } },
    { id: "ing-iron", name: "Железный слиток", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/rock.png", system: { trappingType: { value: "ingredient" }, quantity: { value: 2 }, price: { gc: 0, ss: 2, bp: 0 }, availability: { value: "common" }, description: { value: '<p>Брусок кричного железа с клеймом нульнской плавильни.</p>' } } },
    { id: "ing-meat", name: "Вяленое мясо", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/meal-inn.png", system: { trappingType: { value: "foodAndDrink" }, quantity: { value: 2 }, price: { gc: 0, ss: 0, bp: 10 }, availability: { value: "common" }, description: { value: '<p>Полоски солёного мяса, твёрдые как подошва. В дороге - деликатес.</p>' } } },
    { id: "tool-mortar", name: "Ступка и пестик", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/antitoxin-kit.png", system: { trappingType: { value: "toolsAndKits" }, quantity: { value: 1 }, price: { gc: 0, ss: 2, bp: 0 }, availability: { value: "common" }, description: { value: '<p>Каменная ступка, перетершая не один фунт трав. Пахнет всеми рецептами сразу.</p>' } } },
    { id: "ing-bread", name: "Сухари", type: "trapping", img: "modules/wfrp4e-recipe-book/assets/icons/food-groceries-day.png", system: { trappingType: { value: "foodAndDrink" }, quantity: { value: 2, price: { gc: 0, ss: 0, bp: 3 }, availability: { value: "common" }, description: { value: '<p>Дважды печёный хлеб. Не портится, но и не прожуёшь без эля.</p>' } } } }
  ]
};

/** Навыки «из базы» для дропдауна в листе рецепта */
export const SKILLS = [
  "Ремесло (Аптекарь)", "Ремесло (Травник)", "Ремесло (Повар)", "Ремесло (Кузнец)",
  "Ремесло (Оружейник)", "Ремесло (Плотник)", "Ремесло (Пивовар)", "Ремесло (Свечник)",
  "Ремесло (Лучник)", "Атлетика", "Выживание", "Лечение"
];

/** Второй персонаж - цель для «выдать рецепт выбранному игроку» */
export const ACTOR2 = {
  id: "gunther",
  name: "Гюнтер",
  type: "character",
  system: { characteristics: { dex: { value: 30 } } },
  items: [
    { id: "g-coin-bp", name: "Медное пенни", type: "money", system: { coinValue: { value: 1 }, quantity: { value: 12 } } }
  ]
};

/** NPC без владельца-игрока - НЕ должен попадать в список выдачи */
export const ACTOR_NPC = {
  id: "rat", name: "Гигантская крыса", type: "npc", hasPlayerOwner: false,
  system: { characteristics: {} }, items: []
};
