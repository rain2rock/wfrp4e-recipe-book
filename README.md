# WFRP Paperdoll Recipe Book (Книга рецептов WFRP)

Модуль Foundry VTT для системы Warhammer Fantasy Roleplay 4e: крафт по рецептам, книга рецептов на листе персонажа и автоматизация продолжительных проверок.

## Установка

**Manifest URL** (вставь в Foundry: «Модули» → «Установить модуль» → поле «URL манифеста» внизу):

```
https://github.com/rain2rock/wfrp4e-recipe-book/releases/latest/download/module.json
```

Затем зайди в мир → «Настройки игры» → «Управление модулями» → включи «Книга рецептов WFRP».
Обновления Foundry подтянет сам по этой же ссылке.

Ссылка `github.com/.../blob/main/module.json` не подойдёт: это страница сайта, а не файл.

Вручную: скачай `module.zip` из [последнего релиза](https://github.com/rain2rock/wfrp4e-recipe-book/releases/latest)
и распакуй в `Data/modules/wfrp4e-recipe-book/` (внутри сразу должен лежать `module.json`).

![Скриншот книги рецептов](docs/screenshot.png)

## Возможности

- Крафт по правилам «Создание предмета» (Книга правил, стр. 199) и продолжительных проверок (стр. 154).
- Рецепт - это предмет нового типа. Перетащи рецепт на персонажа - он выучен и появляется в книге.
- Книга рецептов открывается по горячей клавише **B** или кнопкой в шапке листа персонажа.
- Слева - известные рецепты с поиском и фильтрами (все / могу сделать / в работе). Доступные к изготовлению подсвечены.
- Справа - разворот рецепта: результат, ингредиенты (видно, чего не хватает), навык и шанс, требуемый уровень успеха, стоимость сырья, кнопка «Создать».
- Все броски делает сама система WFRP4e: крафт-проект - это системная продолжительная проверка (extended test) на персонаже. Модуль только списывает ингредиенты и деньги, следит за прогрессом и выдаёт готовый предмет.
- Учитываются правила: сложность по доступности, требуемый УУ по цене, талант «Мастер своего дела» снижает цель.
- Провал (суммарный УУ ниже нуля) - сырьё теряется: ничего / половина / всё (настройка мира).

## Как играть игроку

1. Получи рецепт от ГМа и перетащи его на своего персонажа - рецепт выучен.
2. Открой книгу рецептов клавишей **B** или кнопкой в шапке листа персонажа.
3. Найди нужный рецепт через поиск или фильтры. Доступные к изготовлению подсвечены.
4. Открой разворот рецепта: проверь ингредиенты, навык, шанс и требуемый уровень успеха.
5. Нажми «Создать» - модуль спишет ингредиенты и деньги и запустит системную продолжительную проверку.
6. Следи за прогрессом в книге. Когда проект завершён, готовый предмет появится у персонажа.

## Как создавать рецепты ГМу

1. Открой вкладку «Предметы» и нажми «Создать».
2. Выбери тип «Книга рецептов WFRP: Рецепт».
3. В листе рецепта перетащи предмет-результат и ингредиенты в соответствующие поля.
4. Укажи навык, сложность и прочие параметры рецепта.
5. Выдай рецепт игрокам - перетащив его на персонажа или через журнал.

## Настройки

- Что учитывает подсветка «могу сделать»: деньги или только ингредиенты и навык.
- Потери при провале: ничего / половина / всё.
- Тема книги: пергамент / тёмная.

## Установка

1. В Foundry VTT открой «Дополнения» - «Установить модуль».
2. Вставь манифест:
   `https://github.com/rain2rock/wfrp4e-recipe-book/releases/latest/download/module.json`
3. Установи и активируй модуль в мире с системой WFRP4e.

**Требования:** Foundry VTT v13+, система wfrp4e 9.x.

**Автор:** Михаил (rain2rock). **Лицензия:** пока без лицензии, все права защищены.

---

## WFRP Paperdoll Recipe Book

A Foundry VTT module for Warhammer Fantasy Roleplay 4e that adds recipe-based crafting following the «Crafting» rules (Core Rulebook, p. 199) and extended tests (p. 154).

- Recipes are items of a new type. Drag a recipe onto an actor to learn it.
- Recipe Book opens with hotkey **B** or a button in the character sheet header.
- Left panel: known recipes with search and filters (all / craftable / in progress); craftable ones are highlighted.
- Right panel: recipe spread with result, ingredients (missing ones shown), skill and chance, required SL, material cost, and a «Craft» button.
- All rolls are handled by the WFRP4e system: a craft project is a system extended test on the actor. The module only spends ingredients and money, tracks progress, and grants the finished item.
- Rules supported: difficulty by availability, required SL by price, «Craftsman» talent lowers the target.
- Failure (total SL below zero) destroys materials: none / half / all (world setting).
- GMs create recipes as items of type «WFRP Recipe Book: Recipe» and drag the result item and ingredients into the recipe sheet.
- Settings: what the «craftable» highlight considers (money or only ingredients and skill), material loss on failure, book theme (parchment / dark).

**Requirements:** Foundry VTT v13+, wfrp4e system 9.x.

**Install:** `https://github.com/rain2rock/wfrp4e-recipe-book/releases/latest/download/module.json`

**Author:** Mikhail (rain2rock). **License:** none yet, all rights reserved.
