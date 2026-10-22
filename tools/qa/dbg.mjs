import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", e => console.log("pageerror:", e.message));
page.on("console", m => { if (["error","warn"].includes(m.type())) console.log(m.type()+":", m.text()); });
await page.goto("file:///Users/moex/wfrp4e-recipe-book/docs/book-mock.html");
await page.waitForSelector(".rb-root");
await page.locator("[data-action='createRecipe']").click();
await page.waitForTimeout(250);
console.log(await page.evaluate(() => JSON.stringify({
  recipes: __RB_actor__.items.filter(i => i.type === "wfrp4e-recipe-book.recipe").map(i => i.name),
  entries: [...document.querySelectorAll(".rb-entry .rb-entry-name")].map(e => e.textContent.trim()),
  sheets: [...document.querySelectorAll("[id^='rb-sheet-']")].length
})));
await browser.close();
