/* Приветствие в чат: один раз после установки модуля в мир (видит только ГМ).
   Задача карточки - не похвалить себя, а показать три первых шага. */

import { MODULE_ID } from "./recipe-model.js";
import { L, esc } from "./recipe-book.js";

/** Показать карточку (повторно можно вызвать из макроса: api.showWelcome()) */
export async function showWelcome() {
  const img = `modules/${MODULE_ID}/assets/icons/recipe-default.png`;
  const steps = [
    L("WFRPRB.Welcome.Step1"),
    L("WFRPRB.Welcome.Step2"),
    L("WFRPRB.Welcome.Step3")
  ].map((t) => `<li>${esc(t)}</li>`).join("");

  await ChatMessage.create({
    // Пустой whisper в Foundry означает «всем», поэтому запасной вариант - лично себе
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map((u) => u.id) ?? [game.user.id],
    content: `<div class="rb-welcome">
      <div class="rb-welcome-head"><img src="${img}" alt=""><b>${esc(L("WFRPRB.Welcome.Title"))}</b></div>
      <div class="rb-welcome-text">${esc(L("WFRPRB.Welcome.Intro"))}</div>
      <ol class="rb-welcome-steps">${steps}</ol>
      <div class="rb-welcome-foot">${esc(L("WFRPRB.Welcome.Foot"))}</div>
    </div>`
  });
}

/** Первый запуск в мире: показать приветствие и больше не повторять */
export async function welcomeOnce() {
  if (!game.user.isGM) return;
  if (game.settings.get(MODULE_ID, "welcomeShown")) return;
  await showWelcome();
  await game.settings.set(MODULE_ID, "welcomeShown", true);
}
