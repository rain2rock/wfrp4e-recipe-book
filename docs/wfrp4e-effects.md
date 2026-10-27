# Применяемые предметы в wfrp4e: как сделать настоящее зелье

> Зачем: мастер «Создать с нуля» сейчас выдаёт предмет без эффектов - его нельзя применить.
> Цель - научить мастер делать зелья, которые работают как настоящие (кнопка на листе персонажа,
> расход одной штуки, эффект на себя или на цель).
>
> Источник: исходники системы `moo-man/WFRP4e-FoundryVTT` и `warhammer-lib`.
> Сверено на теге `9.6.4` и на `master` (10.1.x) - ключевые файлы идентичны, значит верно для 9.x.
> **Всё ниже выведено из кода, руками на живом сервере НЕ проверялось** (чек-лист в конце).

## 1. «Использовать» в системе не существует

У предмета нет ни метода `use`/`consume`, ни пункта в контекстном меню строки инвентаря
(`src/documents/item.js` - только `postItem()`; `src/sheets/actor/base.js` → `_getContextMenuOptions` -
Edit / Post to Chat / Duplicate / Split / Remove). Типа предмета «расходник» в системе тоже нет:
`WFRP4E.trappingTypes` - обычный список строк.

Применение делают **кнопки, которые рисует сам ActiveEffect** в строке предмета на листе персонажа:

- `warhammer-lib/src/document/item.js` → `get sheetButtons()` собирает их из
  `get manualScripts()` (эффекты с `transferData.type == "document"` и элементом `scriptData`
  с `trigger: "manual"`) и из `get testIndependentEffects()` (эффекты `target`/`area`/`zone`
  с `transferData.testIndependent == true`);
- шаблон `static/templates/sheets/partials/sheet-effect-buttons.hbs` включён в
  `actor-inventory.hbs` - то есть кнопки видны прямо в снаряжении;
- клик обрабатывает `warhammer-lib/src/sheets/actor.js` → `_onTriggerScript`:
  либо `effect.manualScripts[i].execute({actor})`, либо `effect.performEffectApplication()`.

**Вывод:** кнопку показывает НЕ тип предмета и НЕ флаг, а наличие эффекта нужной формы.

## 2. Канонический паттерн зелья - два эффекта

Так сделаны зелья в самой системе (скрипты лежат в её папке `scripts/`, пакуются в
`game.wfrp4e.config.effectScripts`).

1. **Нагрузка** - что зелье делает. `transferData.type: "target"`, `scriptData[0].trigger: "immediate"`,
   `options.deleteEffect: true` (сработал - исчез).
2. **Применить** - кнопка. `transferData.type: "document"`, `documentType: "Item"`,
   `scriptData[0].trigger: "manual"`. Скрипт тратит штуку и вешает нагрузку:

```js
if (!this.item.system.quantity.value) return this.script.notification("None left!", "error");
this.item.system.reduceQuantity();
const actor = Array.from(game.user.targets)[0]?.actor || this.actor;
const effectData = this.item.effects.contents[0].convertToApplied();
effectData.system.sourceData.item = this.item.uuid;
actor.applyEffect({ effectData: [effectData] });
```

Важно, почему у кнопки `documentType: "Item"`: `determineTransfer()`
(`warhammer-lib/src/document/effect.js`) переносит эффект на персонажа только при
`type == "document" && documentType == "Actor"`. С `"Item"` эффект остаётся на предмете -
пассивно не работает, но кнопку даёт.

**Вариант без скрипта** (проще, но не тратит количество): один эффект
`transferData: { type: "target", selfOnly: true, testIndependent: true }`, `disabled: false` -
на листе появится кнопка «Apply …», цель при `selfOnly` - сам персонаж.

## 3. Минимальный рабочий JSON (9.x)

```json
{
  "name": "Лечебное зелье",
  "type": "trapping",
  "img": "modules/wfrp4e-recipe-book/assets/icons/healing-draught.png",
  "system": {
    "description": { "value": "<p>...</p>" },
    "quantity": { "value": 1 },
    "encumbrance": { "value": 0 },
    "price": { "gc": 0, "ss": 5, "bp": 0 },
    "availability": { "value": "scarce" },
    "trappingType": { "value": "drugsPoisonsHerbsDraughts" }
  },
  "effects": [
    {
      "name": "Лечебное зелье",
      "type": "base",
      "disabled": false,
      "changes": [],
      "system": {
        "transferData": { "type": "target", "documentType": "Actor", "selfOnly": true },
        "scriptData": [{
          "label": "Лечебное зелье",
          "trigger": "immediate",
          "script": "this.actor.modifyWounds(this.actor.system.characteristics.t.bonus);",
          "options": { "deleteEffect": true }
        }]
      }
    },
    {
      "name": "Применить: Лечебное зелье",
      "type": "base",
      "disabled": false,
      "changes": [],
      "system": {
        "transferData": { "type": "document", "documentType": "Item" },
        "scriptData": [{ "label": "@effect.name", "trigger": "manual", "script": "<код из п.2>" }]
      }
    }
  ]
}
```

