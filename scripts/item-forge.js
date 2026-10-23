/* Мастер «Создать предмет с нуля» (вызывается из листа рецепта).
   Создаёт НАСТОЯЩИЙ предмет мира с качествами/изъянами системы и настраивает рецепт:
   требуемый УУ по правилам (изъян - вдвое, достоинство +5, стр. 199), доп. сырьё
   за достоинства, крит-качества (И/ИЛИ) и правила брака. */

import { MODULE_ID } from "./recipe-model.js";
import { L, F, esc, itemIndex, propertyLabel, coinIco, RecipeBookApp } from "./recipe-book.js";

const { ApplicationV2: ForgeAppBase, HandlebarsApplicationMixin: ForgeMixin } = foundry.applications.api;

const FORGE_TYPES = ["weapon", "armour", "trapping", "ammunition"];

/** Списки качеств/изъянов по типу предмета - из конфига системы */
function propLists(type) {
  const c = game.wfrp4e?.config ?? {};
  const merge = (...maps) => Object.assign({}, ...maps.filter(Boolean));
  const q = { weapon: merge(c.itemQualities, c.weaponQualities),
              armour: merge(c.itemQualities, c.armorQualities),
              trapping: merge(c.itemQualities),
              ammunition: merge(c.itemQualities, c.weaponQualities) }[type] ?? {};
  const f = { weapon: merge(c.itemFlaws, c.weaponFlaws),
              armour: merge(c.itemFlaws, c.armorFlaws),
              trapping: merge(c.itemFlaws),
              ammunition: merge(c.itemFlaws, c.weaponFlaws) }[type] ?? {};
  return { qualities: q, flaws: f };
}

function hasValue(key) {
  return !!game.wfrp4e?.config?.propertyHasValue?.[key];
}

export class ItemForgeApp extends ForgeMixin(ForgeAppBase) {
  static DEFAULT_OPTIONS = {
    classes: ["wfrp-recipe-book", "rb-forge"],
    window: { title: "WFRPRB.Forge.Title", resizable: true },
    position: { width: 560, height: 720 },
    actions: {
      pickExtra: ItemForgeApp.#onPickExtra,
      selectTab: ItemForgeApp.#onSelectTab,
      pickIcon: ItemForgeApp.#onPickIcon,
      forgeCreate: ItemForgeApp.#onCreate
    }
  };

  static PARTS = { forge: { template: `modules/${MODULE_ID}/templates/item-forge.hbs`, scrollable: [".rb-forge-scroll"] } };

  /** @param {RecipeSheet} sheet лист рецепта, из которого открыт мастер */
  constructor(sheet, options = {}) {
    super({ id: `rb-forge-${sheet.document.id}`, ...options });
    this.sheet = sheet;
    this.recipe = sheet.document;
    const st = {
      type: "weapon",
      name: "",
      img: `modules/${MODULE_ID}/assets/icons/recipe-default.png`,
      trappingType: "drugsPoisonsHerbsDraughts",
      enc: 0,
      priceGc: 0, priceSs: 0, priceBp: 0,
      qualities: {},   // key -> { on, value, extraName, extraImg, extraUuid, extraCount, extraBp }
      flaws: {},       // key -> { on, value }
      critQualities: {}, // key -> { on, value }
      critMode: "and",
      critSL: Number(this.recipe.system.critSL) || 8,
      failFlawed: false,
      cleanSL: 0,
      failPool: {},    // key -> on (по умолчанию все)
      tab: "qualities" // активный таб: qualities | flaws | crit | fail
    };
    this.forge = st;
    this.baseSL = Number(this.recipe.system.slTarget) || 1;
  }

