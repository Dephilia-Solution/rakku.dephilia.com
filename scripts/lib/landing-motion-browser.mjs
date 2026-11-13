import assert from 'node:assert/strict';
import {join} from 'node:path';

export async function checkLandingMotion(browser, origin, artifacts) {
  const results=[];
  const tx=async locator=>locator.evaluate(element=>{
    const value=getComputedStyle(element).transform;
    return value==='none'?0:new DOMMatrixReadOnly(value).m42;
  });
  const prepare=async options=>{
    const context=await browser.newContext(options);
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    return context;
  };
  for(const reducedMotion of ['no-preference','reduce']) {
    const context=await prepare({viewport:{width:1440,height:1000},reducedMotion});
    await context.addInitScript(()=>{
      window.__landingEntrances=[];
      const original=Element.prototype.animate;
      Element.prototype.animate=function(keyframes,options){
        if(options?.id?.startsWith('landing:'))window.__landingEntrances.push({id:options.id,section:this.closest('section')?.id,duration:options.duration,delay:options.delay});
        return original.call(this,keyframes,options);
      };
    });
    const page=await context.newPage();
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&/hydration|did not match/i.test(message.text()))errors.push(message.text());});
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.getByRole('heading',{level:1}).waitFor({state:'visible'});
    const button=page.locator('#top').getByRole('link',{name:'Coba Rakku',exact:true});
    await button.hover(); await page.waitForTimeout(300);
    const buttonY=await tx(button);
    assert.ok(reducedMotion==='reduce'?Math.abs(buttonY)<.1:buttonY<-.5&&buttonY>=-3,'CTA hover is restrained and respects reduced motion');
    await page.mouse.move(0,0);
    const feature=page.locator('#kasir'); await feature.scrollIntoViewIfNeeded();
    await page.waitForTimeout(750);
    const count=await page.evaluate(()=>window.__landingEntrances.filter(e=>e.id==='landing:stagger'&&e.section==='fitur').length);
    assert.equal(count,reducedMotion==='reduce'?0:3,'Feature cards actually reveal once');
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await feature.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>window.__landingEntrances.filter(e=>e.id==='landing:stagger'&&e.section==='fitur').length),count,'Reveals do not replay every scroll');
    const annual=page.getByRole('button',{name:'Tahunan · hemat 2 bulan',exact:true});
    await annual.click(); await page.waitForTimeout(650);
    assert.equal(await annual.getAttribute('aria-pressed'),'true');
    const plan=page.locator('[data-plan="pro"]');
    assert.match(await plan.innerText(),/Rp990\.000/); assert.match(await plan.innerText(),/\/tahun/);
    assert.equal(await page.locator('[data-cycle-indicator]').count(),1);
    await plan.hover(); await page.waitForTimeout(350);
    const planY=await tx(plan);
    assert.ok(reducedMotion==='reduce'?Math.abs(planY)<.1:planY<-.5&&planY>=-4,'Plan hover keeps depth small');
    await page.waitForTimeout(400);
    await page.locator('#harga').screenshot({path:join(artifacts,`motion-pricing-${reducedMotion}.png`)});
    await page.getByRole('button',{name:'Bulanan',exact:true}).click();
    const question=page.locator('#faq details').nth(1);
    await question.locator('summary').focus(); await page.keyboard.press('Enter');
    assert.notEqual(await question.getAttribute('open'),null);
    assert.ok(await question.locator('p').isVisible(),'FAQ works from the keyboard');
    await page.waitForTimeout(700);
    await page.locator('#faq').screenshot({path:join(artifacts,`motion-faq-${reducedMotion}.png`)});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(reducedMotion==='reduce') {
      assert.equal(await page.evaluate(()=>window.__landingEntrances.length),0);
      assert.equal(await page.locator('.landing-reading-progress').evaluate(e=>getComputedStyle(e).display),'none');
      assert.equal(await question.locator('p').evaluate(e=>getComputedStyle(e).animationName),'none');
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      const preview=page.locator('.hero-pos-preview');
      const before=await preview.innerText(); await page.waitForTimeout(3900);
      assert.equal(await preview.innerText(),before,'Reduced motion disables the automatic product rotation');
    } else {
      const entries=await page.evaluate(()=>window.__landingEntrances);
      assert.ok(entries.some(e=>e.id==='landing:hero-visual'));
      assert.ok(entries.some(e=>e.id==='landing:section'));
      assert.ok(entries.every(e=>e.duration<=650&&e.delay<=160),'No long or cascading entrances');
    }
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'})); await page.waitForTimeout(350);
    await page.screenshot({path:join(artifacts,`motion-${reducedMotion}.png`)});
    assert.deepEqual(errors,[],'No runtime/hydration errors');
    results.push({suite:`motion-${reducedMotion}`,pass:true,featureEntrances:count,buttonY,planY});
    await context.close();
  }

  const touch=await prepare({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await touch.newPage(); await page.goto(origin,{waitUntil:'networkidle'}); await page.waitForTimeout(700);
  const button=page.locator('#top').getByRole('link',{name:'Coba Rakku',exact:true});
  await button.hover(); await page.waitForTimeout(250);
  assert.ok(Math.abs(await tx(button))<.1,'Touch devices do not receive desktop hover lifts');
  await page.getByRole('button',{name:'Buka menu',exact:true}).tap();
  await page.getByRole('navigation',{name:'Navigasi mobile'}).waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await page.getByRole('navigation',{name:'Navigasi mobile'}).waitFor({state:'hidden'});
  assert.ok(await page.getByRole('button',{name:'Buka menu',exact:true}).evaluate(e=>e===document.activeElement),'Menu returns focus after closing');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:join(artifacts,'motion-touch.png')});
  results.push({suite:'motion-touch',pass:true}); await touch.close();

  const noJs=await prepare({viewport:{width:390,height:844},javaScriptEnabled:false});
  const staticPage=await noJs.newPage(); await staticPage.goto(origin,{waitUntil:'networkidle'});
  assert.ok(await staticPage.getByRole('heading',{level:1}).isVisible());
  await staticPage.locator('#fitur h2').scrollIntoViewIfNeeded(); assert.ok(await staticPage.locator('#fitur h2').isVisible());
  const faq=staticPage.locator('#faq details').nth(1); await faq.locator('summary').click(); assert.ok(await faq.locator('p').isVisible());
  assert.ok(await staticPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  results.push({suite:'motion-without-javascript',pass:true}); await noJs.close();
  return results;
}
