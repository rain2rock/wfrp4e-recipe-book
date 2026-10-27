/* Мастер «Создать предмет с нуля» (вызывается из листа рецепта).
   Создаёт НАСТОЯЩИЙ предмет мира с качествами/изъянами системы и настраивает рецепт:
   требуемый УУ по правилам (изъян - вдвое, достоинство +5, стр. 199), доп. сырьё
   за достоинства, крит-качества (И/ИЛИ) и правила брака. */

import { MODULE_ID, difficultyLabel } from "./recipe-model.js";
import { L, F, esc, openItemPicker, propertyLabel, propertyTip, coinIco, isDark, availLabel, moneyHtml, COIN_VALUE, MULTI_LEVEL, RecipeBookApp } from "./recipe-book.js";
import { AVAIL_TO_DIFF } from "./recipe-from-item.js";
import { EFFECT_PRESETS, buildPotionEffects, donorEffects, effectSummary } from "./item-effects.js";

const { ApplicationV2: ForgeAppBase, HandlebarsApplicationMixin: ForgeMixin } = foundry.applications.api;

const FORGE_TYPES = ["weapon", "armour", "trapping", "ammunition"];
const AVAIL_KEYS = Object.keys(AVAIL_TO_DIFF);

/** Состояния и характеристики системы - для пресетов эффектов */
function sysList(key) {
  return Object.entries(game.wfrp4e?.config?.[key] ?? {}).map(([k, v]) => ({ key: k, label: game.i18n.localize(v) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

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
      pickDonor: ItemForgeApp.#onPickDonor,
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
      avail: "common",
      priceGc: 0, priceSs: 0, priceBp: 0,
      qualities: {},   // key -> { on, value, extraName, extraImg, extraUuid, extraCount, extraBp }
      flaws: {},       // key -> { on, value }
      critQualities: {}, // key -> { on, value }
      critMode: "and",
      critSL: Number(this.recipe.system.critSL) || 8,
      failFlawed: false,
      cleanSL: 0,
      failPool: {},    // key -> on (по умолчанию все)
      // Применяемый предмет: nothing | пресет по правилам | копия эффектов донора
      effect: {
        mode: "none",  // none | preset | donor
        preset: "heal",
        healType: "tb", healValue: 4,
        cond: "", condCount: 1,
        charac: "t", bonus: 10, rounds: 6,
        donorName: "", donorImg: "", donorUuid: ""
      },
      tab: "qualities" // активный таб: qualities | flaws | crit | fail | effect
    };
    this.forge = st;
    this.baseSL = Number(this.recipe.system.slTarget) || 1;
  }

  /** Сколько достоинств даёт свойство: у «Прочного» и «Красивого» каждый уровень
      считается отдельным достоинством (стр. 291), у остальных значение - параметр. */
  static qualityWeight(key, state) {
    return MULTI_LEVEL.has(key) ? Math.max(1, Number(state?.value) || 1) : 1;
  }

  /** Требуемый УУ: изъяны половинят (каждый), затем +5 за достоинство.
      withUpgrades=false - без качеств, которые станут выбираемыми улучшениями. */
  computedSL({ withUpgrades = true } = {}) {
    const entries = Object.entries(this.forge.qualities).filter(([, x]) => x.on);
    const counted = withUpgrades ? entries : entries.filter(([, v]) => !(v.extraName || Number(v.extraBp) > 0));
    const nq = counted.reduce((n, [key, v]) => n + ItemForgeApp.qualityWeight(key, v), 0);
    const nf = Object.values(this.forge.flaws).filter((x) => x.on).length;
    let sl = this.baseSL;
    for (let i = 0; i < nf; i++) sl = sl / 2;
    return Math.max(Math.ceil(sl) + 5 * nq, 1);
  }

  async _prepareContext() {
    const st = this.forge;
    const { qualities, flaws } = propLists(st.type);
    // Подсказка-описание качества/изъяна - общая с книгой (propertyTip)
    const propTip = (key, label) => propertyTip(key, label);
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

    const eff = st.effect;
    const conditions = sysList("conditions");
    const characteristics = sysList("characteristics");
    const condLabel = conditions.find((c) => c.key === eff.cond)?.label ?? "";
    const characLabel = characteristics.find((c) => c.key === eff.charac)?.label ?? "";

    return {
      st,
      avails: AVAIL_KEYS.map((k) => ({ key: k, label: availLabel(k), selected: st.avail === k })),
      availDiff: difficultyLabel(AVAIL_TO_DIFF[st.avail]),
      effect: {
        ...eff,
        isPreset: eff.mode === "preset",
        isDonor: eff.mode === "donor",
        isHeal: eff.preset === "heal",
        isCond: eff.preset === "addCondition" || eff.preset === "removeCondition",
        isBonus: eff.preset === "bonus",
        healTB: eff.healType === "tb",
        presets: EFFECT_PRESETS.map((k) => ({ key: k, label: L(`WFRPRB.Effect.Preset.${k}`), selected: eff.preset === k })),
        conditions: conditions.map((c) => ({ ...c, selected: c.key === eff.cond })),
        characteristics: characteristics.map((c) => ({ ...c, selected: c.key === eff.charac })),
        summary: eff.mode === "preset" ? effectSummary(eff, condLabel, characLabel)
          : eff.mode === "donor" && eff.donorName ? F("WFRPRB.Effect.SumDonor", { name: eff.donorName }) : ""
      },
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
        x: (st.failFlawed ? 1 : 0) + (st.cleanSL > 0 ? 1 : 0),
        e: st.effect.mode === "none" ? 0 : 1
      },
      baseSL: this.baseSL,
      prognosis: this.computedSL(),
      // Правила качества предметов (стр. 291): каждое достоинство удваивает цену
      // и снижает доступность на ступень, каждый изъян - наоборот
      quality: (() => {
        const nq = Object.entries(st.qualities).filter(([, x]) => x.on)
          .reduce((n, [key, v]) => n + ItemForgeApp.qualityWeight(key, v), 0);
        const nf = Object.values(st.flaws).filter((x) => x.on).length;
        if (!nq && !nf) return null;
        const bp = (Number(st.priceGc) || 0) * COIN_VALUE.gc + (Number(st.priceSs) || 0) * COIN_VALUE.ss + (Number(st.priceBp) || 0);
        const shift = nq - nf;
        const idx = Math.min(Math.max(AVAIL_KEYS.indexOf(st.avail) + shift, 0), AVAIL_KEYS.length - 1);
        return {
          nq, nf,
          priceHtml: bp ? moneyHtml(Math.round(bp * Math.pow(2, shift))) : "",
          avail: availLabel(AVAIL_KEYS[idx]),
          same: shift === 0
        };
      })(),
      coinGc: coinIco("gc"), coinSs: coinIco("ss"), coinBp: coinIco("bp")
    };
  }

  _onRender() {
    const root = this.element;
    root.classList.toggle("rb-theme-dark", isDark());
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
    // Доступность задаёт сложность броска по правилам - перерисовываем, чтобы показать её сразу
    root.querySelector(".rb-forge-avail")?.addEventListener("change", (ev) => { st.avail = ev.currentTarget.value; rerender(); });
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
    // Вкладка «Эффект»
    const eff = st.effect;
    root.querySelector(".rb-eff-mode")?.addEventListener("change", (ev) => { eff.mode = ev.currentTarget.value; rerender(); });
    root.querySelector(".rb-eff-preset")?.addEventListener("change", (ev) => { eff.preset = ev.currentTarget.value; rerender(); });
    root.querySelector(".rb-eff-healtype")?.addEventListener("change", (ev) => { eff.healType = ev.currentTarget.value; rerender(); });
    root.querySelector(".rb-eff-healvalue")?.addEventListener("change", (ev) => { eff.healValue = Math.max(1, Number(ev.currentTarget.value) || 1); rerender(); });
    root.querySelector(".rb-eff-cond")?.addEventListener("change", (ev) => { eff.cond = ev.currentTarget.value; rerender(); });
    root.querySelector(".rb-eff-condcount")?.addEventListener("change", (ev) => { eff.condCount = Math.max(1, Number(ev.currentTarget.value) || 1); rerender(); });
    root.querySelector(".rb-eff-charac")?.addEventListener("change", (ev) => { eff.charac = ev.currentTarget.value; rerender(); });
    root.querySelector(".rb-eff-bonus")?.addEventListener("change", (ev) => { eff.bonus = Number(ev.currentTarget.value) || 0; rerender(); });
    root.querySelector(".rb-eff-rounds")?.addEventListener("change", (ev) => { eff.rounds = Math.max(1, Number(ev.currentTarget.value) || 1); rerender(); });

    root.querySelector(".rb-forge-failflawed")?.addEventListener("change", (ev) => { st.failFlawed = ev.currentTarget.checked; rerender(); });
    root.querySelector(".rb-forge-cleansl")?.addEventListener("change", (ev) => { st.cleanSL = Math.max(0, Number(ev.currentTarget.value) || 0); rerender(); });
  }

  static #onSelectTab(event, target) {
    this.forge.tab = target.dataset.tab;
    this.render();
  }

  /** Пикер ингредиента для доп. сырья качества */
  static async #onPickExtra(event, target) {
    const key = target.closest(".rb-qrow")?.dataset.key;
    if (!key) return;
    await openItemPicker(target.closest(".rb-qrow"), (e) => {
      this.forge.qualities[key] = {
        ...(this.forge.qualities[key] ?? { on: true }),
        extraName: e.name, extraImg: e.img, extraUuid: e.uuid
      };
      this.render();
    });
  }

  /** Предмет-донор: забираем его эффекты как есть */
  static async #onPickDonor(event, target) {
    await openItemPicker(target.closest(".rb-field"), (e) => {
      Object.assign(this.forge.effect, { donorName: e.name, donorImg: e.img, donorUuid: e.uuid });
      this.render();
    });
  }

  /** Иконка будущего предмета - с любого предмета базы */
  static async #onPickIcon(event, target) {
    await openItemPicker(target.closest(".rb-forge-head"), (e) => {
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
      // Уровень у «Прочного» и «Красивого» игрок выбирает сам, до заданного максимума
      levels: MULTI_LEVEL.has(key) ? Math.max(1, Number(v.value) || 1) : 1,
      moneyBp: Number(v.extraBp) || 0,
      ingredients: v.extraName ? [{ uuid: v.extraUuid ?? "", name: v.extraName, img: v.extraImg ?? "", count: v.extraCount || 1 }] : []
    }));
    const flaws = Object.entries(st.flaws).filter(([, v]) => v.on)
      .map(([name, v]) => ({ name, value: hasValue(name) ? (Number(v.value) || 1) : null }));

    const system = {
      quantity: { value: 1 },
      encumbrance: { value: Number(st.enc) || 0 },
      price: { gc: Number(st.priceGc) || 0, ss: Number(st.priceSs) || 0, bp: Number(st.priceBp) || 0 },
      availability: { value: st.avail },
      qualities: { value: qualities },
      flaws: { value: flaws }
    };
    if (st.type === "trapping") system.trappingType = { value: st.trappingType };

    // Применяемый предмет: два эффекта по контракту системы (docs/wfrp4e-effects.md)
    const name = st.name.trim();
    let effects = [];
    if (st.effect.mode === "preset") effects = buildPotionEffects(st.effect, { name, img: st.img });
    else if (st.effect.mode === "donor") effects = await donorEffects(st.effect.donorUuid);

    const item = await Item.create({ name, type: st.type, img: st.img, system, effects });
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
      // Сложность идёт из доступности по правилам, иначе ГМ молча получил бы не ту проверку
      "system.difficulty": AVAIL_TO_DIFF[st.avail] ?? "challenging",
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
