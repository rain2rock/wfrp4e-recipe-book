/* «Книга рецептов WFRP» - ядро: статус рецептов, запуск крафта, книга (ApplicationV2).
   Принцип как в paperdoll: свой движок правил не пишем. Крафт-проект - системный
   предмет extendedTest, бросок - actor.setupExtendedTest(): диалог, модификаторы,
   таланты и накопление УУ делает система WFRP4e. Мы - интерфейс и логистика. */

import { MODULE_ID, RECIPE_TYPE, ACTOR_TYPES, difficultyMod, difficultyLabel } from "./recipe-model.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* Переводы модуля: настройка «Язык модуля» может отличаться от языка Foundry.
   Таблицы грузим из lang/*.json сами; ключи вне WFRPRB.* уходят в обычный i18n. */
let RB_LANGS = globalThis.__RB_LANGS__ ?? null;
export async function loadLangs() {
  if (RB_LANGS) return RB_LANGS;
  try {
    const [ru, en] = await Promise.all(["ru", "en"].map((l) =>
      fetch(`modules/${MODULE_ID}/lang/${l}.json`).then((r) => r.json())));
    RB_LANGS = { ru, en };
  } catch { RB_LANGS = null; }
  return RB_LANGS;
}

function rbLang() {
  try {
    const mode = game.settings.get(MODULE_ID, "lang");
    return mode === "auto" ? null : mode;
  } catch { return null; }
}

export const L = (k) => {
  const lang = rbLang();
  if (lang && RB_LANGS?.[lang]) {
    const v = String(k).split(".").reduce((o, p) => (o == null ? undefined : o[p]), RB_LANGS[lang]);
    if (typeof v === "string") return v;
  }
  return game.i18n.localize(k);
};
export const F = (k, d = {}) => L(k).replace(/\{(\w+)\}/g, (_, x) => d[x] ?? "");
export const esc = (s) => foundry.utils.escapeHTML?.(String(s ?? "")) ?? Handlebars.escapeExpression(String(s ?? ""));
/** Сравнение имён предметов по всему модулю: регистр и лишние пробелы не считаются */
export const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/* ---------- Деньги (та же логика, что в paperdoll) ---------- */

export const COIN_VALUE = { gc: 240, ss: 12, bp: 1 };

function actorCoins(actor) {
  const out = {};
  for (const k of Object.keys(COIN_VALUE))
    out[k] = (actor?.items ?? []).find((i) => i.type === "money" && Number(i.system.coinValue?.value) === COIN_VALUE[k]);
  return out;
}

