/* «Книга рецептов WFRP» - ядро: статус рецептов, запуск крафта, книга (ApplicationV2).
   Принцип как в paperdoll: свой движок правил не пишем. Крафт-проект - системный
   предмет extendedTest, бросок - actor.setupExtendedTest(): диалог, модификаторы,
   таланты и накопление УУ делает система WFRP4e. Мы - интерфейс и логистика. */

import { MODULE_ID, RECIPE_TYPE, difficultyMod, difficultyLabel, FALLBACK_DIFFICULTIES } from "./recipe-model.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const L = (k) => game.i18n.localize(k);
export const F = (k, d) => game.i18n.format(k, d);
export const esc = (s) => foundry.utils.escapeHTML?.(String(s ?? "")) ?? Handlebars.escapeExpression(String(s ?? ""));
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const FLAG = MODULE_ID;

/* ---------- Деньги (та же логика, что в paperdoll) ---------- */

export const COIN_VALUE = { gc: 240, ss: 12, bp: 1 };

function actorCoins(actor) {
  const out = {};
  for (const k of Object.keys(COIN_VALUE))
    out[k] = (actor?.items ?? []).find((i) => i.type === "money" && Number(i.system.coinValue?.value) === COIN_VALUE[k]);
  return out;
}

export function moneyPennies(actor) {
  return (actor?.items ?? [])
    .filter((i) => i.type === "money")
    .reduce((sum, c) => sum + (Number(c.system.quantity?.value) || 0) * (Number(c.system.coinValue?.value) || 1), 0);
}

/** Единые иконки монет для ВСЕГО модуля (книга, ховеры, лист рецепта).
    Приоритет: картинки wfrp4e-core -> картинки с монет-предметов любого актёра -> кружки CSS. */
let _coinImgs = null;
export function coinImgs() {
  if (_coinImgs) return _coinImgs;
  const out = {};
  if (game.modules?.get?.("wfrp4e-core")?.active) {
    out.gc = "modules/wfrp4e-core/icons/currency/goldcrown.png";
    out.ss = "modules/wfrp4e-core/icons/currency/silvershilling.png";
    out.bp = "modules/wfrp4e-core/icons/currency/brasspenny.png";
  }
  for (const a of game.actors?.contents ?? []) {
    if (out.gc && out.ss && out.bp) break;
    const coins = actorCoins(a);
    for (const k of Object.keys(COIN_VALUE)) if (!out[k] && coins[k]?.img) out[k] = coins[k].img;
  }
  _coinImgs = out;
  return out;
}

/** Иконка одного номинала (монета-картинка или запасной кружок) */
export function coinIco(key) {
  const name = esc(L(`WFRPRB.Money.Name.${key}`));
  const img = coinImgs()[key];
  return img
    ? `<img class="rb-coin-img" src="${esc(img)}" alt="${name}">`
    : `<i class="rb-coin-dot rb-coin-dot--${key}"></i>`;
}

/** Пенни -> разметка «N M K» с едиными иконками номиналов */
export function moneyHtml(totalBp) {
  const gc = Math.floor(totalBp / COIN_VALUE.gc);
  const ss = Math.floor((totalBp % COIN_VALUE.gc) / COIN_VALUE.ss);
  const bp = totalBp % COIN_VALUE.ss;
  const part = (n, key) => `<span class="rb-coin" data-rb-tip="${n} ${esc(L(`WFRPRB.Money.Name.${key}`))}">${n}${coinIco(key)}</span>`;
  const parts = [];
  if (gc) parts.push(part(gc, "gc"));
  if (ss) parts.push(part(ss, "ss"));
  if (bp || !totalBp) parts.push(part(bp, "bp"));
  return parts.join(" ");
}

/** Время изготовления: «1д 3ч 15м», показываем только ненулевое */
export function fmtTime(d, h, m) {
  const parts = [];
  if (d) parts.push(`${d}${L("WFRPRB.Time.d")}`);
  if (h) parts.push(`${h}${L("WFRPRB.Time.h")}`);
  if (m) parts.push(`${m}${L("WFRPRB.Time.m")}`);
  return parts.join(" ");
}

/** Названия навыков из базы (мир + компендиумы) - для дропдауна в листе рецепта */
let _skillNames = null;
export async function skillNames() {
  if (_skillNames) return _skillNames;
  const names = new Set();
  for (const item of game.items ?? []) if (item.type === "skill") names.add(item.name);
  for (const pack of game.packs ?? []) {
    if ((pack.documentName ?? pack.metadata?.type) !== "Item") continue;
    const idx = await pack.getIndex().catch(() => []);
    for (const e of idx) if (e.type === "skill") names.add(e.name);
  }
  const isTrade = (n) => /^(ремесло|trade)/i.test(n);
  _skillNames = [...names].sort((a, b) => (isTrade(b) - isTrade(a)) || a.localeCompare(b, "ru"));
  return _skillNames;
}