Подтип `drugsPoisonsHerbsDraughts` на применение НЕ влияет (только группировка во вкладке
снаряжения), но он правильный по смыслу. Полный список `trappingTypes`:
`clothingAccessories`, `foodAndDrink`, `toolsAndKits`, `booksAndDocuments`, `tradeTools` (не используется),
`drugsPoisonsHerbsDraughts`, `ingredient`, `misc`. Значение валидируется схемой - опечатка уронит создание.

## 4. Грабли (проверено по коду)

- **Тип эффекта обязан быть `base`** - иначе у эффекта нет модели `system` и он упадёт.
- **Не ставить `statuses: ["poisoned"]`** и прочие ключи состояний: `Item._handleConditions()`
  вырежет такой эффект из предмета и повесит условие прямо на персонажа при создании.
- **Не ставить `flags.wfrp4e.lore`** - `removeLoreEffects()` выкинет эффект при создании предмета.
- **Не ссылаться на `[Script.<id>]`** - это таблица скриптов самой системы, id не документированы
  и не стабильны. Свой код писать строкой инлайн.
- **`flags.wfrp4e.applicationData` / `scriptData` - легаси 7.x.** Система их мигрирует в `system.*`
  и удаляет. Писать сразу `system.*`.
- **`flags.wfrp4e.reduceQuantity` ничего не делает** в 9.x: количество уменьшает только скрипт
  через `this.item.system.reduceQuantity()`.
- **`equipTransfer` для зелья бесполезен**: `TrappingModel.canEquip` истинно только для
  `clothingAccessories`, зелье «надеть» нельзя.
- **Триггеры писать современные** (`manual`, `immediate`, `dialog`): старые (`invoke`, `oneTime` и т.п.)
  только мигрируются. Учитывать нормализацию: `addItems → onCreate`, `update → updateDocument`.
- **`immediate`-скрипты выполняются уже в `_preCreate`**: если скрипт вернёт `false`, эффект не создастся.

Система сама перезапишет (передавать бессмысленно): `effects[].transfer`, `origin`, `statuses`,
`transferData.type`/`originalType` (при применении), `sourceData.item`/`actor`/`test`, `duration.*`,
а также весь массив `effects` предмета в `_preCreate`.

## 5. Что из этого следует для модуля (СДЕЛАНО в v0.1.35)

Реализовано: `scripts/item-effects.js` + вкладка «Эффект» в мастере (режимы «без эффекта»,
«готовый эффект», «как у другого предмета»). Ниже - исходный план, он же описание того,
что получилось.


Предмет с такими эффектами **создаётся целиком из данных** обычным `Item.create` - значит мастер
«Создать с нуля» может выдавать рабочие зелья. Крафт при этом менять не нужно: `resultObject()`
делает `toObject()` предмета-источника, то есть копирует эффекты вместе со всем остальным -
скрафченное зелье применяется как оригинал.

**План - вкладка «Эффект» в мастере (`scripts/item-forge.js`):**

1. **Копировать с донора** - выбрать готовое зелье из базы (тем же `openItemPicker`),
   забрать его `effects` как есть. Нулевой риск, работает для всего, что уже есть в мире.
2. **Пресеты по правилам** - собираем оба эффекта по канону из п.2:
   лечение ран (БВ / СЛ+БВ / фикс), снятие состояния, наложение состояния N,
   временный бонус к характеристике на N раундов.
3. **Кнопка «Открыть эффекты»** - штатный редактор Foundry на созданном предмете мира,
   для тонкой настройки после создания.
4. Подтип результата по умолчанию - `drugsPoisonsHerbsDraughts`, если выбран пресет-зелье.

В моке применение НЕ эмулируем (правило проекта: что умеет Foundry - не переписываем),
достаточно показать вкладку и состав будущего предмета.

## 6. Чек-лист живой проверки (ещё НЕ пройден)

- [ ] мастер создал зелье с пресетом - в карточке предмета два эффекта нужной формы;
- [ ] на листе персонажа в снаряжении у зелья появилась кнопка применения;
- [ ] применение сработало: эффект применился, количество уменьшилось на 1;
- [ ] зелье, изготовленное по рецепту, применяется так же, как исходное;
- [ ] вариант «копировать с донора» даёт предмет, неотличимый по поведению от донора.