export function moneyPennies(actor, idx = null) {
  if (idx) return idx.pennies;
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

/** Время изготовления: «1мес 8д 15ч 10м», показываем только ненулевое.
    От 30 дней дни сворачиваются в месяцы (месяц = 30 дней). */
export function fmtTime(d, h, m) {
  const mo = Math.floor((d || 0) / 30);
  const dd = (d || 0) % 30;
  const parts = [];
  if (mo) parts.push(`${mo}${L("WFRPRB.Time.mo")}`);
  if (dd) parts.push(`${dd}${L("WFRPRB.Time.d")}`);
  if (h) parts.push(`${h}${L("WFRPRB.Time.h")}`);
  if (m) parts.push(`${m}${L("WFRPRB.Time.m")}`);
  return parts.join(" ");
}

/** Названия навыков из базы (мир + компендиумы) - для дропдауна в листе рецепта */
let _skillNames = null;
export async function skillNames() {
  if (_skillNames) return _skillNames;
  const names = new Set();
  // Мир (включая созданные ГМом), компендиумы И навыки прямо на персонажах -
  // кастомный навык, добавленный только актёру, тоже должен попадать в выбор
  for (const item of game.items ?? []) if (item.type === "skill") names.add(item.name);
  for (const a of game.actors?.contents ?? [])
    for (const item of a.items) if (item.type === "skill") names.add(item.name);
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
  if (error) { ui.notifications?.warn(error); return false; }
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

/** Не предметы в смысле крафта: ни в сырьё, ни в результаты, ни в поиск по базе.
    Один список на книгу и на поиск - иначе груз корабля попадал в ингредиенты. */
const NOT_STOCK = new Set(["skill", "talent", "career", "careerPath", "spell", "prayer", "trait", "psychology",
  "mutation", "disease", "injury", "critical", "extendedTest", "money", "template",
  "cargo", "vehicleMod", "vehicleRole", "vehicleTest", RECIPE_TYPE]);

/** Запас персонажа: всё физическое с количеством */
function isStock(item) {
  return !NOT_STOCK.has(item.type) && item.system?.quantity !== undefined;
}

/** Срез инвентаря для одного прохода: сырьё по имени, навыки, таланты, деньги.
    Собирается один раз на рендер: иначе каждый ингредиент каждого рецепта заново обходит весь инвентарь. */
export function actorIndex(actor) {
  const stock = new Map();
  const skills = new Map();
  const talents = [];
  let pennies = 0;
  for (const it of actor?.items ?? []) {
    if (it.type === "money") {
      pennies += (Number(it.system.quantity?.value) || 0) * (Number(it.system.coinValue?.value) || 1);
      continue;
    }
    const n = norm(it.name);
    if (it.type === "skill") { if (!skills.has(n)) skills.set(n, it); continue; }
    if (it.type === "talent") { talents.push(it); continue; }
    if (!isStock(it)) continue;
    let e = stock.get(n);
    if (!e) stock.set(n, (e = { have: 0, items: [] }));
    e.have += Number(it.system.quantity?.value) || 0;
    e.items.push(it);
  }
  return { stock, skills, talents, pennies };
}

const EMPTY_STOCK = { have: 0, items: [] };

function stockOf(actor, name, idx = null) {
  const n = norm(name);
  if (idx) return idx.stock.get(n) ?? EMPTY_STOCK;
  let have = 0;
  const items = [];
  for (const it of actor?.items ?? []) {
    if (!isStock(it) || norm(it.name) !== n) continue;
    have += Number(it.system.quantity?.value) || 0;
    items.push(it);
  }
  return { have, items };
}

function findSkill(actor, name, idx = null) {
  if (!name) return null;
  const n = norm(name);
  if (idx) return idx.skills.get(n) ?? null;
  return (actor?.items ?? []).find((i) => i.type === "skill" && norm(i.name) === n) ?? null;
}

/** Талант «Мастер своего дела (ремесло)» (Craftsman): каждый уровень снижает требуемый УУ на 1.
    Талант берётся на конкретное ремесло - учитываем специализацию из скобок, если она указана. */
function craftsmanLevels(actor, skillName, idx = null) {
  let lv = 0;
  const skill = norm(skillName);
  for (const t of idx ? idx.talents : actor?.items ?? []) {
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

/** Тёмная тема книги (спрашивают и окна, и подсказки) */
export function isDark() {
  return game.settings.get(MODULE_ID, "bookTheme") === "dark";
}

/* ---------- Таланты аптекаря (стр. 143) ----------
   «Фармацевт» (Pharmacist) - проваленную проверку ремесла (аптекарь) можно перевернуть.
   «Походный рецепт» (Concoct) - затея аптекаря не требует мастерской.
   ВАЖНО: в русской книге из-за вёрстки колонок заголовок «Поспешное бегство» (Flee!, бег)
   стоит рядом с текстом «Походного рецепта» - на бегство эти правила НЕ распространяются. */
const APOTHECARY_RE = /аптекар|apothecar/;
/* Специализация в скобках не мешает: «Фармацевт (травы)» тоже считается.
   \b тут нельзя - в JS граница слова считается по латинице и на кириллице не срабатывает. */
const TALENT_RE = {
  pharmacist: /^(фармацевт|pharmacist)(\s|\(|$)/,
  concoct: /^(походный рецепт|concoct)(\s|\(|$)/
};

/** Какие из талантов аптекаря есть у персонажа (только для ремесла (аптекарь)) */
function apothecaryTalents(skillName, idx) {
  const none = { pharmacist: false, concoct: false };
  if (!APOTHECARY_RE.test(norm(skillName))) return none;
  const out = { ...none };
  for (const t of idx.talents) {
    const n = norm(t.name);
    for (const key of Object.keys(TALENT_RE)) if (TALENT_RE[key].test(n)) out[key] = true;
  }
  return out;
}

/** ГМ-интерфейс показывается, если пользователь ГМ и не включил «вид игрока» */
export function isGMView() {
  return !!game.user.isGM && !game.settings.get(MODULE_ID, "playerView");
}

export function recipeStatus(actor, recipe, { picked = [], idx = null } = {}) {
  const sys = recipe.system ?? {};
  const inv = idx ?? actorIndex(actor);
  // Выбранные улучшения добавляют своё сырьё, деньги и требуемый УУ
  const ups = (sys.upgrades ?? []).filter((u) => picked.includes(u.quality));
  const slBase = (Number(sys.slTarget) || 1) + ups.reduce((n, u) => n + (Number(u.slBonus) || 0), 0);
  const skillItem = findSkill(actor, sys.skill, inv) ?? findSkill(actor, sys.skillAlt, inv);
  const skillUsed = skillItem ? skillItem.name : sys.skill;
  const skillTotal = skillItem ? Number(skillItem.system.total?.value) || 0 : 0;
  const mod = difficultyMod(sys.difficulty);
  const talents = apothecaryTalents(skillUsed, inv);
  const talent = Math.min(craftsmanLevels(actor, skillUsed, inv), Math.max(slBase - 1, 0));
  const slTarget = Math.max(slBase - talent, 1);
  // Ингредиенты рецепта + ингредиенты выбранных улучшений (одинаковые складываются)
  const needed = [...(sys.ingredients ?? []).map((i) => ({ ...i }))];
  for (const u of ups) {
    for (const ing of u.ingredients ?? []) {
      const same = needed.find((n) => norm(n.name) === norm(ing.name));
      if (same) same.count += ing.count;
      else needed.push({ ...ing });
    }
  }
  const ingredients = needed.map((ing) => {
    const { have } = stockOf(actor, ing.name, inv);
    return { ...ing, have, ok: have >= ing.count };
  });
  const tools = (sys.tools ?? []).map((t) => {
    const { have } = stockOf(actor, t.name, inv);
    return { ...t, have, ok: have > 0 };
  });
  const costBp = (sys.moneyBp || 0) + ups.reduce((n, u) => n + (Number(u.moneyBp) || 0), 0);
  const haveBp = moneyPennies(actor, inv);
  const moneyOk = haveBp >= costBp;
  const countMoney = game.settings.get(MODULE_ID, "highlightMoney");
  const missing = [];
  if (!skillItem) missing.push("skill");
  if (ingredients.some((i) => !i.ok)) missing.push("ingredients");
  if (tools.some((t) => !t.ok)) missing.push("tools");
  if (!moneyOk) missing.push("money");
  const base = !!skillItem && ingredients.every((i) => i.ok) && tools.every((t) => t.ok);
  return {
    skillItem, skillUsed, skillTotal, mod, target: skillTotal + mod,
    slTarget, talent, talents, ingredients, tools, moneyOk, haveBp, costBp, ups, missing,
    ready: base && (moneyOk || !countMoney),
    canStart: base && moneyOk
  };
}

/* ---------- Запуск, завершение и провал крафта ---------- */

export async function startCraft(actor, recipe, picked = []) {
  const st = recipeStatus(actor, recipe, { picked });
  if (!st.canStart) {
    const what = st.missing.map((m) => L(`WFRPRB.Missing.${m}`)).join(", ");
    ui.notifications?.warn(F("WFRPRB.Craft.CantStart", { what }));
    return null;
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
      spent.push({ name: it.name, img: it.img, count: take, source: it.toObject() });
      if (take >= q) deletes.push(it.id);
      else updates.push({ _id: it.id, "system.quantity.value": q - take });
    }
  }
  if (!(await changeActorMoney(actor, -st.costBp))) return;
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
      [MODULE_ID]: {
        recipeUuid: recipe.uuid, recipeName: recipe.name,
        crit: sys.critEnabled ? {
          sl: Number(sys.critSL) || 0,
          extra: !!sys.critExtra, count: Number(sys.critCount) || 1,
          upgrade: !!sys.critUpgrade,
          result: { uuid: sys.critResult?.uuid ?? "", name: sys.critResult?.name ?? "", img: sys.critResult?.img ?? "" },
          refund: !!sys.critRefund,
          random: !!sys.critRandom,
          qualities: (sys.critQualities ?? []).map((q) => ({ name: q.name, value: q.value ?? null })),
          qualMode: sys.critQualMode || "and"
        } : null,
        fail: {
          flawed: !!sys.failFlawed,
          cleanSL: Number(sys.cleanSL) || 0,
          pool: [...(sys.failPool ?? [])]
        },
        result: { uuid: sys.result.uuid, name: sys.result.name, img: sys.result.img || recipe.img, count: sys.result.count, descr: sys.description?.value ?? "" },
        moneyBp: st.costBp,
        spent: spentLite,
        // Выбранные улучшения: качества добавятся предмету при успехе
        upgrades: st.ups.map((u) => ({ quality: u.quality, name: u.name }))
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
  } else ui.notifications?.error(L("WFRPRB.Craft.NoSystem"));
}

/** Локализованное имя качества/изъяна из конфига системы (fallback - сам ключ) */
export function propertyLabel(key) {
  const c = game.wfrp4e?.config ?? {};
  for (const map of [c.itemQualities, c.weaponQualities, c.armorQualities, c.itemFlaws, c.weaponFlaws, c.armorFlaws]) {
    if (map && key in map) return game.i18n.localize(map[key]);
  }
  return key;
}

/** Описание качества/изъяна из конфига системы: «Название\nчто делает» (для ховеров) */
export function propertyTip(key, label = propertyLabel(key)) {
  const c = game.wfrp4e?.config ?? {};
  const raw = c.qualityDescriptions?.[key] ?? c.flawDescriptions?.[key];
  if (!raw) return label;
  const text = game.i18n.localize(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? `${label}\n${text}` : label;
}

function propText(p) {
  return propertyLabel(p.name) + (p.value ? ` (${p.value})` : "");
}

/** Дописать качества/изъяны в данные создаваемого предмета (формат системы: {name, value}) */
/** Предмет-результат: из базы по uuid, иначе простой товар.
    Общий для завершения крафта, брака и «сделать предмет» из реестра ГМа. */
async function resultObject(data, fallbackName, count = 1) {
  const src = data?.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
  let obj;
  if (src) {
    obj = src.toObject();
    delete obj._id;
  } else {
    obj = {
      name: data?.name || fallbackName, type: "trapping", img: data?.img,
      system: { trappingType: { value: "misc" }, quantity: { value: 1 }, description: { value: data?.descr ?? "" } }
    };
  }
  if (obj.system?.quantity) obj.system.quantity.value = count;
  return obj;
}

function pushProps(obj, listKey, props) {
  if (!props?.length) return;
  obj.system ??= {};
  obj.system[listKey] ??= { value: [] };
  obj.system[listKey].value ??= [];
  for (const p of props) {
    const existing = obj.system[listKey].value.find((x) => x.name === p.name);
    if (existing) existing.value = (Number(existing.value) || 0) + (Number(p.value) || 0) || existing.value;
    else obj.system[listKey].value.push({ name: p.name, value: p.value ?? null });
  }
}

function chatCard(actor, { icon, title, lines, img }) {
  const rows = (lines ?? []).map((l) => `<div class="rb-card-line">${l}</div>`).join("");
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) ?? { alias: actor.name },
    content: `<div class="rb-chat-card"><img src="${esc(img)}" alt=""><div><div class="rb-card-title">${icon} ${esc(title)}</div>${rows}</div></div>`
  });
}

async function finishCraft(actor, test) {
  let data = test.getFlag(MODULE_ID, "result");
  const crit = test.getFlag(MODULE_ID, "crit");
  const curSL = Number(test.system.SL?.current) || 0;
  const isCrit = !!crit && crit.sl > 0 && curSL >= crit.sl;
  let count = data.count || 1;
  const lines = [esc(test.getFlag(MODULE_ID, "recipeName") ?? "")];

  let obj_critQualities = null;
  if (isCrit) {
    // Эффекты складываются; при critRandom из выбранных выдаётся ОДИН случайный
    let effects = [];
    if (crit.qualities?.length) effects.push("qualities");
    if (crit.extra) effects.push("extra");
    if (crit.upgrade && (crit.result?.uuid || crit.result?.name)) effects.push("upgrade");
    if (crit.refund) effects.push("refund");
    if (crit.random && effects.length > 1) effects = [effects[Math.floor(Math.random() * effects.length)]];
    if (effects.length) lines.push(`<b>${F("WFRPRB.Chat.Crit", { sl: curSL })}</b>`);
    for (const eff of effects) {
      if (eff === "extra") {
        count += crit.count || 1;
        lines.push("· " + esc(F("WFRPRB.Chat.CritExtra", { n: crit.count || 1 })));
      } else if (eff === "upgrade") {
        data = { ...data, ...crit.result };
        lines.push("· " + esc(F("WFRPRB.Chat.CritUpgrade", { name: crit.result.name })));
      } else if (eff === "qualities" && crit.qualities?.length) {
        let qs = crit.qualities;
        if (crit.qualMode === "or" && qs.length > 1) qs = [qs[Math.floor(Math.random() * qs.length)]];
        obj_critQualities = qs; // применим после сборки объекта
        lines.push("· " + esc(F("WFRPRB.Chat.CritQualities", { list: qs.map(propText).join(", ") })));
      } else if (eff === "refund") {
        const spent = test.getFlag(MODULE_ID, "spent") ?? [];
        const back = [];
        for (const sp of spent) {
          const half = Math.floor(sp.count / 2);
          if (half > 0) back.push({ ...sp.source, system: { ...sp.source.system, quantity: { value: half } } });
        }
        if (back.length) await actor.createEmbeddedDocuments("Item", back);
        const backBp = Math.floor((test.getFlag(MODULE_ID, "moneyBp") || 0) / 2);
        if (backBp) await changeActorMoney(actor, backBp);
        lines.push("· " + esc(L("WFRPRB.Chat.CritRefund")));
      }
    }
  }

  const obj = await resultObject(data, test.name, count);
  const ups = test.getFlag(MODULE_ID, "upgrades") ?? [];
  if (ups.length) {
    pushProps(obj, "qualities", ups.map((u) => ({ name: u.quality, value: null })));
    lines.push("· " + esc(F("WFRPRB.Chat.Upgraded", { list: ups.map((u) => u.name || propertyLabel(u.quality)).join(", ") })));
  }
  if (obj_critQualities) pushProps(obj, "qualities", obj_critQualities);
  // «Порог чистой работы»: проект завершён, но УУ ниже порога - предмет со случайным изъяном
  const fail = test.getFlag(MODULE_ID, "fail") ?? {};
  if (fail.cleanSL > 0 && curSL < fail.cleanSL && fail.pool?.length) {
    const flaw = fail.pool[Math.floor(Math.random() * fail.pool.length)];
    pushProps(obj, "flaws", [{ name: flaw, value: null }]);
    lines.push("! " + esc(F("WFRPRB.Chat.SloppyWork", { flaw: propertyLabel(flaw) })));
  }
  await actor.createEmbeddedDocuments("Item", [obj]);
  chatCard(actor, {
    icon: isCrit ? "✓✓" : "✓", img: data.img || obj.img,
    title: F("WFRPRB.Chat.Done", { name: data.name || obj.name, count }),
    lines
  });
  await test.delete();
  RecipeBookApp.renderAll();
}

async function failCraft(actor, test) {
  // «Брак при провале»: вместо потери работы создаётся предмет со случайным изъяном
  const fail = test.getFlag(MODULE_ID, "fail") ?? {};
  const data0 = test.getFlag(MODULE_ID, "result");
  if (fail.flawed && fail.pool?.length) {
    const obj = await resultObject(data0, test.name, data0?.count || 1);
    const flaw = fail.pool[Math.floor(Math.random() * fail.pool.length)];
    pushProps(obj, "flaws", [{ name: flaw, value: null }]);
    await actor.createEmbeddedDocuments("Item", [obj]);
    chatCard(actor, {
      icon: "✗", img: data0?.img || obj.img,
      title: F("WFRPRB.Chat.Flawed", { name: data0?.name || obj.name }),
      lines: [esc(F("WFRPRB.Chat.FlawedLine", { flaw: propertyLabel(flaw) }))]
    });
    await test.delete();
    RecipeBookApp.renderAll();
    return;
  }

  const mode = game.settings.get(MODULE_ID, "failLoss"); // none | half | all
  const spent = test.getFlag(MODULE_ID, "spent") ?? [];
  const moneyBp = test.getFlag(MODULE_ID, "moneyBp") || 0;
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
  const data = test.getFlag(MODULE_ID, "result");
  chatCard(actor, {
    icon: "✗", img: data?.img || test.img,
    title: F("WFRPRB.Chat.Failed", { name: data?.name || test.name }),
    lines: [esc(L(`WFRPRB.Chat.Loss.${mode}`))]
  });
  await test.delete();
  RecipeBookApp.renderAll();
}

/** Следим за системными extendedTest с нашим флагом: цель достигнута - предмет, ниже нуля - провал */
/** Копия рецепта персонажу: пометка «новый» и ссылка на источник.
    Зовут и книга (кнопка «выдать»), и лист рецепта (сохранение с выдачей). */
export async function giveRecipeTo(actor, recipe) {
  const obj = recipe.toObject();
  delete obj._id;
  const flags = { ...(obj.flags?.[MODULE_ID] ?? {}), isNew: true, fresh: false, source: recipe.uuid };
  delete flags.forActor; // копия ничья, это поле только у черновика
  obj.flags = { ...(obj.flags ?? {}), [MODULE_ID]: flags };
  const [made] = await actor.createEmbeddedDocuments("Item", [obj]);
  ui.notifications?.info(F("WFRPRB.World.Given", { name: recipe.name, actor: actor.name }));
  return made;
}

export function watchCrafting() {
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (userId && userId !== game.user.id) return;
    // Правки рецептов и запасов обновляют книгу (сохранение черновика, смена полей, трата сырья)
    if (item.type === RECIPE_TYPE || (item.actor && isStock(item))) {
      RecipeBookApp.renderAll();
      return;
    }
    if (item.type !== "extendedTest" || !item.actor || !item.getFlag(MODULE_ID, "result")) return;
    const cur = Number(item.system.SL?.current) || 0;
    const target = Number(item.system.SL?.target) || 0;
    const done = target > 0 && cur >= target ? finishCraft(item.actor, item)
      : cur < 0 ? failCraft(item.actor, item) : null;
    // Работа продолжается - просто обновляем прогресс
    if (!done) return RecipeBookApp.renderAll();
    // Сырьё уже списано: молча терять ошибку нельзя, иначе проект зависнет без следов
    done.catch((err) => {
      console.error(`${MODULE_ID} | не удалось завершить крафт`, err);
      ui.notifications?.error(L("WFRPRB.Craft.Broken"));
    });
  });
  for (const hook of ["createItem", "deleteItem"]) {
    Hooks.on(hook, (item) => {
      if (item?.actor && (item.type === RECIPE_TYPE || item.type === "extendedTest" || isStock(item))) RecipeBookApp.renderAll();
      else if (item?.type === RECIPE_TYPE) RecipeBookApp.renderAll(); // мировой рецепт - реестр ГМа
    });
  }
}

/** Индекс физических предметов базы (мир + компендиумы) - для поиска в листе рецепта.
    Кэш на сессию: { name, img, uuid, type }. */
let _itemIndex = null;
export async function itemIndex() {
  if (_itemIndex) return _itemIndex;
  const out = [];
  for (const it of game.items ?? []) if (!NOT_STOCK.has(it.type)) out.push({ name: it.name, img: it.img, uuid: it.uuid, type: it.type });
  for (const pack of game.packs ?? []) {
    if ((pack.documentName ?? pack.metadata?.type) !== "Item") continue;
    const idx = await pack.getIndex().catch(() => []);
    for (const e of idx) {
      if (NOT_STOCK.has(e.type)) continue;
      out.push({ name: e.name, img: e.img, uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`, type: e.type });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  _itemIndex = out;
  return out;
}

/** Диалог с произвольным набором именованных действий; возвращает ключ выбранного */
export async function askAction({ title, body, options }) {
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    content: `<p>${body}</p>`,
    buttons: [
      ...options.map((o, i) => ({ action: o.action, label: o.label, default: i === 0, class: o.danger ? "rb-danger" : "" })),
      { action: "cancel", label: L("WFRPRB.Sheet.Cancel") }
    ]
  }).catch(() => "cancel");
}

/**
 * Подтверждение необратимого действия: заголовок-вопрос, факт последствий, именованные кнопки.
 * Кнопка действия названа глаголом (не «Да»), отмена - всегда рядом и безопасна.
 */
export async function confirmAction({ title, body, confirmLabel }) {
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title },
    content: `<p>${body}</p>`,
    buttons: [
      { action: "ok", label: confirmLabel, default: true, class: "rb-danger" },
      { action: "cancel", label: L("WFRPRB.Sheet.Cancel") }
    ]
  }).catch(() => "cancel");
  return choice === "ok";
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
    const dark = isDark() ? "rb-theme-dark" : "";
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
    // Сначала в нулевую позицию: у правого края fixed-элемент сжимается, и замер врёт
    el.style.left = "0px";
    el.style.top = "0px";
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

/**
 * Выпадающий поиск по базе предметов: вставляет панель после anchor, вызывает cb(entry).
 * Используют мастер «Создать с нуля», лист рецепта и кнопка «рецепт из предмета».
 */
export async function openItemPicker(anchor, cb, { filter = null } = {}) {
  anchor?.parentElement?.querySelector(".rb-picker-host")?.remove();
  const all = await itemIndex();
  const items = filter ? all.filter(filter) : all;
  // Панель носит класс окна модуля с собой: её могут вставлять и вне наших окон,
  // а все стили (включая размеры картинок) привязаны к .wfrp-recipe-book
  const host = document.createElement("div");
  const dark = isDark() ? " rb-theme-dark" : "";
  host.className = `wfrp-recipe-book rb-picker-host${dark}`;
  host.innerHTML = `<div class="rb-picker"><input type="text" class="rb-picker-search" placeholder="${esc(L("WFRPRB.Sheet.SearchItem"))}"><div class="rb-picker-list"></div></div>`;
  const panel = host.querySelector(".rb-picker");
  anchor.after(host);
  const list = panel.querySelector(".rb-picker-list");
  const input = panel.querySelector(".rb-picker-search");
  const show = (q) => {
    const n = norm(q);
    const match = items.filter((i) => !n || norm(i.name).includes(n)).slice(0, 30);
    list.innerHTML = match.length
      ? match.map((i, idx) => `<button type="button" class="rb-picker-row" data-idx="${idx}"><img src="${esc(i.img ?? "")}" alt="">${esc(i.name)}</button>`).join("")
      : `<div class="rb-picker-empty">${esc(L("WFRPRB.Sheet.NothingFound"))}</div>`;
    list.querySelectorAll(".rb-picker-row").forEach((row, idx) =>
      row.addEventListener("click", () => { host.remove(); cb(match[idx]); }));
  };
  show("");
  input.addEventListener("input", () => show(input.value));
  input.addEventListener("keydown", (ev) => { if (ev.key === "Escape") host.remove(); });
  input.focus();
  return host;
}

/**
 * Выпадающий список простых значений (например, навыков) под полем ввода.
 * Нативный datalist в Foundry не прокручивается и не стилизуется - рисуем свой.
 */
export function openNamePicker(anchor, names, cb, { query = "" } = {}) {
  closeNamePicker(anchor);
  const n = norm(query);
  const match = (n ? names.filter((x) => norm(x).includes(n)) : names).slice(0, 50);
  if (!match.length) return null;
  const host = document.createElement("div");
  const dark = isDark() ? " rb-theme-dark" : "";
  host.className = `wfrp-recipe-book rb-picker-host rb-names-host${dark}`;
  host.innerHTML = `<div class="rb-picker"><div class="rb-picker-list">${
    match.map((x, i) => `<button type="button" class="rb-picker-row" data-idx="${i}">${esc(x)}</button>`).join("")
  }</div></div>`;
  anchor.after(host);
  host.querySelectorAll(".rb-picker-row").forEach((row, i) =>
    row.addEventListener("pointerdown", (ev) => { ev.preventDefault(); host.remove(); cb(match[i]); }));
  return host;
}

export function closeNamePicker(anchor) {
  (anchor?.parentElement ?? document).querySelectorAll(".rb-names-host").forEach((el) => el.remove());
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
      toggleUpgrade: RecipeBookApp.#onToggleUpgrade,
      continueTest: RecipeBookApp.#onContinue,
      abandon: RecipeBookApp.#onAbandon,
      filter: RecipeBookApp.#onFilter,
      resetFilters: RecipeBookApp.#onResetFilters,
      openResult: RecipeBookApp.#onOpenResult,
      openRecipe: RecipeBookApp.#onOpenRecipe,
      createRecipe: RecipeBookApp.#onCreateRecipe,
      giveRecipe: RecipeBookApp.#onGiveRecipe,
      makeToWorld: RecipeBookApp.#onMakeToWorld,
      deleteRecipe: RecipeBookApp.#onDeleteRecipe
    }
  };

  static PARTS = { book: { template: `modules/${MODULE_ID}/templates/book.hbs`, scrollable: [".rb-list", ".rb-right-scroll"] } };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.filter = "all";
    this.search = "";
    this.selected = null; // {kind:"recipe"|"project", id}
    this.picked = {};      // id рецепта -> массив выбранных улучшений (ключи качеств)
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

  /** Черновик - созданный, но ещё не сохранённый рецепт: в списках его нет */
  static isDraft(item) {
    return !!item.getFlag?.(MODULE_ID, "fresh");
  }

  recipes() {
    return (this.actor?.items ?? []).filter((i) => i.type === RECIPE_TYPE && !RecipeBookApp.isDraft(i));
  }

  /** Рецепты мира (вкладка «Реестр», только ГМ) */
  worldRecipes() {
    return (game.items ?? []).filter((i) => i.type === RECIPE_TYPE && !RecipeBookApp.isDraft(i));
  }

  /** Копии мирового рецепта у персонажей: по флагу источника, иначе по имени (старые выдачи) */
  copiesOf(recipe) {
    const out = [];
    for (const a of game.actors?.contents ?? []) {
      if (!ACTOR_TYPES.includes(a.type)) continue;
      for (const it of a.items) {
        if (it.type !== RECIPE_TYPE) continue;
        const src = it.getFlag(MODULE_ID, "source");
        if (src === recipe.uuid || (!src && it.name === recipe.name)) out.push({ actor: a, item: it });
      }
    }
    return out;
  }

  /** Рецепт по выбору: с открытого актёра, из мира или с другого персонажа (реестр ГМа) */
  selectedRecipe() {
    const sel = this.selected;
    if (sel?.kind === "recipe") return this.actor.items.get(sel.id);
    if (sel?.kind === "wrecipe") return game.items?.get?.(sel.id) ?? null;
    if (sel?.kind === "arecipe") return game.actors?.get?.(sel.actorId)?.items.get(sel.id) ?? null;
    return null;
  }

  /** Владелец рецепта из реестра (для статуса и подписей) */
  selectedOwner() {
    return this.selected?.kind === "arecipe" ? game.actors?.get?.(this.selected.actorId) ?? this.actor : this.actor;
  }

  projects() {
    return (this.actor?.items ?? []).filter((i) => i.type === "extendedTest" && i.getFlag(MODULE_ID, "result"));
  }

  /** Данные для богатого ховера по предмету: картинка, цена, доступность, описание */
  async _itemTip(name, uuid, fallbackImg, actor = this.actor) {
    const own = stockOf(actor, name).items[0];
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
    const dark = isDark();
    const gm = isGMView();
    if (this.filter === "world" && !gm) this.filter = "all";
    const world = this.filter === "world";
    const q = norm(this.search);
    // Один проход - один срез инвентаря и один расчёт статуса на рецепт (их спрашивают и список, и счётчики)
    const indexes = new Map();
    const idxFor = (a) => {
      const key = a?.id ?? "none";
      let i = indexes.get(key);
      if (!i) indexes.set(key, (i = actorIndex(a)));
      return i;
    };
    const stCache = new Map();
    const statusOf = (a, r) => {
      const key = `${a?.id ?? "none"}|${r.uuid}`;
      let st = stCache.get(key);
      if (!st) stCache.set(key, (st = recipeStatus(a, r, { idx: idxFor(a) })));
      return st;
    };
    const ownRecipes = this.recipes();
    const ownById = new Map(ownRecipes.map((r) => [r.id, r]));
    const ownByUuid = new Map(ownRecipes.map((r) => [r.uuid, r]));
    const projects = this.projects().map((t) => {
      const target = Number(t.system.SL?.target) || 1;
      const cur = Math.max(Number(t.system.SL?.current) || 0, 0);
      const res = t.getFlag(MODULE_ID, "result");
      const skillItem = findSkill(this.actor, t.system.test?.value);
      const moneyBp = t.getFlag(MODULE_ID, "moneyBp") || 0;
      const skillName = t.system.test?.value ?? "";
      const skillTotal = skillItem ? Number(skillItem.system.total?.value) || 0 : 0;
      const mod = difficultyMod(t.system.difficulty?.value);
      return {
        id: t.id, img: res?.img || t.img, name: res?.name || t.name, count: res?.count || 1,
        cur: Number(t.system.SL?.current) || 0, target,
        pct: Math.min(Math.round((cur / target) * 100), 100),
        skill: t.system.test?.value ?? "",
        rollTarget: skillTotal + mod,
        // Подсказка собирается здесь: в шаблоне ключ подставился бы как есть, с «{skill}»
        checkTip: skillItem
          ? F("WFRPRB.Tip.Check", { skill: skillName, total: skillTotal, mod: mod >= 0 ? `+${mod}` : mod, target: skillTotal + mod })
          : F("WFRPRB.Tip.NoSkill", { skill: skillName }),
        recipeUuid: t.getFlag(MODULE_ID, "recipeUuid") ?? "",
        spent: t.getFlag(MODULE_ID, "spent") ?? [],
        moneyHtml: moneyBp ? moneyHtml(moneyBp) : ""
      };
    });

    // Рецепты без навыка (свежесозданные ГМом) - в группу «Необычные», она всегда в конце
    const unusual = L("WFRPRB.Group.Unusual");
    const worldLabel = L("WFRPRB.World.Source");
    let pool;
    if (world) {
      // Реестр ГМа: рецепты мира + копии у ВСЕХ персонажей (версии могут отличаться)
      pool = this.worldRecipes().map((r) => ({ r, owner: null }));
      for (const a of (game.actors?.contents ?? []).filter((x) => ACTOR_TYPES.includes(x.type))) {
        for (const r of a.items.filter((i) => i.type === RECIPE_TYPE)) pool.push({ r, owner: a });
      }
    } else {
      pool = ownRecipes.map((r) => ({ r, owner: null }));
    }
    let entries = pool.map(({ r, owner }) => {
      const st = statusOf(world ? (owner ?? this.actor) : this.actor, r);
      const missing = st.missing.map((m) => L(`WFRPRB.Missing.${m}`)).join(", ");
      const res = r.system.result ?? {};
      // Параметры готового предмета - как в подсказках paperdoll. Тип результата берём из того же документа,
      // кастомный результат (без uuid) создаётся как trapping
      let doc = null;
      if (res.uuid) try { doc = globalThis.fromUuidSync?.(res.uuid) ?? null; } catch { doc = null; }
      const dsys = doc?.system ?? {};
      const dbp = doc ? priceBp(dsys) : 0;
      const typeKey = `TYPES.Item.${doc?.type ?? "trapping"}`;
      const props = [
        ...(dsys.qualities?.value ?? []).map((q) => propertyLabel(q.name) + (q.value ? ` (${q.value})` : "")),
        ...(dsys.flaws?.value ?? []).map((q) => propertyLabel(q.name) + (q.value ? ` (${q.value})` : ""))
      ];
      const dd = Number(r.system.timeDays) || 0, dh = Number(r.system.timeHours) || 0, dm = Number(r.system.timeMinutes) || 0;
      return {
        // В списке - иконка ПРЕДМЕТА-РЕЗУЛЬТАТА (что получится); иконка рецепта - запасная
        id: r.id, name: r.name, img: res.img || r.img,
        resultName: res.name || r.name, count: res.count ?? 1,
        skill: st.skillUsed || unusual, type: doc?.type ?? "trapping", ready: st.ready, missing,
        owner: owner?.name ?? null, ownerId: owner?.id ?? "",
        inWork: !world && projects.some((pj) => pj.recipeUuid === r.uuid),
        isNew: !!r.getFlag(MODULE_ID, "isNew"),
        kind: world ? (owner ? "arecipe" : "wrecipe") : "recipe",
        group: world ? (owner?.name ?? worldLabel) : (st.skillUsed || unusual),
        groupRank: world && !owner ? 0 : 1,
        tooltip: st.ready ? L("WFRPRB.Tip.EntryReady") : F("WFRPRB.Tip.EntryMissing", { what: missing }),
        tt: {
          img: res.img || r.img,
          name: res.name || r.name,
          count: res.count ?? 1,
          typeLabel: game.i18n.has(typeKey) ? L(typeKey) : "",
          priceHtml: dbp ? moneyHtml(dbp) : "",
          avail: availLabel(dsys.availability?.value),
          enc: dsys.encumbrance?.value ?? null,
          props: props.join(", "),
          skill: st.skillUsed || "",
          hasSkill: !!st.skillItem,
          target: st.target,
          slTarget: st.slTarget,
          time: fmtTime(dd, dh, dm),
          ingredients: st.ingredients.map((i) => ({ name: i.name, have: i.have, count: i.count, ok: i.ok })),
          ready: st.ready,
          missing
        }
      };
    });
    // Доп. фильтры: у ГМа всегда, у игроков - по настройке extraFilters
    const extraFilters = gm || game.settings.get(MODULE_ID, "extraFilters");
    let skillOptions = [];
    let typeOptions = [];
    let ownerOptions = [];
    if (extraFilters) {
      skillOptions = [...new Set(entries.map((e) => e.skill))].sort((a, b) => a.localeCompare(b, "ru"));
      typeOptions = [...new Set(entries.map((e) => e.type))].map((t) => {
        const key = `TYPES.Item.${t}`;
        const label = game.i18n.localize(key);
        return { key: t, label: label === key ? t : label };
      }).sort((a, b) => a.label.localeCompare(b.label, "ru"));
      if (world) {
        // Реестр: фильтр по владельцу (Мир / персонажи)
        const seen = new Map();
        for (const e of entries) seen.set(e.ownerId || "world", e.owner ?? worldLabel);
        ownerOptions = [...seen.entries()].map(([key, label]) => ({ key, label, selected: this.ownerFilter === key }))
          .sort((a, b) => (a.key === "world" ? -1 : b.key === "world" ? 1 : a.label.localeCompare(b.label, "ru")));
        if (this.ownerFilter && !seen.has(this.ownerFilter)) this.ownerFilter = "";
        if (this.ownerFilter) entries = entries.filter((e) => (e.ownerId || "world") === this.ownerFilter);
      }
      if (this.skillFilter && !skillOptions.includes(this.skillFilter)) this.skillFilter = "";
      if (this.typeFilter && !typeOptions.find((t) => t.key === this.typeFilter)) this.typeFilter = "";
      if (this.skillFilter) entries = entries.filter((e) => e.skill === this.skillFilter);
      if (this.typeFilter) entries = entries.filter((e) => e.type === this.typeFilter);
    }
    if (q) entries = entries.filter((e) => norm(e.name).includes(q) || norm(e.resultName).includes(q) || norm(e.skill).includes(q));
    if (this.filter === "ready") entries = entries.filter((e) => e.ready);
    if (this.filter === "missing") entries = entries.filter((e) => !e.ready);
    entries.sort((a, b) =>
      (a.groupRank ?? 1) - (b.groupRank ?? 1) ||
      (a.group === unusual) - (b.group === unusual) ||
      a.group.localeCompare(b.group, "ru") ||
      a.skill.localeCompare(b.skill, "ru") || a.name.localeCompare(b.name, "ru"));
    const groups = [];
    for (const e of entries) {
      let g = groups.at(-1);
      if (!g || g.skill !== e.group) { g = { skill: e.group, entries: [] }; groups.push(g); }
      g.entries.push(e);
    }

    // Помним, из какого рецепта вырос проект: после завершения вернём выбор на него
    this._projRecipe ??= {};
    for (const pj of projects) {
      const rec = ownByUuid.get(pj.recipeUuid);
      if (rec) this._projRecipe[pj.id] = rec.id;
    }

    // Выбранное: по умолчанию первый рецепт
    let detail = null;
    let sel = this.selected;
    if (sel?.kind === "project" && !projects.find((p) => p.id === sel.id)) {
      // Проект завершён или брошен - возвращаемся к его рецепту, а не к первому в списке
      const backId = sel.recipeId ?? this._projRecipe[sel.id];
      const back = backId ? ownById.get(backId) : null;
      sel = back ? { kind: "recipe", id: back.id } : null;
      delete this._projRecipe[sel.id];
    }
    if (sel?.kind === "recipe" && !ownById.has(sel.id)) sel = null;
    if (sel?.kind === "wrecipe" && !this.worldRecipes().find((r) => r.id === sel.id)) sel = null;
    if (sel?.kind === "arecipe" && !game.actors?.get?.(sel.actorId)?.items.get(sel.id)) sel = null;
    // Выбор из реестра не живёт вне реестра (и недоступен в виде игрока)
    if (!world && (sel?.kind === "wrecipe" || sel?.kind === "arecipe")) sel = null;
    if (!sel && entries.length) sel = { kind: entries[0].kind, id: entries[0].id, actorId: entries[0].ownerId };
    if (!sel && projects.length) sel = { kind: "project", id: projects[0].id };
    this.selected = sel;

    if (sel?.kind === "recipe" || sel?.kind === "wrecipe" || sel?.kind === "arecipe") {
      const r = this.selectedRecipe();
      const statusActor = this.selectedOwner();
      if (r) {
        // Открыли разворот - рецепт больше не «новый» (снимаем один раз)
        if (r.getFlag(MODULE_ID, "isNew") && !this._seen?.has(r.id)) {
          (this._seen ??= new Set()).add(r.id);
          r.unsetFlag(MODULE_ID, "isNew").catch(() => null);
        }
        const picked = this.picked[r.id] ?? [];
        const st = recipeStatus(statusActor, r, { picked, idx: idxFor(statusActor) });
        const res = r.system.result ?? {};
        const dd = Number(r.system.timeDays) || 0;
        const hh = Number(r.system.timeHours) || 0;
        const mm = Number(r.system.timeMinutes) || 0;
        detail = {
          kind: "recipe", world: sel.kind !== "recipe", id: r.id, name: r.name, img: r.img, isGM: gm,
          ownerName: sel.kind === "arecipe" ? statusActor?.name ?? "" : "",
          result: {
            ...res, name: res.name || r.name, img: res.img || r.img, count: res.count ?? 1,
            tt: await this._itemTip(res.name || r.name, res.uuid, res.img || r.img, statusActor)
          },
          ingredients: await Promise.all(st.ingredients.map(async (ing) => ({
            ...ing,
            tooltip: F("WFRPRB.Tip.Ingredient", { have: ing.have, need: ing.count }),
            tt: await this._itemTip(ing.name, ing.uuid, ing.img, statusActor)
          }))),
          moneyBp: st.costBp, moneyHtml: moneyHtml(st.costBp), moneyOk: st.moneyOk,
          upgrades: (r.system.upgrades ?? []).map((u) => ({
            quality: u.quality,
            name: u.name || propertyLabel(u.quality),
            on: picked.includes(u.quality),
            slBonus: u.slBonus,
            costHtml: [
              ...(u.ingredients ?? []).map((i) => `${esc(i.name)}${i.count > 1 ? ` ×${i.count}` : ""}`),
              u.moneyBp ? moneyHtml(u.moneyBp) : ""
            ].filter(Boolean).join(", "),
            // В подсказке - ЧТО ДАЁТ качество (цена и +УУ уже видны в самой строке)
            tip: propertyTip(u.quality, u.name || propertyLabel(u.quality))
          })),
          moneyTip: (() => {
            const cost = st.costBp;
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
          // Условия крита видит ТОЛЬКО ГМ - для игрока крит остаётся сюрпризом
          crit: gm && r.system.critEnabled ? (() => {
            const effs = [];
            if (r.system.critExtra) effs.push(F("WFRPRB.Chat.CritExtra", { n: r.system.critCount || 1 }));
            if (r.system.critUpgrade) effs.push(F("WFRPRB.Chat.CritUpgrade", { name: r.system.critResult?.name || "?" }));
            if (r.system.critRefund) effs.push(L("WFRPRB.Chat.CritRefund"));
            if (!effs.length) return "";
            const secret = r.system.critRandom && effs.length > 1;
            const effect = (secret ? L("WFRPRB.Crit.RandomNote") + " " : "") + effs.join(L("WFRPRB.Crit.And"));
            return F("WFRPRB.Crit.Line", { sl: r.system.critSL, effect });
          })() : "",
          slTip: F("WFRPRB.Tip.SL", { target: st.slTarget }) + (st.talent ? "\n· " + L("WFRPRB.Tip.Talent") : ""),
          needsWorkshop: r.system.needsWorkshop,
          // Талант снимает требование мастерской - показываем это прямо в строке условия
          noWorkshopNeeded: r.system.needsWorkshop && st.talents.concoct,
          pharmacist: st.talents.pharmacist,
          tools: await Promise.all(st.tools.map(async (t) => ({
            ...t,
            tt: await this._itemTip(t.name, t.uuid, t.img, statusActor)
          }))),
          description: r.system.description?.value ?? "",
          canStart: st.canStart,
          problems: st.missing.map((m) => L(`WFRPRB.Missing.${m}`))
        };
      }
    } else if (sel?.kind === "project") {
      detail = { kind: "project", ...projects.find((p) => p.id === sel.id) };
    }

    const counts = {
      all: ownRecipes.length,
      ready: ownRecipes.filter((r) => statusOf(this.actor, r).ready).length,
      work: projects.length,
      world: this.worldRecipes().length +
        (game.actors?.contents ?? []).filter((a) => ACTOR_TYPES.includes(a.type))
          .reduce((n, a) => n + a.items.filter((i) => i.type === RECIPE_TYPE).length, 0)
    };

    // Ничего не нашлось, но фильтры/поиск активны - предложить сброс
    const filtersActive = !!q || this.filter === "ready" || this.filter === "missing" ||
      !!this.skillFilter || !!this.typeFilter || !!this.ownerFilter;
    const noResults = !entries.length && (world || !projects.length) && filtersActive;

    return {
      actor: { name: this.actor?.name ?? "", img: this.actor?.img ?? "" },
      gm, noResults,
      world,
      extraFilters,
      skillOptions: skillOptions.map((n) => ({ name: n, selected: n === this.skillFilter })),
      typeOptions: typeOptions.map((t) => ({ ...t, selected: t.key === this.typeFilter })),
      ownerOptions,
      dark, groups, projects, detail, search: this.search,
      filter: this.filter, counts,
      empty: !ownRecipes.length && !projects.length
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
    root.classList.toggle("rb-theme-dark", isDark());
    RBTooltip.hide();
    RBTooltip.adoptTips();
    this._bindTooltips(root);
    root.querySelector(".rb-skill-filter")?.addEventListener("change", (ev) => {
      this.skillFilter = ev.currentTarget.value;
      this.render();
    });
    root.querySelector(".rb-type-filter")?.addEventListener("change", (ev) => {
      this.typeFilter = ev.currentTarget.value;
      this.render();
    });
    root.querySelector(".rb-owner-filter")?.addEventListener("change", (ev) => {
      this.ownerFilter = ev.currentTarget.value;
      this.render();
    });
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
    this.selected = { kind: target.dataset.kind, id: target.dataset.id, actorId: target.dataset.actor || "" };
    this.render();
  }

  /** Игрок включает/выключает улучшение перед началом работы */
  static #onToggleUpgrade(event, target) {
    const id = this.selected?.id;
    if (!id) return;
    const key = target.dataset.quality;
    const list = new Set(this.picked[id] ?? []);
    if (list.has(key)) list.delete(key);
    else list.add(key);
    this.picked[id] = [...list];
    this.render();
  }

  static async #onCraft() {
    if (this.selected?.kind !== "recipe") return;
    const recipe = this.actor.items.get(this.selected.id);
    if (!recipe) return;
    const test = await startCraft(this.actor, recipe, this.picked[recipe.id] ?? []);
    // Если работа закончилась сразу, проекта уже нет - остаёмся на рецепте
    if (test?.id && this.actor.items.get(test.id)) this.selected = { kind: "project", id: test.id, recipeId: recipe.id };
    this.render();
  }

  static async #onContinue(event, target) {
    const test = this.actor.items.get(target.dataset.id);
    if (test) await rollCraft(this.actor, test);
  }

  static async #onAbandon(event, target) {
    const test = this.actor.items.get(target.dataset.id);
    if (!test) return;
    const spent = (test.getFlag(MODULE_ID, "spent") ?? []).map((sp) => `${esc(sp.name)}${sp.count > 1 ? ` ×${sp.count}` : ""}`);
    const moneyBp = test.getFlag(MODULE_ID, "moneyBp") || 0;
    if (moneyBp) spent.push(moneyText(moneyBp));
    const name = esc(test.getFlag(MODULE_ID, "result")?.name ?? test.name);
    const yes = await confirmAction({
      title: L("WFRPRB.Abandon.Title"),
      body: spent.length
        ? F("WFRPRB.Abandon.HintSpent", { name, spent: spent.join(", ") })
        : F("WFRPRB.Abandon.Hint", { name }),
      confirmLabel: L("WFRPRB.Abandon.Button")
    });
    if (yes) { await test.delete(); this.render(); }
  }

  /** Пустая выдача: вернуть книгу к полному списку (режим «Реестр» сохраняем) */
  static #onResetFilters() {
    this.search = "";
    this.skillFilter = "";
    this.typeFilter = "";
    this.ownerFilter = "";
    if (this.filter !== "world") this.filter = "all";
    this.render();
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
    // Только персонажи ИГРОКОВ: тип character и есть владелец не-ГМ (NPC и прочие не показываем)
    const actors = (game.actors?.contents ?? [])
      .filter((a) => ACTOR_TYPES.includes(a.type) && a.hasPlayerOwner)
      .slice(0, 20);
    if (!actors.length) return ui.notifications?.warn(L("WFRPRB.World.NoPlayers"));
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
    const made = await giveRecipeTo(actor, recipe);
    if (actor.id === this.actor.id) {
      this.filter = "all";
      this.selected = { kind: "recipe", id: made.id };
    }
    this.render();
  }

  /** ГМ: создать предмет-результат прямо в мир, без персонажа и броска (воля ведущего) */
  static async #onMakeToWorld() {
    const r = this.selectedRecipe();
    if (!r) return;
    const res = r.system.result ?? {};
    const obj = await resultObject(
      { ...res, img: res.img || r.img, descr: r.system.description?.value ?? "" },
      r.name, res.count || 1
    );
    const made = await Item.create(obj);
    if (made) ui.notifications?.info(F("WFRPRB.World.Made", { name: made.name, count: res.count || 1 }));
  }

  /** ГМ: удалить рецепт - из книги персонажа или насовсем из мира */
  static async #onDeleteRecipe(event, target) {
    const r = this.selectedRecipe();
    if (!r) return;
    const world = this.selected?.kind === "wrecipe";
    const name = esc(r.system.result?.name || r.name);
    const owner = esc(this.selectedOwner()?.name ?? this.actor?.name ?? "");

    if (world) {
      const copies = this.copiesOf(r);
      const choice = copies.length
        ? await askAction({
            title: L("WFRPRB.Delete.WorldTitle"),
            body: F("WFRPRB.Delete.WorldHintCopies", {
              name, count: copies.length,
              actors: esc([...new Set(copies.map((c) => c.actor.name))].join(", "))
            }),
            options: [
              { action: "all", label: L("WFRPRB.Delete.Everywhere"), danger: true },
              { action: "world", label: L("WFRPRB.Delete.WorldOnly") }
            ]
          })
        : (await confirmAction({
            title: L("WFRPRB.Delete.WorldTitle"),
            body: F("WFRPRB.Delete.WorldHint", { name }),
            confirmLabel: L("WFRPRB.Delete.WorldButton")
          })) ? "world" : "cancel";
      if (choice === "cancel") return;
      if (choice === "all") {
        // Сначала копии у персонажей, затем сам рецепт мира
        const byActor = new Map();
        for (const c of copies) byActor.set(c.actor, [...(byActor.get(c.actor) ?? []), c.item.id]);
        for (const [a, ids] of byActor) await a.deleteEmbeddedDocuments("Item", ids);
        ui.notifications?.info(F("WFRPRB.Delete.DoneAll", { name, count: copies.length }));
      }
      await r.delete();
      this.selected = null;
      this.render();
      return;
    }

    const yes = await confirmAction({
      title: L("WFRPRB.Delete.ActorTitle"),
      body: F("WFRPRB.Delete.ActorHint", { name, actor: owner }),
      confirmLabel: L("WFRPRB.Delete.ActorButton")
    });
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
      img: `modules/${MODULE_ID}/assets/icons/recipe-default.png`,
      // создание с нуля + из чьей книги: «Сохранить» спросит, выдать ли рецепт этому игроку
      flags: { [MODULE_ID]: { fresh: true, forActor: this.actor?.uuid ?? "" } }
    });
    if (!item) return;
    this.filter = "world";
    this.render();
    item.sheet?.render(true);   // черновик появится в реестре только после «Сохранить»
  }
}