/** Пенни -> короткий текст «2 зк 8 сш 6 п» (для подсказок) */
export function moneyText(totalBp) {
  const gc = Math.floor(totalBp / COIN_VALUE.gc);
  const ss = Math.floor((totalBp % COIN_VALUE.gc) / COIN_VALUE.ss);
  const bp = totalBp % COIN_VALUE.ss;
  return [gc && `${gc} ${L("WFRPRB.Money.gc")}`, ss && `${ss} ${L("WFRPRB.Money.ss")}`, (bp || !totalBp) && `${bp} ${L("WFRPRB.Money.bp")}`]
    .filter(Boolean).join(" ").toLowerCase();
}

function coinUpdates(actor, deltaBp) {
  const V = COIN_VALUE;
  const coins = actorCoins(actor);
  const missing = Object.keys(V).filter((k) => !coins[k]);
  if (missing.length) return { error: L("WFRPRB.Money.NoCoin") };
  const qty = (k) => Number(coins[k].system.quantity?.value) || 0;
  let total = Object.keys(V).reduce((n, k) => n + qty(k) * V[k], 0) + deltaBp;
  if (total < 0) return { error: L("WFRPRB.Money.NotEnough") };
  const next = { gc: Math.floor(total / V.gc) };
  total -= next.gc * V.gc;
  next.ss = Math.floor(total / V.ss);
  next.bp = total - next.ss * V.ss;
  return { updates: Object.keys(V).filter((k) => next[k] !== qty(k)).map((k) => ({ _id: coins[k].id, "system.quantity.value": next[k] })) };
}

async function changeActorMoney(actor, deltaBp) {
  if (!deltaBp) return true;
  const { updates, error } = coinUpdates(actor, deltaBp);
  if (error) { ui.notifications.warn(error); return false; }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return true;
}

/** Цена предмета в пенни (system.price системы wfrp4e) */
export function priceBp(sys) {
  const p = sys?.price ?? {};
  return (Number(p.gc?.value ?? p.gc) || 0) * COIN_VALUE.gc
    + (Number(p.ss?.value ?? p.ss) || 0) * COIN_VALUE.ss
    + (Number(p.bp?.value ?? p.bp) || 0);
}

/** Доступность предмета - ярлык (из конфига системы или свой) */
export function availLabel(key) {
  if (!key || key === "None") return "";
  const sys = game.wfrp4e?.config?.availability;
  if (sys && key in sys) return game.i18n.localize(sys[key]);
  const own = `WFRPRB.Avail.${key}`;
  const t = L(own);
  return t === own ? key : t;
}

/* ---------- Статус рецепта у персонажа ---------- */

/** Типы, среди которых ищем ингредиенты (всё физическое с количеством) */
function isStock(item) {
  return !["skill", "talent", "extendedTest", "career", "spell", "prayer", "trait", "psychology", "mutation", "disease", "injury", "money"].includes(item.type)
    && item.type !== RECIPE_TYPE
    && item.system?.quantity !== undefined;
}

function stockOf(actor, name) {
  const n = norm(name);
  let have = 0;
  const items = [];
  for (const it of actor?.items ?? []) {
    if (!isStock(it) || norm(it.name) !== n) continue;
    have += Number(it.system.quantity?.value) || 0;
    items.push(it);
  }
  return { have, items };
}

function findSkill(actor, name) {
  if (!name) return null;
  const n = norm(name);
  return (actor?.items ?? []).find((i) => i.type === "skill" && norm(i.name) === n) ?? null;
}

/** Талант «Мастер своего дела (ремесло)» (Craftsman): каждый уровень снижает требуемый УУ на 1.
    Талант берётся на конкретное ремесло - учитываем специализацию из скобок, если она указана. */
function craftsmanLevels(actor, skillName) {
  let lv = 0;
  const skill = norm(skillName);
  for (const t of actor?.items ?? []) {
    if (t.type !== "talent") continue;
    const n = norm(t.name);
    const m = /^(?:мастер своего дела|craftsman)\s*(?:\((.+)\))?$/.exec(n);
    if (!m) continue;
    const spec = norm(m[1] ?? "");
    if (spec && skill && spec !== skill && !skill.includes(spec) && !spec.includes(skill)) continue;
    lv += Number(t.system.advances?.value) || 1;
  }
  return lv;
}

/** ГМ-интерфейс показывается, если пользователь ГМ и не включил «вид игрока» */
export function isGMView() {
  return !!game.user.isGM && !game.settings.get(MODULE_ID, "playerView");
}

