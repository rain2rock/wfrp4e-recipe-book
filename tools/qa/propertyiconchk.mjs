import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const rows=JSON.parse(fs.readFileSync(new URL('docs/property-icon-catalogue.json',root)));
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1400,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(new URL('docs/book-mock.html',root).href);
 await page.waitForSelector('.rb-root');
 await page.evaluate(rows=>{
  const cfg=game.wfrp4e.config;
  for(const r of rows)for(const cat of r.categories){cfg[cat]??={};cfg[cat][r.key]??=r.label;}
  cfg.itemQualities.futureAddonProperty='Future addon property';
 },rows);
 const id=await page.evaluate(async()=>{const r=await Item.create({name:'Property icon QA',type:'wfrp4e-recipe-book.recipe',img:''});r.sheet.render(true);return r.id;});
 await page.click(`#rb-sheet-${id} [data-action='openForge']`);
 const f=`#rb-forge-${id}`;await page.waitForSelector(`${f} .rb-qrow`);
 const seen=new Set();
 for(const type of ['weapon','armour','trapping','ammunition']){
  await page.selectOption(`${f} .rb-forge-type`,type);
  for(const [tab,cls,kind] of [['qualities','rb-qrow','quality'],['flaws','rb-frow','flaw'],['crit','rb-critrow','quality'],['fail','rb-poolrow','flaw']]){
   await page.click(`${f} [data-tab='${tab}']`);
   if(tab==='fail')await page.check(`${f} .rb-forge-failflawed`);
   await page.waitForSelector(`${f} .${cls}`);
   const actual=await page.locator(`${f} .${cls}`).evaluateAll(els=>els.map(el=>{const im=el.querySelector('.rb-prop-icon');return {key:el.dataset.key,hasIcon:!!im,loaded:im?.complete&&im?.naturalWidth>0,width:im?.getBoundingClientRect().width,alt:im?.getAttribute('alt'),border:im?getComputedStyle(im).borderWidth:null};}));
   for(const r of actual){
    if(r.key==='futureAddonProperty'){assert.equal(r.hasIcon,false);continue;}
    assert.ok(r.loaded,`${type}/${tab}/${r.key} loaded`);assert.equal(r.width,24);assert.equal(r.alt,'');assert.equal(r.border,'0px');seen.add(`${kind}/${r.key}`);
   }
  }
 }
 assert.equal(seen.size,39);
 await page.selectOption(`${f} .rb-forge-type`,'weapon');
 await page.click(`${f} [data-tab='qualities']`);
 const check=page.locator(`${f} .rb-qrow[data-key='durable'] .rb-prop-on`);
 await page.locator(`${f} .rb-qrow[data-key='durable'] .rb-prop-icon`).click();assert.ok(await check.isChecked());
 await page.selectOption(`${f} .rb-forge-type`,'armour');await page.click(`${f} [data-tab='flaws']`);
 await page.screenshot({path:'/tmp/recipe-property-icons-qa.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: all 39 glyphs load across 4 lists and 4 item types; unknown addon has no broken image; 24px layout and icon clicks preserve selection.');
} finally {await browser.close();}
