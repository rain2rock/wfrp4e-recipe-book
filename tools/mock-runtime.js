/* ==========================================================
   Мини-«Foundry» для мока книги рецептов в браузере.
   По образцу wfrp4e-paperdoll/tools/mock-runtime.js: ровно столько API,
   сколько нужно настоящему коду модуля. Броски extendedTest эмулируются
   (в живом Foundry их делает система WFRP4e).
   ========================================================== */
(() => {
  window.__RB_MOCK__ = true; // в моке нет автоперерисовки листов - модуль перерисовывает сам
  const LANG = window.__RB_LANG__;
  const lookup = (key) => key.split(".").reduce((o, p) => (o == null ? undefined : o[p]), LANG);
  const i18n = {
    lang: "ru",
    has: (k) => typeof lookup(k) === "string",
    localize: (k) => {
      const v = lookup(k);
      return typeof v === "string" ? v : k;
    },
    format: (k, data = {}) => i18n.localize(k).replace(/\{(\w+)\}/g, (_, x) => data[x] ?? "")
  };

  const toast = (msg, kind = "warn") => {
    const t = document.createElement("div");
    t.className = `mock-toast mock-toast--${kind}`;
    t.textContent = msg;
    document.body.append(t);
    setTimeout(() => t.remove(), 3000);
  };
  window.ui = { notifications: { warn: (m) => toast(m), error: (m) => toast(m), info: (m) => toast(m, "info") } };

  const hooks = new Map();
  let hookId = 0;
  window.Hooks = {
    on(name, fn) {
      const id = ++hookId;
      if (!hooks.has(name)) hooks.set(name, new Map());
      hooks.get(name).set(id, fn);
      return id;
    },
    once(name, fn) {
      const id = this.on(name, (...a) => { this.off(name, id); fn(...a); });
      return id;
    },
    off(name, id) { hooks.get(name)?.delete(id); },
    call(name, ...args) { for (const fn of [...(hooks.get(name)?.values() ?? [])]) fn(...args); },
    callAll(name, ...args) { this.call(name, ...args); }
  };

  Handlebars.registerHelper("localize", (k) => i18n.localize(k));
  const templates = {};
  for (const [path, src] of Object.entries(window.__RB_TEMPLATES__)) templates[path] = Handlebars.compile(src);

  /* --- ApplicationV2 (минимум, как в paperdoll) --- */
  class ApplicationV2 {
    constructor(options = {}) {
      const chain = [];
      let c = this.constructor;
      while (c && c !== Object && c !== Function.prototype) {
        if (Object.hasOwn(c, "DEFAULT_OPTIONS")) chain.unshift(c.DEFAULT_OPTIONS);
        c = Object.getPrototypeOf(c);
      }
      const merged = { actions: {}, window: {}, position: {}, classes: [] };
      for (const o of [...chain, options]) {
        Object.assign(merged.actions, o.actions ?? {});
        Object.assign(merged.window, o.window ?? {});
        Object.assign(merged.position, o.position ?? {});
        merged.classes.push(...(o.classes ?? []));
        if (o.id) merged.id = o.id;
      }
      this.options = merged;
      this.element = null;
      this.rendered = false;
    }
    get title() { return ""; }
    // как в живом AppV2: state - только геттер (ловим коллизии имён полей с ядром)
    get state() { return 2; }
    async render() {
      const ctx = await this._prepareContext({});
      if (!this.element) this._buildFrame();
      const content = this.element.querySelector(".window-content");
      const scrollSel = Object.values(this.constructor.PARTS ?? {}).flatMap((p) => p.scrollable ?? []);
      const scrollKeep = scrollSel.map((s) => [s, content.querySelector(s)?.scrollTop ?? 0]);
      const part = Object.values(this.constructor.PARTS)[0];
      content.innerHTML = templates[part.template](ctx);
      for (const [s, top] of scrollKeep) { const el = content.querySelector(s); if (el) el.scrollTop = top; }
      this.element.querySelector(".window-title").textContent = this.title || i18n.localize(this.options.window.title ?? "");
      this.rendered = true;
      await this._onRender(ctx, {});
      return this;
    }
    _buildFrame() {
      const el = document.createElement("div");
      el.className = ["application", "app", "window-app", ...this.options.classes].join(" ");
      if (this.options.id) el.id = this.options.id;
      el.style.width = `${this.options.position.width}px`;
      el.style.height = `${this.options.position.height}px`;
      el.innerHTML = `
        <header class="window-header">
          <span class="window-title"></span>
          <button type="button" class="header-control" data-mock-close title="Закрыть"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <section class="window-content"></section>`;
      el.querySelector("[data-mock-close]").addEventListener("click", () => this.close());
      el.addEventListener("click", (ev) => {
        const target = ev.target.closest("[data-action]");
        if (!target || !el.contains(target)) return;
        const handler = this.options.actions[target.dataset.action];
        if (handler) handler.call(this, ev, target);
      });
      document.getElementById("mock-mount").append(el);
      this.element = el;
    }
    bringToFront() {}
    async close() {
      await this._onClose?.({});
      this.element?.remove();
      this.element = null;
      this.rendered = false;
    }
    async _prepareContext() { return {}; }
    async _onRender() {}
  }

  class ItemSheetV2 extends ApplicationV2 {
    constructor(options = {}) {
      super(options);
      this.document = options.document;
    }
    get isEditable() { return true; }
    get item() { return this.document; }
  }

  window.CONFIG = { Item: { dataModels: {} } };
  window.CONST = { KEYBINDING_PRECEDENCE: { NORMAL: 0 } };
  // Рецепты мира: как во вкладке «Предметы» Foundry (FakeItem без актёра, попадает в game.items)
  window.Item = class {
    static async create(data) {
      const d = { ...(Array.isArray(data) ? data[0] : data) };
      // В живом Foundry дефолты полей даёт DataModel рецепта - в моке подставляем их руками
      if (d.type === "wfrp4e-recipe-book.recipe") {
        d.system = {
          result: { uuid: "", name: "", img: "", count: 1 }, skill: "", skillAlt: "",
          difficulty: "average", slTarget: 5, ingredients: [], moneyBp: 0,
          needsWorkshop: false, tools: [], timeDays: 0, timeHours: 0, timeMinutes: 0,
          description: { value: "" }, gmdescription: { value: "" }, ...(d.system ?? {})
        };
      }
      // Как в Foundry: Item.create делает предмет МИРА (вкладка «Предметы»)
      const made = new FakeItem(null, d);
      game.items.push(made);
      Hooks.call("createItem", made, {}, game.user.id);
      return made;
    }
  };
  window.canvas = { tokens: { controlled: [] } };

  const fieldStub = class { constructor(o) { this.o = o; } };
  window.foundry = {
    abstract: { TypeDataModel: class {} },
    data: { fields: new Proxy({}, { get: () => fieldStub }) },
    utils: {
      escapeHTML: (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
      debounce: (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
    },
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: (Base) => class extends Base {},
        DialogV2: {
          confirm: async () => window.__RB_CONFIRM__ ?? true,
          wait: async () => window.__RB_DIALOG_CHOICE__ ?? "keep"
        }
      },
      sheets: { ItemSheetV2 },
      apps: { DocumentSheetConfig: { registerSheet() {} } }
    }
  };

  /* --- Документы --- */

  const setPath = (obj, path, value) => {
    const parts = path.split(".");
    let o = obj;
    for (const p of parts.slice(0, -1)) o = o[p] ??= {};
    o[parts.at(-1)] = value;
  };
  const flatten = (obj, prefix = "", out = {}) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = v;
    }
    return out;
  };

  class FakeItem {
    constructor(actor, data) {
      this.parent = actor;
      this.id = data.id ?? `it-${Math.random().toString(36).slice(2, 9)}`;
      this.name = data.name;
      this.img = data.img ?? window.__RB_ICON__?.(data.name, data.type) ?? "";
      this.type = data.type;
      this.system = structuredClone(data.system ?? {});
      this.flags = structuredClone(data.flags ?? {});
    }
    get uuid() { return this.parent ? `Actor.${this.parent.id}.Item.${this.id}` : `Item.${this.id}`; }
    get actor() { return this.parent; }
    get sheet() {
      if (this.type === "wfrp4e-recipe-book.recipe" && window.RB?.RecipeSheet) {
        this._sheet ??= new window.RB.RecipeSheet({ document: this, id: `rb-sheet-${this.id}` });
        return this._sheet;
      }
      return { render: () => toast(`В Foundry тут откроется лист «${this.name}»`, "info") };
    }
    getFlag(scope, key) {
      return key.split(".").reduce((o, p) => (o == null ? undefined : o[p]), this.flags?.[scope]);
    }
    async unsetFlag(scope, key) {
      if (this.flags?.[scope]) delete this.flags[scope][key];
      return this;
    }
    toObject() {
      return JSON.parse(JSON.stringify({ name: this.name, type: this.type, img: this.img, system: this.system, flags: this.flags }));
    }
    async update(changes) {
      for (const [k, v] of Object.entries(flatten(changes))) setPath(this, k, v);
      this.parent?.prepare();
      Hooks.call("updateItem", this, changes, {}, game.user.id);
      return this;
    }
    async delete() {
      const list = this.parent ? this.parent.items : game.items;
      const i = list.indexOf(this);
      if (i >= 0) list.splice(i, 1);
      Hooks.call("deleteItem", this, {}, game.user.id);
    }
  }

  class FakeActor {
    constructor(data) {
      this.id = data.id;
      this.name = data.name;
      this.img = data.img ?? "";
      this.type = data.type ?? "character";
      this.isOwner = true;
      this.hasPlayerOwner = data.hasPlayerOwner ?? true;
      this.system = structuredClone(data.system ?? { characteristics: {} });
      const arr = (data.items ?? []).map((d) => new FakeItem(this, d));
      arr.get = (id) => arr.find((i) => i.id === id);
      this.items = arr;
      this.prepare();
    }
    get uuid() { return `Actor.${this.id}`; }
    prepare() {
      for (const i of this.items) {
        if (i.type !== "skill") continue;
        const ch = this.system.characteristics?.[i.system.characteristic?.value ?? "dex"];
        i.system.total = { value: (ch?.value ?? 0) + (Number(i.system.advances?.value) || 0) };
      }
    }
    async createEmbeddedDocuments(type, list) {
      const made = list.map((d) => new FakeItem(this, JSON.parse(JSON.stringify(d))));
      this.items.push(...made);
      this.prepare();
      for (const m of made) Hooks.call("createItem", m, {}, game.user.id);
      return made;
    }
    async updateEmbeddedDocuments(type, updates) {
      for (const u of updates) {
        const { _id, ...rest } = u;
        const it = this.items.get(_id);
        if (it) {
          for (const [k, v] of Object.entries(flatten(rest))) setPath(it, k, v);
          Hooks.call("updateItem", it, rest, {}, game.user.id);
        }
      }
      this.prepare();
    }
    async deleteEmbeddedDocuments(type, ids) {
      for (const id of [...ids]) await this.items.get(id)?.delete();
    }
    /**
     * Эмуляция системного броска продолжительной проверки.
     * В живом Foundry это actor.setupExtendedTest: диалог, кубы и УУ считает система.
     * Здесь: цель = навык + модификатор сложности, d100, УУ = десятки цели - десятки броска.
     */
    async setupExtendedTest(test) {
      const diff = window.__RB_CONFIG__.difficultyModifiers[test.system.difficulty?.value] ?? 0;
      const skillName = String(test.system.test?.value ?? "").trim().toLowerCase();
      const skill = this.items.find((i) => i.type === "skill" && i.name.trim().toLowerCase() === skillName);
      const target = (skill ? skill.system.total.value : 0) + diff;
      const roll = window.__RB_FORCE_ROLL__ ?? 1 + Math.floor(Math.random() * 100);
      let SL = Math.floor(target / 10) - Math.floor(roll / 10);
      if (roll <= target && SL < 1) SL = 1;
      if (roll > target && SL > -1) SL = -1;
      toast(`${test.system.test.value}: бросок ${roll} против ${target}, УУ ${SL >= 0 ? "+" : ""}${SL}`, "info");
      const cur = (Number(test.system.SL?.current) || 0) + SL;
      await test.update({ "system.SL.current": cur });
      return { context: { rolled: true } };
    }
  }

  /* --- Мир --- */

  window.__RB_worldItems__ = [];
  window.fromUuid = async (uuid) => {
    for (const w of window.__RB_worldItems__) if (w.uuid === uuid) return w;
    for (const w of game?.items ?? []) if (w.uuid === uuid) return w;
    for (const a of window.__RB_actors__ ?? []) {
      if (a.uuid === uuid) return a;
      const item = a.items.find((i) => i.uuid === uuid);
      if (item) return item;
    }
    return null;
  };

  window.fromUuidSync = (uuid) => {
    for (const w of window.__RB_worldItems__) if (w.uuid === uuid) return w;
    for (const w of game?.items ?? []) if (w.uuid === uuid) return w;
    for (const a of window.__RB_actors__ ?? []) {
      const item = a.items.find((i) => i.uuid === uuid);
      if (item) return item;
    }
    return null;
  };

  window.__RB_makeWorldItem__ = (data) => {
    const obj = {
      uuid: `Item.${data.id}`,
      name: data.name,
      type: data.type ?? "trapping",
      img: data.img ?? window.__RB_ICON__?.(data.name, data.type) ?? "",
      system: data.system ?? { quantity: { value: 1 } },
      toObject() { return JSON.parse(JSON.stringify({ name: this.name, type: this.type, img: this.img, system: this.system })); },
      sheet: { render: () => toast(`В Foundry тут откроется «${data.name}»`, "info") }
    };
    window.__RB_worldItems__.push(obj);
    return obj;
  };

  window.__RB_makeActor__ = (data) => {
    const actor = new FakeActor(data);
    (window.__RB_actors__ ??= []).push(actor);
    return actor;
  };

  window.game = {
    i18n,
    system: { id: "wfrp4e" },
    user: { id: "u1", isGM: true, character: null },
    wfrp4e: { config: window.__RB_CONFIG__ },
    keybindings: { register() {} },
    settings: {
      _values: {},
      settings: new Map(),
      register(ns, key, def) {
        const full = `${ns}.${key}`;
        this.settings.set(full, def);
        if (!(full in this._values)) this._values[full] = def.default;
      },
      registerMenu() {},
      get(ns, key) { return this._values[`${ns}.${key}`]; },
      async set(ns, key, value) {
        this._values[`${ns}.${key}`] = value;
        this.settings.get(`${ns}.${key}`)?.onChange?.(value);
        return value;
      }
    },
    actors: Object.defineProperty(
      { get: (id) => (window.__RB_actors__ ?? []).find((a) => a.id === id) ?? null },
      "contents", { get: () => [...(window.__RB_actors__ ?? [])] }
    ),
    items: [],
    packs: [{
      documentName: "Item",
      async getIndex() { return (window.__RB_SKILLS__ ?? []).map((n, i) => ({ _id: `sk${i}`, name: n, type: "skill" })); }
    }, {
      documentName: "Item",
      async getIndex() {
        return (window.__RB_worldItems__ ?? []).map((w, i) => ({ _id: `wi${i}`, name: w.name, img: w.img, type: w.type, uuid: w.uuid }));
      }
    }],
    modules: new Map([["wfrp4e-recipe-book", {}]])
  };

  const chatLog = [];
  window.__RB_chat__ = chatLog;
  window.ChatMessage = {
    getSpeaker: ({ actor } = {}) => ({ alias: actor?.name }),
    create: async (d) => {
      chatLog.push(d);
      const box = document.getElementById("mock-chat");
      if (box) {
        const m = document.createElement("div");
        m.className = "mock-chat-msg";
        m.innerHTML = d.content;
        box.append(m);
      }
      return d;
    }
  };
})();