export function recipeStatus(actor, recipe) {
  const sys = recipe.system ?? {};
  const slBase = Number(sys.slTarget) || 1;
  const skillItem = findSkill(actor, sys.skill) ?? findSkill(actor, sys.skillAlt);
  const skillUsed = skillItem ? skillItem.name : sys.skill;
  const skillTotal = skillItem ? Number(skillItem.system.total?.value) || 0 : 0;
  const mod = difficultyMod(sys.difficulty);
  const talent = Math.min(craftsmanLevels(actor, skillUsed), Math.max(slBase - 1, 0));
  const slTarget = Math.max(slBase - talent, 1);
  const ingredients = (sys.ingredients ?? []).map((ing) => {
    const { have } = stockOf(actor, ing.name);
    return { ...ing, have, ok: have >= ing.count };
  });
  const tools = (sys.tools ?? []).map((t) => {
    const { have } = stockOf(actor, t.name);
    return { ...t, have, ok: have > 0 };
  });
  const haveBp = moneyPennies(actor);
  const moneyOk = haveBp >= (sys.moneyBp || 0);
  const countMoney = game.settings.get(MODULE_ID, "highlightMoney");
  const missing = [];
  if (!skillItem) missing.push("skill");
  if (ingredients.some((i) => !i.ok)) missing.push("ingredients");
  if (tools.some((t) => !t.ok)) missing.push("tools");
  if (!moneyOk) missing.push("money");
  const base = !!skillItem && ingredients.every((i) => i.ok) && tools.every((t) => t.ok);
  return {
    skillItem, skillUsed, skillTotal, mod, target: skillTotal + mod,
    slTarget, talent, ingredients, tools, moneyOk, haveBp, missing,
    ready: base && (moneyOk || !countMoney),
    canStart: base && moneyOk
  };
}

/* ---------- Запуск, завершение и провал крафта ---------- */

export async function startCraft(actor, recipe) {
  const st = recipeStatus(actor, recipe);
  if (!st.canStart) {
    const what = st.missing.map((m) => L(`WFRPRB.Missing.${m}`)).join(", ");
    return ui.notifications.warn(F("WFRPRB.Craft.CantStart", { what }));
  }
  const sys = recipe.system;

  // Списываем ингредиенты (запоминаем, что потратили - для возврата при провале)
  const spent = [];
  const updates = [];
  const deletes = [];
  for (const ing of st.ingredients) {
    let left = ing.count;
    const { items } = stockOf(actor, ing.name);
    for (const it of items) {
      if (left <= 0) break;
      const q = Number(it.system.quantity?.value) || 0;
      const take = Math.min(q, left);
      left -= take;
      spent.push({ name: it.name, img: it.img, uuid: ing.uuid, count: take, type: it.type, source: it.toObject() });
      if (take >= q) deletes.push(it.id);
      else updates.push({ _id: it.id, "system.quantity.value": q - take });
    }
  }
  if (!(await changeActorMoney(actor, -(sys.moneyBp || 0)))) return;
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  if (deletes.length) await actor.deleteEmbeddedDocuments("Item", deletes);

  // Крафт-проект = системная продолжительная проверка
  const spentLite = spent.map(({ name, img, count, source }) => ({
    name, img, count,
    source: { name: source.name, type: source.type, img: source.img, system: { quantity: { value: 1 } } }
  }));
  const [test] = await actor.createEmbeddedDocuments("Item", [{
    name: F("WFRPRB.Craft.TestName", { name: sys.result.name || recipe.name }),
    type: "extendedTest",
    img: recipe.img,
    system: {
      SL: { current: 0, target: st.slTarget },
      test: { value: st.skillUsed },
      difficulty: { value: sys.difficulty },
      failingDecreases: { value: true },
      negativePossible: { value: true },
      completion: { value: "none" }
    },
    flags: {
      [FLAG]: {
        recipeUuid: recipe.uuid, recipeName: recipe.name,
        result: { uuid: sys.result.uuid, name: sys.result.name, img: sys.result.img || recipe.img, count: sys.result.count, descr: sys.description ?? "" },
        moneyBp: sys.moneyBp || 0,
        spent: spentLite
      }
    }
  }]);
  await rollCraft(actor, test);
  return test;
}

export async function rollCraft(actor, test) {
  if (typeof actor.setupExtendedTest === "function") {
    const t = await actor.setupExtendedTest(test, {});
    if (t && typeof t.roll === "function" && !t.context?.rolled) await t.roll().catch(() => null);
  } else ui.notifications.error(L("WFRPRB.Craft.NoSystem"));
}

function chatCard(actor, { icon, title, lines, img }) {
  const rows = (lines ?? []).map((l) => `<div class="rb-card-line">${l}</div>`).join("");
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) ?? { alias: actor.name },
    content: `<div class="rb-chat-card"><img src="${esc(img)}" alt=""><div><div class="rb-card-title">${icon} ${esc(title)}</div>${rows}</div></div>`
  });
}

