/* ДЕМО-НАБОР ДЛЯ ЖИВОГО FOUNDRY: «Гномий клинок» с улучшениями + сырьё персонажу.
 *
 * Как запустить (под ГМом):
 *   1. Выбери токен персонажа, которому выдать рецепт и ресурсы (или назначь основного персонажа).
 *   2. F12 -> вкладка Console -> вставь весь этот файл -> Enter.
 *      (Либо: «Макросы» -> новый макрос типа «Скрипт» -> вставить -> запустить.)
 *
 * Что создаст:
 *   - предметы мира: Слиток мифрила, Железный слиток, Гномий клинок (оружие);
 *   - рецепт «Гномий клинок» с двумя улучшениями: «Быстрое» (мифрил) и «Прочный» (железо + деньги);
 *   - персонажу: копию рецепта и сырьё с запасом, чтобы хватило на оба улучшения.
 *
 * Повторный запуск безопасен: предметы с теми же именами переиспользуются.
 */
(async () => {
  const MODULE = "wfrp4e-recipe-book";
  const RECIPE = `${MODULE}.recipe`;
  if (!game.user.isGM) return ui.notifications.error("Демо-набор создаёт предметы мира - нужен ГМ.");
  if (!game.modules.get(MODULE)?.active) return ui.notifications.error("Модуль «Книга рецептов» выключен.");

  const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.error("Выбери токен персонажа или назначь основного персонажа.");

  const ensure = async (data) => game.items.find((i) => i.name === data.name && i.type === data.type)
    ?? await Item.create(data);

  const mithril = await ensure({
    name: "Слиток мифрила", type: "trapping",
    img: "icons/commodities/metal/ingot-engraved-silver.webp",
    system: { trappingType: { value: "misc" }, quantity: { value: 1 }, encumbrance: { value: 1 },
      price: { gc: 2, ss: 0, bp: 0 }, availability: { value: "rare" },
      description: { value: "<p>Светлый, звонкий и непривычно лёгкий слиток. Гномы о таком не распространяются.</p>" } }
  });
  const iron = await ensure({
    name: "Железный слиток", type: "trapping",
    img: "icons/commodities/metal/ingot-stamped-steel.webp",
    system: { trappingType: { value: "misc" }, quantity: { value: 1 }, encumbrance: { value: 1 },
      price: { gc: 0, ss: 2, bp: 0 }, availability: { value: "common" },
      description: { value: "<p>Брусок кричного железа с клеймом плавильни.</p>" } }
  });
  const blade = await ensure({
    name: "Гномий клинок", type: "weapon",
    img: "icons/weapons/swords/sword-guard-engraved-brown.webp",
    system: { quantity: { value: 1 }, encumbrance: { value: 1 },
      price: { gc: 1, ss: 0, bp: 0 }, availability: { value: "scarce" },
      description: { value: "<p>Короткий клинок гномьей ковки: без узоров, зато переживёт хозяина.</p>" } }
  });

  // Навык рецепта: берём ремесло персонажа, иначе кузнеца
  const trade = actor.items.find((i) => i.type === "skill" && /ремесло|trade/i.test(i.name));
  const skill = trade?.name ?? "Ремесло (Кузнец)";

  const recipeData = {
    name: `Рецепт: ${blade.name}`, type: RECIPE,
    img: `modules/${MODULE}/assets/icons/recipe-default.png`,
    system: {
      result: { uuid: blade.uuid, name: blade.name, img: blade.img, count: 1 },
      skill, skillAlt: "", difficulty: "challenging", slTarget: 5,
      ingredients: [{ uuid: iron.uuid, name: iron.name, img: iron.img, count: 1 }],
      moneyBp: 12,
      tools: [], needsWorkshop: true,
      timeDays: 1, timeHours: 0, timeMinutes: 0,
      upgrades: [
        { quality: "fast", name: "Быстрое", slBonus: 5, moneyBp: 0,
          ingredients: [{ uuid: mithril.uuid, name: mithril.name, img: mithril.img, count: 1 }] },
        { quality: "durable", name: "Прочный", slBonus: 5, moneyBp: 24,
          ingredients: [{ uuid: iron.uuid, name: iron.name, img: iron.img, count: 2 }] }
      ],
      critEnabled: true, critSL: 10, critExtra: false, critCount: 1,
      critUpgrade: false, critRefund: true, critRandom: false,
      critQualities: [{ name: "fine", value: 1 }], critQualMode: "and",
      critResult: { uuid: "", name: "", img: "" },
      failFlawed: true, cleanSL: 4, failPool: ["shoddy", "ugly"],
      description: { value: "<p>Ковка по-гномьи: дольше, дороже, зато честно.</p>" },
      gmdescription: { value: "" }
    }
  };
  const worldRecipe = game.items.find((i) => i.name === recipeData.name && i.type === RECIPE)
    ?? await Item.create(recipeData);

  // Персонажу: рецепт и сырьё с запасом на оба улучшения (3 железа + 1 мифрил) + деньги
  const give = [];
  if (!actor.items.find((i) => i.type === RECIPE && i.name === worldRecipe.name)) {
    const copy = worldRecipe.toObject();
    delete copy._id;
    give.push(copy);
  }
  const stock = (doc, count) => {
    const obj = doc.toObject();
    delete obj._id;
    obj.system.quantity = { value: count };
    return obj;
  };
  give.push(stock(iron, 3), stock(mithril, 1));
  if (give.length) await actor.createEmbeddedDocuments("Item", give);

  // Деньги: 1 золотая крона на сырьё и улучшение
  const gc = actor.items.find((i) => i.type === "money" && Number(i.system.coinValue?.value) === 240);
  if (gc) await gc.update({ "system.quantity.value": (Number(gc.system.quantity?.value) || 0) + 1 });

  ui.notifications.info(`Демо-набор готов: «${worldRecipe.name}» и сырьё выданы персонажу ${actor.name}. Открой книгу рецептов (B).`);
  console.log("Книга рецептов | демо-набор:", { recipe: worldRecipe.uuid, blade: blade.uuid, mithril: mithril.uuid, iron: iron.uuid, actor: actor.name });
})();
