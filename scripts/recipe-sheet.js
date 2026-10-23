/* Лист рецепта (для ГМа): поля + перетаскивание результата и ингредиентов.
   При дропе результата подставляем сложность по доступности, УУ по цене,
   сырьё = 1/4 цены - по правилам «Создание предмета» (стр. 199). */

import { MODULE_ID, FALLBACK_DIFFICULTIES } from "./recipe-model.js";
import { ItemForgeApp } from "./item-forge.js";
import { L, F, esc, COIN_VALUE, coinIco, skillNames, itemIndex, openItemPicker, openNamePicker, closeNamePicker, RecipeBookApp } from "./recipe-book.js";
import { suggestFromItem } from "./recipe-from-item.js";

const RBSheetMixin = foundry.applications.api.HandlebarsApplicationMixin;
const ItemSheetV2 = foundry.applications.sheets.ItemSheetV2;

export class RecipeSheet extends RBSheetMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["wfrp-recipe-book", "rb-sheet"],
    position: { width: 540, height: 660 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      removeIngredient: RecipeSheet.#onRemoveIngredient,
      removeTool: RecipeSheet.#onRemoveTool,
      addItem: RecipeSheet.#onAddItem,
      pickImage: RecipeSheet.#onPickImage,
      pickResultIcon: RecipeSheet.#onPickResultIcon,
      openForge: RecipeSheet.#onOpenForge,
      saveSheet: RecipeSheet.#onSave,
      saveAsNew: RecipeSheet.#onSaveAsNew,
      cancelSheet: RecipeSheet.#onCancel
    }
  };

  static PARTS = { sheet: { template: `modules/${MODULE_ID}/templates/recipe-sheet.hbs`, scrollable: [".rb-sheet-scroll"] } };

  /** Перерисовка после update: в живом Foundry лист перерисовывает ЯДРО (DocumentSheetV2
      слушает документ) - наша вторая перерисовка гонялась с ней и сбрасывала скролл.
      Вручную рендерим только в моке, где автоперерисовки нет. */
  #refresh() {
    if (globalThis.__RB_MOCK__) this.render();
  }

  /** Рецепт создан с нуля и ещё ни разу не сохранён */
  get isFresh() {
    return !!this.document.getFlag?.("wfrp4e-recipe-book", "fresh");
  }

  /** Заголовок окна - только имя рецепта (иначе Foundry добавляет тип: «Recipe: Recipe: ...») */
  get title() {
    return this.document?.name ?? super.title;
  }

  async _prepareContext() {
    const sys = this.document.system;
    // Навыки из базы (мир + компендиумы + персонажи) - для комбобокса с поиском
    const names = [...await skillNames()];
    for (const v of [sys.skill, sys.skillAlt]) if (v && !names.includes(v)) names.unshift(v);
    return {
      item: this.document,
      sys,
      editable: this.isEditable,
      fresh: this.isFresh,
      critMulti: [sys.critExtra, sys.critUpgrade, sys.critRefund].filter(Boolean).length > 1,
      skills: names.map((n) => ({ name: n })),
      moneyGc: Math.floor((sys.moneyBp || 0) / COIN_VALUE.gc),
      moneySs: Math.floor(((sys.moneyBp || 0) % COIN_VALUE.gc) / COIN_VALUE.ss),
      moneyBpRest: (sys.moneyBp || 0) % COIN_VALUE.ss,
      coinGc: coinIco("gc"), coinSs: coinIco("ss"), coinBp: coinIco("bp"),
      difficulties: Object.keys(game.wfrp4e?.config?.difficultyLabels ?? FALLBACK_DIFFICULTIES).map((k) => ({
        key: k,
        label: game.wfrp4e?.config?.difficultyLabels?.[k] ? game.i18n.localize(game.wfrp4e.config.difficultyLabels[k]) : game.i18n.localize(FALLBACK_DIFFICULTIES[k]?.label ?? k),
        selected: sys.difficulty === k
      }))
    };
  }

  /** Снимок на момент открытия - для «Отмены» и «Сохранить как новый» */
  #snapshot() {
    const o = this.document.toObject();
    return { name: o.name, img: o.img, system: foundry.utils?.deepClone?.(o.system) ?? JSON.parse(JSON.stringify(o.system)) };
  }

  async #revert() {
    if (!this._snap) return;
    await this.document.update({ name: this._snap.name, img: this._snap.img, system: this._snap.system });
  }

  static async #onSave() {
    if (this.isFresh) {
      // Рецепт создан из книги игрока - спросить, выдать ли его этому игроку
      const uuid = this.document.getFlag("wfrp4e-recipe-book", "forActor");
      const actor = uuid ? await fromUuid(uuid).catch(() => null) : null;
      if (actor?.hasPlayerOwner) {
        const choice = await foundry.applications.api.DialogV2.wait({
          window: { title: L("WFRPRB.Give.Title") },
          content: `<p>${F("WFRPRB.Give.Ask", { name: esc(actor.name) })}</p>`,
          buttons: [
            { action: "give", label: L("WFRPRB.Give.Give"), default: true },
            { action: "keep", label: L("WFRPRB.Give.Keep") },
            { action: "cancel", label: L("WFRPRB.Sheet.Cancel") }
          ]
        }).catch(() => "cancel");
        if (choice === "cancel") return; // вернуться к созданию рецепта
        if (choice === "give") {
          const obj = this.document.toObject();
          delete obj._id;
          obj.flags ??= {};
          obj.flags["wfrp4e-recipe-book"] = {
            ...(obj.flags["wfrp4e-recipe-book"] ?? {}),
            fresh: false, forActor: undefined, isNew: true, source: this.document.uuid
          };
          await actor.createEmbeddedDocuments("Item", [obj]);
          ui.notifications.info(F("WFRPRB.World.Given", { name: this.document.name, actor: actor.name }));
        }
      }
      await this.document.unsetFlag("wfrp4e-recipe-book", "fresh");
      await this.document.setFlag("wfrp4e-recipe-book", "isNew", true);
    }
    this._snap = null;
    await this.close();
  }

  static async #onSaveAsNew() {
    const o = this.document.toObject();
    const data = { name: o.name, type: o.type, img: o.img, system: o.system };
    await this.#revert();           // исходный рецепт остаётся как был
    this._snap = null;
    await this.close();
    const made = await Item.create(data);
    made?.sheet?.render(true);
  }

  static async #onCancel() {
    if (this.isFresh) {
      // Отмена создания с нуля - недосозданный рецепт удаляется целиком
      this._deleted = true;
      await this.close();
      await this.document.delete();
      RecipeBookApp?.renderAll?.();
      return;
    }
    await this.#revert();
    this._snap = null;
    await this.close();
  }

  _onRender() {
    const root = this.element;
    this._snap ??= this.#snapshot();
    // Имя результата можно вписать руками. Если имя совпадает с предметом базы -
    // привязываем его (защита от «удалил название и вписал такое же»), иначе это
    // полностью НОВЫЙ предмет: uuid пуст, создастся при завершении крафта
    root.querySelector(".rb-result-name")?.addEventListener("change", async (ev) => {
      const name = ev.currentTarget.value.trim();
      const known = (await itemIndex()).find((i) => i.name.trim().toLowerCase() === name.toLowerCase());
      await this.document.update(known
        ? { "system.result": { ...this.document.system.result, name: known.name, uuid: known.uuid, img: known.img } }
        : { "system.result.name": name, "system.result.uuid": "" });
      this.#refresh();
    });
    for (const zone of root.querySelectorAll("[data-dropzone]")) {
      zone.addEventListener("dragover", (ev) => ev.preventDefault());
      zone.addEventListener("drop", (ev) => this.#onDrop(ev, zone.dataset.dropzone));
    }
    // Критический успех: галка, порог, режим, количество (как деньги - пишем сами)
    root.querySelector(".rb-crit-on")?.addEventListener("change", (ev) => {
      this.document.update({ "system.critEnabled": ev.currentTarget.checked }).then(() => this.#refresh());
    });
    root.querySelector(".rb-crit-sl")?.addEventListener("change", (ev) => {
      this.document.update({ "system.critSL": Math.max(1, Number(ev.currentTarget.value) || 1) });
    });
    for (const [sel, field] of [[".rb-crit-extra", "critExtra"], [".rb-crit-upgrade", "critUpgrade"], [".rb-crit-refund", "critRefund"], [".rb-crit-random", "critRandom"]]) {
      root.querySelector(sel)?.addEventListener("change", (ev) => {
        this.document.update({ [`system.${field}`]: ev.currentTarget.checked }).then(() => this.#refresh());
      });
    }
    root.querySelector(".rb-crit-count")?.addEventListener("change", (ev) => {
      this.document.update({ "system.critCount": Math.max(1, Number(ev.currentTarget.value) || 1) });
    });

    // Навыки: поле со своим выпадающим списком (нативный datalist не прокручивается)
    for (const [sel, field] of [[".rb-skill-input", "skill"], [".rb-skillalt-input", "skillAlt"]]) {
      const input = root.querySelector(sel);
      if (!input) continue;
      const save = (value) => this.document.update({ [`system.${field}`]: value.trim() }).then(() => this.#refresh());
      const openList = async (query) => {
        this._skillNames ??= await skillNames();
        openNamePicker(input, this._skillNames, (name) => { input.value = name; save(name); }, { query });
      };
      // По клику показываем весь список, фильтруем только при наборе текста
      input.addEventListener("focus", () => openList(""));
      input.addEventListener("input", () => openList(input.value));
      input.addEventListener("change", (ev) => save(ev.currentTarget.value));
      input.addEventListener("blur", () => setTimeout(() => closeNamePicker(input), 150));
      input.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeNamePicker(input); });
    }

    // Время: часы не больше 23, минуты не больше 59 - подрезаем и пишем одним апдейтом
    const clamp = (v, max) => Math.max(0, Math.min(Number(v) || 0, max));
    const syncTime = () => {
      const g = (sel) => root.querySelector(sel);
      const d = clamp(g(".rb-time-d")?.value, 9999);
      const h = clamp(g(".rb-time-h")?.value, 23);
      const m = clamp(g(".rb-time-m")?.value, 59);
      this.document.update({ "system.timeDays": d, "system.timeHours": h, "system.timeMinutes": m }).then(() => this.#refresh());
    };
    for (const sel of [".rb-time-d", ".rb-time-h", ".rb-time-m"])
      root.querySelector(sel)?.addEventListener("change", syncTime);

    // Деньги: три поля номиналов складываем в пенни
    const sync = () => {
      const v = (sel) => Number(root.querySelector(sel)?.value) || 0;
      const bp = v(".rb-money-gc") * COIN_VALUE.gc + v(".rb-money-ss") * COIN_VALUE.ss + v(".rb-money-bp");
      this.document.update({ "system.moneyBp": bp });
    };
    for (const sel of [".rb-money-gc", ".rb-money-ss", ".rb-money-bp"])
      root.querySelector(sel)?.addEventListener("change", sync);
  }

  async #onDrop(event, zone) {
    event.preventDefault();
    if (!this.isEditable) return;
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
    if (data?.type !== "Item" || !data.uuid) return;
    const doc = await fromUuid(data.uuid).catch(() => null);
    if (!doc) return;
    if (zone === "result") {
      return this.#applyResult(doc);
    } else if (zone === "critResult") {
      await this.document.update({ "system.critResult": { uuid: doc.uuid, name: doc.name, img: doc.img } });
      this.#refresh();
    } else if (zone === "tools") {
      const list = [...this.document.system.tools];
      if (!list.find((t) => t.name === doc.name)) list.push({ uuid: doc.uuid, name: doc.name, img: doc.img });
      await this.document.update({ "system.tools": list });
      this.#refresh();
    } else if (zone === "ingredients") {
      const list = [...this.document.system.ingredients];
      const found = list.find((i) => i.name === doc.name);
      if (found) found.count += 1;
      else list.push({ uuid: doc.uuid, name: doc.name, img: doc.img, count: 1 });
      await this.document.update({ "system.ingredients": list });
      this.#refresh();
    }
  }

  /** Результат из предмета базы: заполняет поля и подсказки по правилам (стр. 199) */
  async #applyResult(doc) {
    const sug = suggestFromItem(doc);
    await this.document.update({
      name: game.i18n.format("WFRPRB.Sheet.DefaultName", { name: doc.name }),
      "system.result": { uuid: doc.uuid, name: doc.name, img: doc.img, count: this.document.system.result.count || 1 },
      "system.difficulty": sug.difficulty,
      "system.slTarget": sug.slTarget,
      "system.moneyBp": sug.moneyBp
    });
    this.#refresh();
  }

  /** Добавить найденный предмет в нужную зону */
  async #applyPick(zone, entry) {
    if (zone === "icon") {
      // Иконка РЕЦЕПТА (книжки в списке); иконка результата - своя, с предмета-результата
      await this.document.update({ img: entry.img });
    } else if (zone === "critResult") {
      await this.document.update({ "system.critResult": { uuid: entry.uuid, name: entry.name, img: entry.img } });
      this.#refresh();
    } else if (zone === "resultIcon") {
      // Иконка ПРЕДМЕТА-РЕЗУЛЬТАТА: для нового предмета её выбирают из базы
      await this.document.update({ "system.result.img": entry.img });
      this.#refresh();
    } else if (zone === "result") {
      const doc = await fromUuid(entry.uuid).catch(() => null);
      if (doc) return this.#applyResult(doc);
    } else if (zone === "ingredients") {
      const list = [...this.document.system.ingredients];
      const found = list.find((i) => i.name === entry.name);
      if (found) found.count += 1;
      else list.push({ uuid: entry.uuid, name: entry.name, img: entry.img, count: 1 });
      await this.document.update({ "system.ingredients": list });
    } else if (zone === "tools") {
      const list = [...this.document.system.tools];
      if (!list.find((t) => t.name === entry.name)) list.push({ uuid: entry.uuid, name: entry.name, img: entry.img });
      await this.document.update({ "system.tools": list });
    }
    this.#refresh();
  }

  /** Выпадающий поиск по базе - общий помощник ядра */
  async #openPicker(zone, anchor) {
    this.#closePicker();
    this._picker = await openItemPicker(anchor, (entry) => { this._picker = null; this.#applyPick(zone, entry); });
    setTimeout(() => {
      this._pickerAway = (ev) => { if (!this._picker?.contains(ev.target)) this.#closePicker(); };
      document.addEventListener("pointerdown", this._pickerAway);
    }, 0);
  }

  #closePicker() {
    this._picker?.remove();
    this._picker = null;
    if (this._pickerAway) {
      document.removeEventListener("pointerdown", this._pickerAway);
      this._pickerAway = null;
    }
  }

  static async #onAddItem(event, target) {
    await this.#openPicker(target.dataset.zone, target.closest(".rb-block-title"));
  }

  static async #onRemoveIngredient(event, target) {
    const list = [...this.document.system.ingredients];
    list.splice(Number(target.dataset.index), 1);
    await this.document.update({ "system.ingredients": list });
    this.#refresh();
  }

  static async #onRemoveTool(event, target) {
    const list = [...this.document.system.tools];
    list.splice(Number(target.dataset.index), 1);
    await this.document.update({ "system.tools": list });
    this.#refresh();
  }

  async close(options) {
    // Закрытие крестиком = сохранить: свежий рецепт перестаёт быть «свежим»
    if (!this._deleted && this.isFresh) {
      await this.document.unsetFlag?.("wfrp4e-recipe-book", "fresh");
      await this.document.setFlag?.("wfrp4e-recipe-book", "isNew", true);
    }
    this._snap = null;
    this.#closePicker();
    return super.close(options);
  }

  static async #onPickImage(event, target) {
    await this.#openPicker("icon", target.closest(".rb-sheet-head"));
  }

  /** Мастер «Создать предмет с нуля» */
  static async #onOpenForge() {
    new ItemForgeApp(this).render(true);
  }

  static async #onPickResultIcon(event, target) {
    await this.#openPicker("resultIcon", target.closest(".rb-row"));
  }
}