async function finishCraft(actor, test) {
  const data = test.getFlag(FLAG, "result");
  let obj = null;
  const src = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
  if (src) {
    obj = src.toObject();
    delete obj._id;
  } else {
    obj = {
      name: data.name || test.name, type: "trapping", img: data.img,
      system: { trappingType: { value: "misc" }, quantity: { value: 1 }, description: { value: data.descr ?? "" } }
    };
  }
  if (obj.system?.quantity) obj.system.quantity.value = data.count || 1;
  await actor.createEmbeddedDocuments("Item", [obj]);
  chatCard(actor, {
    icon: "✓", img: data.img || obj.img,
    title: F("WFRPRB.Chat.Done", { name: data.name || obj.name, count: data.count || 1 }),
    lines: [esc(test.getFlag(FLAG, "recipeName") ?? "")]
  });
  await test.delete();
  RecipeBookApp.renderAll();
}

async function failCraft(actor, test) {
  const mode = game.settings.get(MODULE_ID, "failLoss"); // none | half | all
  const spent = test.getFlag(FLAG, "spent") ?? [];
  const moneyBp = test.getFlag(FLAG, "moneyBp") || 0;
  const back = [];
  let backBp = 0;
  if (mode === "none") {
    backBp = moneyBp;
    for (const s of spent) back.push({ ...s.source, system: { ...s.source.system, quantity: { value: s.count } } });
  } else if (mode === "half") {
    backBp = Math.floor(moneyBp / 2);
    for (const s of spent) {
      const half = Math.floor(s.count / 2);
      if (half > 0) back.push({ ...s.source, system: { ...s.source.system, quantity: { value: half } } });
    }
  }
  if (back.length) await actor.createEmbeddedDocuments("Item", back);
  if (backBp) await changeActorMoney(actor, backBp);
  const data = test.getFlag(FLAG, "result");
  chatCard(actor, {
    icon: "✗", img: data?.img || test.img,
    title: F("WFRPRB.Chat.Failed", { name: data?.name || test.name }),
    lines: [esc(L(`WFRPRB.Chat.Loss.${mode}`))]
  });
  await test.delete();
  RecipeBookApp.renderAll();
}

/** Следим за системными extendedTest с нашим флагом: цель достигнута - предмет, ниже нуля - провал */
export function watchCrafting() {
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (userId && userId !== game.user.id) return;
    if (item.type !== "extendedTest" || !item.actor || !item.getFlag(FLAG, "result")) return;
    const cur = Number(item.system.SL?.current) || 0;
    const target = Number(item.system.SL?.target) || 0;
    if (target > 0 && cur >= target) finishCraft(item.actor, item);
    else if (cur < 0) failCraft(item.actor, item);
    else RecipeBookApp.renderAll();
  });
  for (const hook of ["createItem", "deleteItem"]) {
    Hooks.on(hook, (item) => {
      if (item?.actor && (item.type === RECIPE_TYPE || item.type === "extendedTest" || isStock(item))) RecipeBookApp.renderAll();
    });
  }
}

/** Индекс физических предметов базы (мир + компендиумы) - для поиска в листе рецепта.
    Кэш на сессию: { name, img, uuid, type }. */
