/* Эффекты применяемых предметов (зелья, снадобья, яды).
   Контракт системы wfrp4e и ссылки на исходники - docs/wfrp4e-effects.md.
   Коротко: «использовать» у предмета в системе нет, кнопку на листе персонажа
   рисует сам ActiveEffect. Поэтому зелье - это ДВА эффекта:
   нагрузка (что делает) + кнопка «применить» (тратит штуку и вешает нагрузку). */

import { L, F } from "./recipe-book.js";

export const EFFECT_PRESETS = ["heal", "addCondition", "removeCondition", "bonus"];

/** Скрипт кнопки: тратит одну штуку и вешает нагрузку на выбранную цель, иначе на себя.
    Текст ошибки подставляем уже переведённым - предмет переживёт удаление модуля. */
function applyScript(noneLeft) {
  return [
    `if (!this.item.system.quantity.value) return this.script.notification(${JSON.stringify(noneLeft)}, "error");`,
    "this.item.system.reduceQuantity();",
    "const actor = Array.from(game.user.targets)[0]?.actor || this.actor;",
    "const effectData = this.item.effects.contents[0].convertToApplied();",
    "effectData.system.sourceData.item = this.item.uuid;",
    "actor.applyEffect({ effectData: [effectData] });"
  ].join("\n");
}

/** Нагрузка: что именно делает зелье. Возвращает данные эффекта или null. */
function payload(spec, { name, img }) {
  const base = {
    name, type: "base", img, disabled: false, changes: [],
    system: { transferData: { type: "target", documentType: "Actor" }, scriptData: [] }
  };
  const script = (code) => ({
    ...base,
    system: {
      ...base.system,
      // Сработал - исчез: нагрузка одноразовая
      scriptData: [{ label: name, trigger: "immediate", script: code, options: { deleteEffect: true } }]
    }
  });

  switch (spec.preset) {
    case "heal": {
      const n = spec.healType === "tb"
        ? "this.actor.system.characteristics.t.bonus"
        : String(Math.max(1, Number(spec.healValue) || 1));
      return script(`this.actor.modifyWounds(${n});`);
    }
    case "addCondition":
      if (!spec.cond) return null;
      return script(`await this.actor.addCondition(${JSON.stringify(spec.cond)}, ${Math.max(1, Number(spec.condCount) || 1)});`);
    case "removeCondition":
      if (!spec.cond) return null;
      return script(`await this.actor.removeCondition(${JSON.stringify(spec.cond)}, ${Math.max(1, Number(spec.condCount) || 1)});`);
    case "bonus": {
      // Временный бонус держится на changes и длительности - скрипт не нужен
      if (!spec.charac) return null;
      return {
        ...base,
        duration: { rounds: Math.max(1, Number(spec.rounds) || 1) },
        changes: [{
          key: `system.characteristics.${spec.charac}.modifier`,
          mode: CONST?.ACTIVE_EFFECT_MODES?.ADD ?? 2,
          value: String(Number(spec.bonus) || 0),
          priority: 20
        }]
      };
    }
    default:
      return null;
  }
}

/** Два эффекта для применяемого предмета. Пустой массив - значит пресет не настроен. */
export function buildPotionEffects(spec, { name, img }) {
  const load = payload(spec, { name, img });
  if (!load) return [];
  return [
    load,
    {
      name: F("WFRPRB.Effect.ApplyName", { name }),
      type: "base", img, disabled: false, changes: [],
      system: {
        // documentType: "Item" - эффект остаётся НА ПРЕДМЕТЕ и даёт кнопку,
        // на персонажа он не переносится (determineTransfer в warhammer-lib)
        transferData: { type: "document", documentType: "Item" },
        scriptData: [{ label: "@effect.name", trigger: "manual", script: applyScript(L("WFRPRB.Effect.NoneLeft")) }]
      }
    }
  ];
}

/** Эффекты предмета-донора: копируем как есть, но без идентификаторов. */
export async function donorEffects(uuid) {
  const doc = uuid ? await fromUuid(uuid).catch(() => null) : null;
  const effects = doc?.toObject?.()?.effects ?? [];
  return effects.map((e) => {
    const copy = { ...e };
    delete copy._id;
    return copy;
  });
}

/** Человеческое описание того, что получится - показываем в мастере до создания */
export function effectSummary(spec, condLabel, characLabel) {
  switch (spec.preset) {
    case "heal":
      return spec.healType === "tb"
        ? L("WFRPRB.Effect.SumHealTB")
        : F("WFRPRB.Effect.SumHealFixed", { n: Math.max(1, Number(spec.healValue) || 1) });
    case "addCondition":
      return F("WFRPRB.Effect.SumAddCond", { cond: condLabel, n: Math.max(1, Number(spec.condCount) || 1) });
    case "removeCondition":
      return F("WFRPRB.Effect.SumRemoveCond", { cond: condLabel, n: Math.max(1, Number(spec.condCount) || 1) });
    case "bonus":
      return F("WFRPRB.Effect.SumBonus", {
        charac: characLabel,
        n: (Number(spec.bonus) || 0) >= 0 ? `+${Number(spec.bonus) || 0}` : String(Number(spec.bonus) || 0),
        rounds: Math.max(1, Number(spec.rounds) || 1)
      });
    default:
      return "";
  }
}