  /** Требуемый УУ по правилам: изъяны половинят (каждый), затем +5 за каждое достоинство */
  /** Требуемый УУ: изъяны половинят (каждый), затем +5 за достоинство.
      withUpgrades=false - без качеств, которые станут выбираемыми улучшениями. */
  computedSL({ withUpgrades = true } = {}) {
    const qs = Object.values(this.forge.qualities).filter((x) => x.on);
    const nq = withUpgrades ? qs.length : qs.filter((v) => !(v.extraName || Number(v.extraBp) > 0)).length;
    const nf = Object.values(this.forge.flaws).filter((x) => x.on).length;
    let sl = this.baseSL;
    for (let i = 0; i < nf; i++) sl = sl / 2;
    return Math.max(Math.ceil(sl) + 5 * nq, 1);
  }

  async _prepareContext() {
    const st = this.forge;
    const { qualities, flaws } = propLists(st.type);
    // Подсказка-описание качества/изъяна из конфига системы (наполняет wfrp4e-core)
    const propTip = (key, label) => {
      const c = game.wfrp4e?.config ?? {};
      const raw = c.qualityDescriptions?.[key] ?? c.flawDescriptions?.[key];
      if (!raw) return "";
      const text = game.i18n.localize(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return text ? `${label}\n${text}` : "";
    };
    const row = (map, stateMap) => Object.entries(map).map(([key, label]) => {
      const loc = game.i18n.localize(label);
      return {
        key,
        label: loc,
        tip: propTip(key, loc),
        hasValue: hasValue(key),
        on: !!stateMap[key]?.on,
        value: stateMap[key]?.value ?? 1
      };
    }).sort((a, b) => a.label.localeCompare(b.label, "ru"));

    const qRows = row(qualities, st.qualities).map((r) => ({
      ...r,
      extraName: st.qualities[r.key]?.extraName ?? "",
      extraImg: st.qualities[r.key]?.extraImg ?? "",
      extraCount: st.qualities[r.key]?.extraCount ?? 1,
      extraBp: st.qualities[r.key]?.extraBp ?? 0
    }));
    const fRows = row(flaws, st.flaws);
    // Пул изъянов брака: по умолчанию все отмечены
    const poolRows = Object.entries(flaws).map(([key, label]) => {
      const loc = game.i18n.localize(label);
      return { key, label: loc, tip: propTip(key, loc), on: st.failPool[key] ?? true };
    }).sort((a, b) => a.label.localeCompare(b.label, "ru"));
    const critRows = row(qualities, st.critQualities);

    return {
      st,
      types: FORGE_TYPES.map((t) => ({ key: t, label: L(`WFRPRB.Forge.Type${t === "weapon" ? "Weapon" : t === "armour" ? "Armour" : t === "trapping" ? "Trapping" : "Ammo"}`), selected: st.type === t })),
      trappingTypes: Object.entries(game.wfrp4e?.config?.trappingCategories ?? game.wfrp4e?.config?.trappingTypes ?? {})
        .map(([k, v]) => ({ key: k, label: game.i18n.localize(v), selected: st.trappingType === k })),
      isTrapping: st.type === "trapping",
      qRows, fRows, critRows, poolRows,
      critMulti: Object.values(st.critQualities).filter((x) => x.on).length > 1,
      counts: {
        q: Object.values(st.qualities).filter((x) => x.on).length,
        f: Object.values(st.flaws).filter((x) => x.on).length,
        c: Object.values(st.critQualities).filter((x) => x.on).length,
        x: (st.failFlawed ? 1 : 0) + (st.cleanSL > 0 ? 1 : 0)
      },
      baseSL: this.baseSL,
      prognosis: this.computedSL(),
      coinGc: coinIco("gc"), coinSs: coinIco("ss"), coinBp: coinIco("bp")
    };
  }

  _onRender() {
    const root = this.element;
    root.classList.toggle("rb-theme-dark", game.settings.get(MODULE_ID, "bookTheme") === "dark");
    const st = this.forge;
    const rerender = () => this.render();

    root.querySelector(".rb-forge-type")?.addEventListener("change", (ev) => {
      st.type = ev.currentTarget.value;
      st.qualities = {}; st.flaws = {}; st.critQualities = {}; st.failPool = {};
      rerender();
    });
    root.querySelector(".rb-forge-name")?.addEventListener("change", (ev) => { st.name = ev.currentTarget.value; });
    root.querySelector(".rb-forge-subtype")?.addEventListener("change", (ev) => { st.trappingType = ev.currentTarget.value; });
    root.querySelector(".rb-forge-enc")?.addEventListener("change", (ev) => { st.enc = Math.max(0, Number(ev.currentTarget.value) || 0); });
    for (const [sel, field] of [[".rb-forge-gc", "priceGc"], [".rb-forge-ss", "priceSs"], [".rb-forge-pbp", "priceBp"]]) {
      root.querySelector(sel)?.addEventListener("change", (ev) => { st[field] = Math.max(0, Number(ev.currentTarget.value) || 0); });
    }

    const bindRows = (sel, stateMap, after = rerender) => {
      for (const el of root.querySelectorAll(sel)) {
        const key = el.dataset.key;
        el.querySelector(".rb-prop-on")?.addEventListener("change", (ev) => {
          stateMap[key] = { ...(stateMap[key] ?? {}), on: ev.currentTarget.checked };
          after();
        });
        el.querySelector(".rb-prop-value")?.addEventListener("change", (ev) => {
          stateMap[key] = { ...(stateMap[key] ?? {}), value: Math.max(1, Number(ev.currentTarget.value) || 1) };
        });
        el.querySelector(".rb-extra-count")?.addEventListener("change", (ev) => {
          stateMap[key] = { ...(stateMap[key] ?? {}), extraCount: Math.max(1, Number(ev.currentTarget.value) || 1) };
        });
        el.querySelector(".rb-extra-bp")?.addEventListener("change", (ev) => {
          stateMap[key] = { ...(stateMap[key] ?? {}), extraBp: Math.max(0, Number(ev.currentTarget.value) || 0) };
        });
      }
    };
    bindRows(".rb-qrow", st.qualities);
    bindRows(".rb-frow", st.flaws);
    bindRows(".rb-critrow", st.critQualities);
    for (const el of root.querySelectorAll(".rb-poolrow")) {
      const key = el.dataset.key;
      el.querySelector(".rb-prop-on")?.addEventListener("change", (ev) => { st.failPool[key] = ev.currentTarget.checked; });
    }
    root.querySelector(".rb-forge-critmode")?.addEventListener("change", (ev) => { st.critMode = ev.currentTarget.value; });
    root.querySelector(".rb-forge-critsl")?.addEventListener("change", (ev) => { st.critSL = Math.max(1, Number(ev.currentTarget.value) || 1); });
    root.querySelector(".rb-forge-failflawed")?.addEventListener("change", (ev) => { st.failFlawed = ev.currentTarget.checked; rerender(); });
    root.querySelector(".rb-forge-cleansl")?.addEventListener("change", (ev) => { st.cleanSL = Math.max(0, Number(ev.currentTarget.value) || 0); rerender(); });
  }

  static #onSelectTab(event, target) {
    this.forge.tab = target.dataset.tab;
    this.render();
  }