let _itemIndex = null;
export async function itemIndex() {
  if (_itemIndex) return _itemIndex;
  const SKIP = new Set(["skill", "talent", "career", "careerPath", "spell", "prayer", "trait", "psychology",
    "mutation", "disease", "injury", "critical", "extendedTest", "money", "template", "cargo", "vehicleMod", "vehicleRole", "vehicleTest", RECIPE_TYPE]);
  const out = [];
  for (const it of game.items ?? []) if (!SKIP.has(it.type)) out.push({ name: it.name, img: it.img, uuid: it.uuid, type: it.type });
  for (const pack of game.packs ?? []) {
    if ((pack.documentName ?? pack.metadata?.type) !== "Item") continue;
    const idx = await pack.getIndex().catch(() => []);
    for (const e of idx) {
      if (SKIP.has(e.type)) continue;
      out.push({ name: e.name, img: e.img, uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`, type: e.type });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  _itemIndex = out;
  return out;
}

/* ---------- Свой тултип (порт PaperdollTooltip из wfrp4e-paperdoll) ----------
   Системный тултип Foundry (data-tooltip) НЕ используем - он накладывается на наш.
   Короткие подсказки живут в атрибуте data-rb-tip (аналог data-pd-tip). */

export class RBTooltip {
  static el = null;
  static mode = null;

  static ensure() {
    if (this.el?.isConnected) return this.el;
    this.el = document.createElement("div");
    this.el.id = "rb-tooltip";
    document.body.append(this.el);
    return this.el;
  }

  static showHtml(html, event, mode = "rich") {
    const el = this.ensure();
    this.mode = mode;
    const dark = game.settings.get(MODULE_ID, "bookTheme") === "dark" ? "rb-theme-dark" : "";
    el.className = `wfrp-recipe-book rb-tooltip ${dark} ${mode === "tip" ? "is-tip" : ""}`;
    el.innerHTML = html;
    el.classList.add("is-visible");
    this.move(event);
  }

  /** Низ экрана занят панелью Foundry (хотбар) - подсказка раскрывается вверх, не накрывая её */
  static bottomLimit() {
    const hotbar = document.getElementById("hotbar");
    return hotbar ? hotbar.getBoundingClientRect().top : window.innerHeight;
  }

  static move(event) {
    const el = this.el;
    if (!el?.classList.contains("is-visible")) return;
    const pad = 16;
    const { innerWidth: vw } = window;
    const rect = el.getBoundingClientRect();
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + rect.width > vw - 8) x = event.clientX - rect.width - pad;
    const bottomLimit = RBTooltip.bottomLimit() - 8;
    if (y + rect.height > bottomLimit) {
      const above = event.clientY - rect.height - pad;
      y = above >= 8 ? above : Math.max(8, bottomLimit - rect.height);
    }
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${y}px`;
  }

  static hide() {
    this.el?.classList.remove("is-visible");
    this.mode = null;
  }

  /** Деньги в тексте подсказки («2 зк 8 сш 6 мп») показываем теми же иконками монет */
  static moneyChips(escaped) {
    const KEY = { "зк": "gc", "сш": "ss", "мп": "bp", "gc": "gc", "ss": "ss", "bp": "bp" };
    return String(escaped).replace(/(\d+)\s*(зк|сш|мп|gc|ss|bp)(?!\p{L})/giu,
      (m, n, cur) => `<span class="rb-coin">${n}${coinIco(KEY[cur.toLowerCase()])}</span>`);
  }

  /** Короткая подсказка: первая строка - заголовок; «текст<TAB>значение» - значение справа;
      «## » - раздел, «! » - предупреждение, «~ » - сноска, «· » - пункт списка */
  static tipHtml(text) {
    const lines = String(text ?? "").split("\n").filter((l) => l.trim());
    if (!lines.length) return "";
    const [head, ...rest] = lines;
    const cell = (l) => {
      const [a, b] = l.split("\t");
      return b === undefined ? esc(a.trim()) : `<span>${esc(a.trim())}</span><b>${RBTooltip.moneyChips(esc(b.trim()))}</b>`;
    };
    const body = rest.map((l) => {
      if (l.startsWith("## ")) return `<div class="rb-tip-section">${esc(l.slice(3))}</div>`;
      if (l.startsWith("! ")) return `<div class="rb-tip-line is-warn ${l.includes("\t") ? "is-kv" : ""}">${cell(l.slice(2))}</div>`;
      if (l.startsWith("~ ")) return `<div class="rb-tip-note">${esc(l.slice(2))}</div>`;
      const sub = /^\s{2,}|^[·✓-]\s/.test(l);
      const t = sub ? l.replace(/^\s*[·✓-]?\s*/, "") : l;
      return `<div class="rb-tip-line ${sub ? "is-sub" : ""} ${l.includes("\t") ? "is-kv" : ""}">${sub ? '<i class="rb-tip-dot"></i>' : ""}${cell(t)}</div>`;
    }).join("");
    return `<div class="rb-tip-head ${head.includes("\t") ? "is-kv" : ""}">${cell(head)}</div>${body}`;
  }

  /** Один общий обработчик на документ: подсказки у всего с data-rb-tip в окнах модуля */
  static adoptTips() {
    if (this._tipsBound) return;
    this._tipsBound = true;
    let timer = null;
    let current = null;
    const inScope = (el) => el?.closest?.(".wfrp-recipe-book");
    document.addEventListener("pointerover", (ev) => {
      const t = ev.target?.closest?.("[data-rb-tip]");
      if (!t || !inScope(t) || t === current) return;
      current = t;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (current !== t || !t.isConnected) return;
        this.showHtml(this.tipHtml(t.dataset.rbTip), ev, "tip");
      }, 250);
    });
    document.addEventListener("pointerout", (ev) => {
      if (!current) return;
      if (ev.relatedTarget && current.contains(ev.relatedTarget)) return;
      if (ev.target?.closest?.("[data-rb-tip]") !== current) return;
      current = null;
      clearTimeout(timer);
      if (this.mode === "tip") this.hide();
    });
    document.addEventListener("pointermove", (ev) => {
      if (this.mode === "tip") this.move(ev);
    });
  }
}

/* ---------- Книга ---------- */

export class RecipeBookApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instances = new Map();

  static DEFAULT_OPTIONS = {
    classes: ["wfrp-recipe-book"],
    window: { title: "WFRPRB.Title", resizable: true },
    position: { width: 940, height: 640 },
    actions: {
      select: RecipeBookApp.#onSelect,
      craft: RecipeBookApp.#onCraft,
      continueTest: RecipeBookApp.#onContinue,
      abandon: RecipeBookApp.#onAbandon,
      filter: RecipeBookApp.#onFilter,
      openResult: RecipeBookApp.#onOpenResult,
      openRecipe: RecipeBookApp.#onOpenRecipe,
      createRecipe: RecipeBookApp.#onCreateRecipe,
      giveRecipe: RecipeBookApp.#onGiveRecipe,
      deleteRecipe: RecipeBookApp.#onDeleteRecipe
    }
  };

  static PARTS = { book: { template: `modules/${MODULE_ID}/templates/book.hbs` } };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.filter = "all";
    this.search = "";
    this.selected = null; // {kind:"recipe"|"project", id}
  }

  get title() {
    return `${L("WFRPRB.Title")} - ${this.actor?.name ?? ""}`;
  }

  /** Рендеры из хуков и из кнопок могут гоняться - выполняем их строго по очереди */
  render(...args) {
    this._renderQueue = (this._renderQueue ?? Promise.resolve())
      .then(() => super.render(...args))
      .catch((err) => console.warn(`${MODULE_ID} | render`, err));
    return this._renderQueue;
  }

  static openFor(actor) {
    if (!actor) return;
    let app = this.instances.get(actor.uuid);
    if (!app) {
      app = new RecipeBookApp(actor, { id: `rb-book-${actor.id}` });
      this.instances.set(actor.uuid, app);
    }
    app.render(true);
    return app;
  }

  static renderAll() {
    for (const app of this.instances.values()) if (app.rendered) app.render();
  }

  async close(options) {
    RecipeBookApp.instances.delete(this.actor?.uuid);
    RBTooltip.hide();
    return super.close(options);
  }

  recipes() {
    return (this.actor?.items ?? []).filter((i) => i.type === RECIPE_TYPE);
  }

  /** Рецепты мира (вкладка «Мир», только ГМ) */
  worldRecipes() {
    return (game.items ?? []).filter((i) => i.type === RECIPE_TYPE);
  }

  /** Рецепт по выбору: с актёра или из мира */
  selectedRecipe() {
    const sel = this.selected;
    if (sel?.kind === "recipe") return this.actor.items.get(sel.id);
    if (sel?.kind === "wrecipe") return (game.items ?? []).find?.((i) => i.id === sel.id) ?? game.items?.get?.(sel.id);
    return null;
  }

  projects() {
    return (this.actor?.items ?? []).filter((i) => i.type === "extendedTest" && i.getFlag(FLAG, "result"));
  }

  /** Данные для богатого ховера по предмету: картинка, цена, доступность, описание */
  async _itemTip(name, uuid, fallbackImg) {
    const own = stockOf(this.actor, name).items[0];
    const doc = own ?? (uuid ? await fromUuid(uuid).catch(() => null) : null);
    const sys = doc?.system ?? {};
    const bp = priceBp(sys);
    return {
      img: doc?.img || fallbackImg || "",
      name: doc?.name ?? name,
      priceHtml: bp ? moneyHtml(bp) : "",
      avail: availLabel(sys.availability?.value),
      desc: sys.description?.value ?? ""
    };
  }

  async _prepareContext() {
    const dark = game.settings.get(MODULE_ID, "bookTheme") === "dark";
    const gm = isGMView();
    if (this.filter === "world" && !gm) this.filter = "all";
    const world = this.filter === "world";
    const q = norm(this.search);
    const projects = this.projects().map((t) => {
      const target = Number(t.system.SL?.target) || 1;
      const cur = Math.max(Number(t.system.SL?.current) || 0, 0);
      const res = t.getFlag(FLAG, "result");
      return {
        id: t.id, img: res?.img || t.img, name: res?.name || t.name, count: res?.count || 1,
        cur: Number(t.system.SL?.current) || 0, target,
        pct: Math.min(Math.round((cur / target) * 100), 100),
        skill: t.system.test?.value ?? ""
      };
    });

    let entries = (world ? this.worldRecipes() : this.recipes()).map((r) => {
      const st = recipeStatus(this.actor, r);
      const missing = st.missing.map((m) => L(`WFRPRB.Missing.${m}`)).join(", ");
      const res = r.system.result ?? {};
      return {
        // В списке - иконка ПРЕДМЕТА-РЕЗУЛЬТАТА (что получится); иконка рецепта - запасная
        id: r.id, name: r.name, img: res.img || r.img,
        resultName: res.name || r.name, count: res.count ?? 1,
        skill: st.skillUsed || "?", ready: st.ready, missing,
        tooltip: st.ready ? L("WFRPRB.Tip.EntryReady") : F("WFRPRB.Tip.EntryMissing", { what: missing })
      };
    });
    for (const e of entries) e.kind = world ? "wrecipe" : "recipe";
    if (q) entries = entries.filter((e) => norm(e.name).includes(q) || norm(e.resultName).includes(q) || norm(e.skill).includes(q));
    if (this.filter === "ready") entries = entries.filter((e) => e.ready);
    if (this.filter === "missing") entries = entries.filter((e) => !e.ready);
    entries.sort((a, b) => a.skill.localeCompare(b.skill, "ru") || a.name.localeCompare(b.name, "ru"));
    const groups = [];
    for (const e of entries) {
      let g = groups.at(-1);
      if (!g || g.skill !== e.skill) { g = { skill: e.skill, entries: [] }; groups.push(g); }
      g.entries.push(e);
    }

    // Выбранное: по умолчанию первый рецепт
    let detail = null;
    let sel = this.selected;
    if (sel?.kind === "project" && !projects.find((p) => p.id === sel.id)) sel = null;
    if (sel?.kind === "recipe" && !this.recipes().find((r) => r.id === sel.id)) sel = null;
    if (sel?.kind === "wrecipe" && !this.worldRecipes().find((r) => r.id === sel.id)) sel = null;
    if (!sel && entries.length) sel = { kind: entries[0].kind, id: entries[0].id };
    if (!sel && projects.length) sel = { kind: "project", id: projects[0].id };
    this.selected = sel;

    if (sel?.kind === "recipe" || sel?.kind === "wrecipe") {
      const r = sel.kind === "wrecipe"
        ? this.worldRecipes().find((x) => x.id === sel.id)
        : this.recipes().find((x) => x.id === sel.id);
      if (r) {
        const st = recipeStatus(this.actor, r);
        const res = r.system.result ?? {};
        const dd = Number(r.system.timeDays) || 0;
        const hh = Number(r.system.timeHours) || 0;
        const mm = Number(r.system.timeMinutes) || 0;
        detail = {
          kind: "recipe", world: sel.kind === "wrecipe", id: r.id, name: r.name, img: r.img, isGM: gm,
          result: {
            ...res, name: res.name || r.name, img: res.img || r.img, count: res.count ?? 1,
            tt: await this._itemTip(res.name || r.name, res.uuid, res.img || r.img)
          },
          ingredients: await Promise.all(st.ingredients.map(async (ing) => ({
            ...ing,
            tooltip: F("WFRPRB.Tip.Ingredient", { have: ing.have, need: ing.count }),
            tt: await this._itemTip(ing.name, ing.uuid, ing.img)
          }))),
          moneyBp: r.system.moneyBp, moneyHtml: moneyHtml(r.system.moneyBp || 0), moneyOk: st.moneyOk,
          moneyTip: (() => {
            const cost = r.system.moneyBp || 0;
            const left = st.haveBp - cost;
            return [
              F("WFRPRB.Tip.Money", { have: moneyText(st.haveBp), need: moneyText(cost) }),
              left >= 0
                ? F("WFRPRB.Tip.MoneyLeft", { left: moneyText(left) })
                : "! " + F("WFRPRB.Tip.MoneyShort", { short: moneyText(-left) }),
              L("WFRPRB.Tip.MoneyNote")
            ].join("\n");
          })(),
          time: fmtTime(dd, hh, mm),
          skillUsed: st.skillUsed, hasSkill: !!st.skillItem, skillTotal: st.skillTotal,
          skillAlt: r.system.skillAlt,
          diffLabel: (() => {
            const lbl = difficultyLabel(r.system.difficulty);
            const mod = st.mod >= 0 ? `+${st.mod}` : `−${Math.abs(st.mod)}`;
            return lbl.includes("(") ? lbl : `${lbl} (${mod})`;
          })(),
          target: st.target, slTarget: st.slTarget, slBase: r.system.slTarget, talent: st.talent,
          checkTip: st.skillItem
            ? F("WFRPRB.Tip.Check", { skill: st.skillUsed, total: st.skillTotal, mod: st.mod >= 0 ? `+${st.mod}` : st.mod, target: st.target })
            : F("WFRPRB.Tip.NoSkill", { skill: st.skillUsed }),
          slTip: F("WFRPRB.Tip.SL", { target: st.slTarget }) + (st.talent ? "\n· " + L("WFRPRB.Tip.Talent") : ""),
          needsWorkshop: r.system.needsWorkshop,
          tools: await Promise.all(st.tools.map(async (t) => ({
            ...t,
            tt: await this._itemTip(t.name, t.uuid, t.img)
          }))),
          description: r.system.description,
          canStart: st.canStart,
          problems: st.missing.map((m) => L(`WFRPRB.Missing.${m}`))
        };
      }
    } else if (sel?.kind === "project") {
      detail = { kind: "project", ...projects.find((p) => p.id === sel.id) };
    }

    const counts = {
      all: this.recipes().length,
      ready: this.recipes().filter((r) => recipeStatus(this.actor, r).ready).length,
      work: projects.length,
      world: this.worldRecipes().length
    };

    return {
      actor: { name: this.actor?.name ?? "", img: this.actor?.img ?? "" },
      gm,
      world,
      dark, groups, projects, detail, search: this.search,
      filter: this.filter, counts,
      empty: !this.recipes().length && !projects.length
    };
  }

  _bindTooltips(root) {
    for (const row of root.querySelectorAll("[data-rbtt]")) {
      const src = row.querySelector(".rb-tt-src");
      if (!src) continue;
      row.addEventListener("pointerenter", (ev) => RBTooltip.showHtml(src.innerHTML, ev, "rich"));
      row.addEventListener("pointermove", (ev) => RBTooltip.move(ev));
      row.addEventListener("pointerleave", () => RBTooltip.hide());
    }
  }

  _onRender() {
    const root = this.element;
    root.classList.toggle("rb-theme-dark", game.settings.get(MODULE_ID, "bookTheme") === "dark");
    RBTooltip.hide();
    RBTooltip.adoptTips();
    this._bindTooltips(root);
    const input = root.querySelector(".rb-search input");
    if (input) {
      input.addEventListener("input", (ev) => {
        this.search = ev.currentTarget.value;
        clearTimeout(this._searchT);
        this._searchT = setTimeout(() => this.render(), 150);
      });
      if (this.search) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }

  static #onSelect(event, target) {
    this.selected = { kind: target.dataset.kind, id: target.dataset.id };
    this.render();
  }

  static async #onCraft() {
    if (this.selected?.kind !== "recipe") return;
    const recipe = this.actor.items.get(this.selected.id);
    if (!recipe) return;
    const test = await startCraft(this.actor, recipe);
    if (test) { this.selected = { kind: "project", id: test.id }; this.render(); }
  }

  static async #onContinue(event, target) {
    const test = this.actor.items.get(target.dataset.id);
    if (test) await rollCraft(this.actor, test);
  }

  static async #onAbandon(event, target) {
    const test = this.actor.items.get(target.dataset.id);
    if (!test) return;
    const yes = await foundry.applications.api.DialogV2.confirm({
      window: { title: L("WFRPRB.Abandon.Title") },
      content: `<p>${L("WFRPRB.Abandon.Hint")}</p>`
    }).catch(() => false);
    if (yes) { await test.delete(); this.render(); }
  }

  static #onFilter(event, target) {
    this.filter = target.dataset.filter;
    this.render();
  }

  static async #onOpenResult(event, target) {
    const doc = target.dataset.uuid ? await fromUuid(target.dataset.uuid).catch(() => null) : null;
    doc?.sheet?.render(true);
  }

  static #onOpenRecipe(event, target) {
    this.selectedRecipe()?.sheet?.render(true);
  }

  /** ГМ: выдать рецепт мира - открывает выбор персонажа-получателя */
  static async #onGiveRecipe(event, target) {
    const r = this.selectedRecipe();
    if (!r) return;
    const old = this.element.querySelector(".rb-give-picker");
    if (old) return old.remove();
    const actors = (game.actors?.contents ?? [])
      .filter((a) => ["character", "npc"].includes(a.type))
      .slice(0, 20);
    const panel = document.createElement("div");
    panel.className = "rb-picker rb-give-picker";
    panel.innerHTML = `<div class="rb-picker-list">` + actors.map((a, i) =>
      `<button type="button" class="rb-picker-row" data-idx="${i}">
         <img src="${esc(a.img ?? "")}" alt="">${esc(a.name)}${a.id === this.actor.id ? ` <span class="rb-dim">(${esc(L("WFRPRB.World.ThisBook"))})</span>` : ""}
       </button>`).join("") + `</div>`;
    target.closest(".rb-foot").before(panel);
    panel.querySelectorAll(".rb-picker-row").forEach((row, i) =>
      row.addEventListener("click", () => { panel.remove(); this.#giveTo(actors[i], r); }));
  }

  async #giveTo(actor, recipe) {
    const obj = recipe.toObject();
    delete obj._id;
    const [made] = await actor.createEmbeddedDocuments("Item", [obj]);
    ui.notifications.info(F("WFRPRB.World.Given", { name: recipe.name, actor: actor.name }));
    if (actor.id === this.actor.id) {
      this.filter = "all";
      this.selected = { kind: "recipe", id: made.id };
    }
    this.render();
  }

  /** ГМ: удалить рецепт - из книги персонажа или насовсем из мира */
  static async #onDeleteRecipe(event, target) {
    const r = this.selectedRecipe();
    if (!r) return;
    const world = this.selected?.kind === "wrecipe";
    const yes = await foundry.applications.api.DialogV2.confirm({
      window: { title: L(world ? "WFRPRB.Delete.WorldTitle" : "WFRPRB.Delete.ActorTitle") },
      content: `<p>${F(world ? "WFRPRB.Delete.WorldHint" : "WFRPRB.Delete.ActorHint", { name: esc(r.name) })}</p>`
    }).catch(() => false);
    if (!yes) return;
    await r.delete();
    this.selected = null;
    this.render();
  }

  /** ГМ: новый рецепт - предмет мира (вкладка «Предметы»), сразу открываем лист */
  static async #onCreateRecipe() {
    const item = await Item.create({
      name: L("WFRPRB.NewRecipe"),
      type: RECIPE_TYPE,
      img: `modules/${MODULE_ID}/assets/icons/recipe-default.png`
    });
    if (!item) return;
    this.filter = "world";
    this.selected = { kind: "wrecipe", id: item.id };
    this.render();
    item.sheet?.render(true);
  }
}
