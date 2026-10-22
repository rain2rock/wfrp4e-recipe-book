/* «Книга рецептов WFRP» - init: модель, лист, настройки, клавиша, кнопка на листе, api. */

import { MODULE_ID, RECIPE_TYPE, buildRecipeModel } from "./recipe-model.js";
import { RecipeBookApp, watchCrafting, startCraft, rollCraft, recipeStatus, loadLangs, L } from "./recipe-book.js";
import { RecipeSheet } from "./recipe-sheet.js";

const SUPPORTED_TYPES = ["character", "npc", "creature"];

Hooks.once("init", () => {
  // Хелперы шаблонов: в ядре Foundry их может не быть
  if (!Handlebars.helpers.eq) Handlebars.registerHelper("eq", (a, b) => a === b);
  if (!Handlebars.helpers.gt) Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
  if (!Handlebars.helpers.or) Handlebars.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
  // Локализация шаблонов модуля - через свой L (учитывает настройку «Язык модуля»)
  Handlebars.registerHelper("rbL", (k) => L(k));

  // Данные и лист подтипа «Рецепт»
  Object.assign(CONFIG.Item.dataModels, { [RECIPE_TYPE]: buildRecipeModel() });
  const DSC = foundry.applications?.apps?.DocumentSheetConfig ?? DocumentSheetConfig;
  DSC.registerSheet(Item, MODULE_ID, RecipeSheet, {
    types: [RECIPE_TYPE],
    makeDefault: true,
    label: "WFRPRB.Sheet.Label"
  });

  // Главный выключатель (мир)
  game.settings.register(MODULE_ID, "enabled", {
    name: "WFRPRB.Settings.Enabled.Name",
    hint: "WFRPRB.Settings.Enabled.Hint",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: (on) => { if (!on) for (const app of [...RecipeBookApp.instances.values()]) app.close(); }
  });

  // Подсветка «могу сделать»: учитывать ли деньги (мир)
  game.settings.register(MODULE_ID, "highlightMoney", {
    name: "WFRPRB.Settings.HighlightMoney.Name",
    hint: "WFRPRB.Settings.HighlightMoney.Hint",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => RecipeBookApp.renderAll()
  });

  // Потери при провале (мир)
  game.settings.register(MODULE_ID, "failLoss", {
    name: "WFRPRB.Settings.FailLoss.Name",
    hint: "WFRPRB.Settings.FailLoss.Hint",
    scope: "world", config: true, type: String,
    choices: {
      none: "WFRPRB.Settings.FailLoss.none",
      half: "WFRPRB.Settings.FailLoss.half",
      all: "WFRPRB.Settings.FailLoss.all"
    },
    default: "half"
  });

  // Язык модуля: как в Foundry, либо принудительно русский / английский
  game.settings.register(MODULE_ID, "lang", {
    name: "Module language / Язык модуля",
    hint: "Interface language of the Recipe Book / Язык интерфейса книги рецептов.",
    scope: "client", config: true, type: String,
    choices: { auto: "Foundry", ru: "Русский", en: "English" },
    default: "auto",
    onChange: () => RecipeBookApp.renderAll()
  });
  loadLangs();

  // ГМ: смотреть интерфейс как обычный игрок (без вкладки «Мир» и ГМ-кнопок)
  game.settings.register(MODULE_ID, "playerView", {
    name: "WFRPRB.Settings.PlayerView.Name",
    hint: "WFRPRB.Settings.PlayerView.Hint",
    scope: "client", config: true, type: Boolean, default: false,
    onChange: () => RecipeBookApp.renderAll()
  });

  // Тема книги (у каждого игрока своя)
  game.settings.register(MODULE_ID, "bookTheme", {
    name: "WFRPRB.Settings.BookTheme.Name",
    hint: "WFRPRB.Settings.BookTheme.Hint",
    scope: "client", config: true, type: String,
    choices: { parchment: "WFRPRB.Settings.BookTheme.parchment", dark: "WFRPRB.Settings.BookTheme.dark" },
    default: "parchment",
    onChange: () => RecipeBookApp.renderAll()
  });

  const isEnabled = () => game.settings.get(MODULE_ID, "enabled");

  // Горячая клавиша (по умолчанию B): открыть / закрыть книгу
  game.keybindings?.register(MODULE_ID, "toggle", {
    name: "WFRPRB.Hotkey.Name",
    editable: [{ key: "KeyB" }],
    precedence: CONST.KEYBINDING_PRECEDENCE?.NORMAL,
    onDown: () => {
      if (!isEnabled() || game.system.id !== "wfrp4e") return false;
      const token = canvas?.tokens?.controlled?.find((t) => t.actor?.isOwner);
      const actor = token?.actor ?? game.user.character;
      if (!actor || !SUPPORTED_TYPES.includes(actor.type)) {
        ui.notifications?.info(game.i18n.localize("WFRPRB.Hotkey.NoActor"));
        return true;
      }
      const open = RecipeBookApp.instances.get(actor.uuid);
      if (open?.rendered) open.close();
      else RecipeBookApp.openFor(actor);
      return true;
    }
  });

  // Новый рецепт получает свою картинку-пергамент вместо заглушки Foundry
  Hooks.on("preCreateItem", (item, data) => {
    if (item.type === RECIPE_TYPE && (!data.img || data.img === "icons/svg/item-bag.svg"))
      item.updateSource({ img: `modules/${MODULE_ID}/assets/icons/recipe-default.png` });
  });

  watchCrafting();

  // Доступ из макросов: game.modules.get("wfrp4e-recipe-book").api.open(actor)
  game.modules.get(MODULE_ID).api = { open: (a) => RecipeBookApp.openFor(a), startCraft, rollCraft, recipeStatus, RecipeBookApp };
});

/* Кнопка в шапке листа персонажа (как в paperdoll).
   Основной хук - renderActorSheetV2; запасной renderActorSheet - для листов на ApplicationV1. */
function addSheetButton(app, element) {
  if (game.system.id !== "wfrp4e" || !game.settings.get(MODULE_ID, "enabled")) return;
  const actor = app.document ?? app.actor;
  if (!actor || !SUPPORTED_TYPES.includes(actor.type)) return;
  const header = app.window?.header ?? element.querySelector(".window-header");
  if (!header || header.querySelector(".rb-open")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "header-control icon rb-open";
  btn.innerHTML = `<img src="modules/${MODULE_ID}/assets/ui/ui-sheet-button.png" alt="">`;
  const label = game.i18n.localize("WFRPRB.Open");
  btn.dataset.tooltip = label;
  btn.setAttribute("aria-label", label);
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    RecipeBookApp.openFor(actor);
  });
  btn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  const anchor = header.querySelector('[data-action="toggleControls"]') ?? header.querySelector('[data-action="close"]') ?? header.querySelector(".close");
  if (anchor) header.insertBefore(btn, anchor);
  else header.append(btn);
}
Hooks.on("renderActorSheetV2", (app, element) => addSheetButton(app, element));
Hooks.on("renderActorSheet", (app, html) => addSheetButton(app, html?.[0] ?? html));