  /** Общий выпадающий пикер по базе: клик по строке -> cb(entry) */
  async #openForgePicker(anchor, cb) {
    const items = await itemIndex();
    this.element.querySelector(".rb-picker")?.remove();
    const panel = document.createElement("div");
    panel.className = "rb-picker";
    panel.innerHTML = `<input type="text" class="rb-picker-search" placeholder="${esc(L("WFRPRB.Sheet.SearchItem"))}"><div class="rb-picker-list"></div>`;
    anchor.after(panel);
    const list = panel.querySelector(".rb-picker-list");
    const input = panel.querySelector(".rb-picker-search");
    const show = (q) => {
      const n = q.trim().toLowerCase();
      const match = items.filter((i) => !n || i.name.toLowerCase().includes(n)).slice(0, 30);
      list.innerHTML = match.map((i, idx) =>
        `<button type="button" class="rb-picker-row" data-idx="${idx}"><img src="${esc(i.img ?? "")}" alt="">${esc(i.name)}</button>`).join("");
      list.querySelectorAll(".rb-picker-row").forEach((rowEl, idx) => {
        rowEl.addEventListener("click", () => {
          panel.remove();
          cb(match[idx]);
        });
      });
    };
    show("");
    input.addEventListener("input", () => show(input.value));
    input.focus();
  }

  /** Пикер ингредиента для доп. сырья качества */
  static async #onPickExtra(event, target) {
    const key = target.closest(".rb-qrow")?.dataset.key;
    if (!key) return;
    await this.#openForgePicker(target.closest(".rb-qrow"), (e) => {
      this.forge.qualities[key] = {
        ...(this.forge.qualities[key] ?? { on: true }),
        extraName: e.name, extraImg: e.img, extraUuid: e.uuid
      };
      this.render();
    });
  }

  /** Иконка будущего предмета - с любого предмета базы */
  static async #onPickIcon(event, target) {
    await this.#openForgePicker(target.closest(".rb-forge-head"), (e) => {
      this.forge.img = e.img;
      this.render();
    });
  }

  /** Создать предмет мира и обновить рецепт */
  static async #onCreate() {
    const st = this.forge;
    if (!st.name.trim()) return ui.notifications.warn(L("WFRPRB.Forge.NameEmpty"));

    // Качество с доп. сырьём - это УЛУЧШЕНИЕ (игрок выбирает при крафте),
    // остальные качества вшиты в сам предмет
    const isUpgrade = ([, v]) => v.on && (v.extraName || Number(v.extraBp) > 0);
    const qualities = Object.entries(st.qualities).filter(([, v]) => v.on).filter((e) => !isUpgrade(e))
      .map(([name, v]) => ({ name, value: hasValue(name) ? (Number(v.value) || 1) : null }));
    const upgrades = Object.entries(st.qualities).filter(isUpgrade).map(([key, v]) => ({
      quality: key,
      name: propertyLabel(key),
      slBonus: 5,
      moneyBp: Number(v.extraBp) || 0,
      ingredients: v.extraName ? [{ uuid: v.extraUuid ?? "", name: v.extraName, img: v.extraImg ?? "", count: v.extraCount || 1 }] : []
    }));
    const flaws = Object.entries(st.flaws).filter(([, v]) => v.on)
      .map(([name, v]) => ({ name, value: hasValue(name) ? (Number(v.value) || 1) : null }));

    const system = {
      quantity: { value: 1 },
      encumbrance: { value: Number(st.enc) || 0 },
      price: { gc: Number(st.priceGc) || 0, ss: Number(st.priceSs) || 0, bp: Number(st.priceBp) || 0 },
      availability: { value: "common" },
      qualities: { value: qualities },
      flaws: { value: flaws }
    };
    if (st.type === "trapping") system.trappingType = { value: st.trappingType };

    const item = await Item.create({ name: st.name.trim(), type: st.type, img: st.img, system });
    if (!item) return;


    const critQualities = Object.entries(st.critQualities).filter(([, v]) => v.on)
      .map(([name, v]) => ({ name, value: hasValue(name) ? (Number(v.value) || 1) : null }));
    const failPool = Object.entries(propLists(st.type).flaws)
      .filter(([key]) => st.failPool[key] ?? true)
      .map(([key]) => key);

    await this.recipe.update({
      name: F("WFRPRB.Sheet.DefaultName", { name: item.name }),
      "system.result": { uuid: item.uuid, name: item.name, img: item.img, count: this.recipe.system.result.count || 1 },
      "system.slTarget": this.computedSL({ withUpgrades: false }),
      "system.upgrades": upgrades,
      "system.critEnabled": this.recipe.system.critEnabled || critQualities.length > 0,
      "system.critSL": st.critSL,
      "system.critQualities": critQualities,
      "system.critQualMode": st.critMode,
      "system.failFlawed": st.failFlawed,
      "system.cleanSL": st.cleanSL,
      "system.failPool": failPool
    });
    ui.notifications.info(F("WFRPRB.Forge.Created", { name: item.name }));
    await this.close();
    if (globalThis.__RB_MOCK__) this.sheet.render();
    RecipeBookApp.renderAll();
    item.sheet?.render?.(true);
  }
}
