// Smoke/regression tests for OS Structure Lab. Usage: npm i playwright && node tests/smoke-test.js
// (set CHROMIUM_PATH to use an existing Chromium binary)
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..'), 'index.html');
const out = [];
const log = (ok, name, extra='') => { out.push((ok?'PASS':'FAIL')+' | '+name+(extra?' | '+extra:'')); };
(async () => {
  const browser = await (process.env.CHROMIUM_PATH ? chromium.launch({ executablePath: process.env.CHROMIUM_PATH }) : chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text()); });
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load' });
  const loadMs = Date.now() - t0;
  const timing = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  out.push(`PROFILE | page load ${loadMs}ms wall, DCL ${timing.dcl}ms, load ${timing.load}ms`);
  await page.waitForTimeout(600);
  log(await page.isVisible('#tour-backdrop'), 'Tour auto-opens on first visit');
  await page.click('#btn-close-tour');
  log(!(await page.isVisible('#tour-backdrop')), 'Tour closes via X');
  const seen = await page.evaluate(()=>localStorage.getItem('os_lab_tour_seen'));
  log(seen !== null, 'Closing tour persists "seen" flag', 'value='+seen);

  const txt = id => page.textContent(id);
  const cycles = async () => parseInt((await txt('#cnt-cycles')).replace(/,/g,''),10);
  const archs = [['monolithic','#tab-mono'],['layered','#tab-layer'],['microkernel','#tab-micro']];
  const calls = ['read','write','open','fork','send_message'];
  const expected = { // README
    read:[1075,1485,7445], write:[1105,1555,7495], open:[1095,1475,7465], fork:[1165,1295,7385], send_message:[645,1025,7015] };
  const results = {};
  for (const sc of calls) {
    await page.click(`.syscall-btn[data-syscall="${sc}"]`);
    for (let a=0;a<3;a++) {
      await page.click(archs[a][1]);
      await page.click('#btn-reset');
      const chip0 = await txt('#stage-number-chip');
      const total = parseInt(chip0.match(/OF (\d+)/)[1],10);
      let guard = 0;
      while (!(await page.isDisabled('#btn-step-fwd')) && guard++ < 30) {
        const before = await txt('#stage-number-chip');
        await page.click('#btn-step-fwd');
        if ((await txt('#stage-number-chip')) === before) break;
      }
      const c = await cycles();
      results[sc+'/'+archs[a][0]] = { c, total, ring: await txt('#cnt-mode-switches'), ctx: await txt('#cnt-ctx-switches'), ipc: await txt('#cnt-ipc') };
      log(c === expected[sc][a], `README cycles ${sc} / ${archs[a][0]}`, `got ${c}, README ${expected[sc][a]}, stages ${total}, ring=${results[sc+'/'+archs[a][0]].ring} ctx=${results[sc+'/'+archs[a][0]].ctx} ipc=${results[sc+'/'+archs[a][0]].ipc}`);
    }
  }
  // README claims: mono 2 switches / 0 ctx ; micro 8+ switches / 4+ ctx
  const m = results['read/monolithic'], u = results['read/microkernel'], l = results['read/layered'];
  log(m.ring==='2' && m.ctx==='0', 'Mono read: 2 ring switches, 0 ctx', `ring=${m.ring} ctx=${m.ctx}`);
  log(l.ring==='2' && l.ctx==='0', 'Layered read: 2 ring switches, 0 ctx', `ring=${l.ring} ctx=${l.ctx}`);
  log(+u.ring>=8 && +u.ctx>=4, 'Micro read: >=8 ring switches, >=4 ctx', `ring=${u.ring} ctx=${u.ctx}`);

  // Fault injection: read
  await page.click('.syscall-btn[data-syscall="read"]');
  // Mono driver crash
  await page.click('#tab-mono'); await page.click('#btn-fault-driver');
  let n=0; while(n++<8 && !(await page.isVisible('#stage-alert-banner'))) { await page.click('#btn-step-fwd'); }
  log(await page.isVisible('#stage-alert-banner'), 'Mono + driver crash shows panic banner', await page.textContent('#alert-title').catch(()=>''));
  const stuck = await txt('#stage-number-chip');
  await page.click('#btn-step-fwd');
  log((await txt('#stage-number-chip'))===stuck, 'Mono panic halts further stepping');
  // Step back after panic
  await page.click('#btn-step-back');
  log(!(await page.isVisible('#stage-alert-banner')), 'Step Back clears panic banner', await page.isVisible('#stage-alert-banner') ? 'banner still visible' : '');
  // Jump past fault via timeline dot
  await page.click('#btn-reset');
  const dots = await page.$$('#timeline-dots-container .timeline-dot');
  log(dots.length===7, 'Timeline has 7 dots', 'found '+dots.length);
  await dots[6].click();
  log(await page.isVisible('#stage-alert-banner'), 'Mono+fault: jumping past crashed driver halts with panic');
  await page.click('#btn-fault-clear');
  // Micro self-heal
  await page.click('#tab-micro'); await page.click('#btn-fault-driver');
  for (let i=0;i<10 && !(await page.isDisabled('#btn-step-fwd'));i++) await page.click('#btn-step-fwd');
  const mc = await cycles();
  log(mc===8945, 'Micro read + driver crash = 8,945c', 'got '+mc);
  log(!(await page.isVisible('#stage-alert-banner')) || /RECOVER|HEAL|100/i.test(await txt('#alert-badge')), 'Micro recovery banner/uptime', await txt('#alert-badge'));
  // FS crash micro
  await page.click('#btn-fault-fs');
  await page.click('#btn-reset');
  for (let i=0;i<10 && !(await page.isDisabled('#btn-step-fwd'));i++) await page.click('#btn-step-fwd');
  const fc = await cycles();
  log(fc===8945, 'Micro read + FS crash = 8,945c (README says +1,500)', 'got '+fc);
  await page.click('#btn-fault-clear');
  // Layered fault
  await page.click('#tab-layer'); await page.click('#btn-fault-fs');
  n=0; while(n++<8 && !(await page.isVisible('#stage-alert-banner'))) await page.click('#btn-step-fwd');
  log(await page.isVisible('#stage-alert-banner'), 'Layered + FS crash halts');
  await page.click('#btn-fault-clear');

  // Compare mode
  await page.click('#tab-compare');
  await page.waitForTimeout(200);
  log(await page.isVisible('.compare-container, .compare-mini-stages, #stage-svg'), 'Compare tab renders');
  for (let i=0;i<10 && !(await page.isDisabled('#btn-step-fwd'));i++) await page.click('#btn-step-fwd');
  const cmpHTML = await page.evaluate(()=>document.querySelector('#stage-canvas-wrapper').innerText);
  log(/Total Execution Cycles|Cycles/i.test(cmpHTML), 'Compare shows cycles chart');
  log(/winner|Winner|🏆/i.test(cmpHTML + await page.evaluate(()=>document.body.innerHTML.includes('winner-badge')?'winner':'')), 'Compare shows winner badges');
  // Compare + fault
  await page.click('#btn-reset'); await page.click('#btn-fault-driver');
  for (let i=0;i<10 && !(await page.isDisabled('#btn-step-fwd'));i++) await page.click('#btn-step-fwd');
  const cmpFault = await page.evaluate(()=>document.querySelector('#stage-canvas-wrapper').innerText);
  const hasFaultText = /KERNEL PANIC/.test(cmpFault) && /LAYER HALTED/.test(cmpFault) && /8,945/.test(cmpFault);
  log(hasFaultText, 'Compare + driver crash reflects fault in charts', hasFaultText?'':'no fault effect visible in compare mode');
  await page.click('#btn-fault-clear');

  // Keyboard
  await page.click('#tab-mono'); await page.click('#btn-reset');
  await page.keyboard.press('ArrowRight');
  log((await txt('#stage-number-chip')).startsWith('STAGE 2'), 'ArrowRight steps');
  await page.keyboard.press('ArrowLeft');
  log((await txt('#stage-number-chip')).startsWith('STAGE 1'), 'ArrowLeft steps back');
  await page.keyboard.press('2');
  log(await page.evaluate(()=>document.getElementById('tab-layer').classList.contains('active')), 'Key 2 -> Layered');
  await page.keyboard.press('3');
  log(await page.evaluate(()=>document.getElementById('tab-micro').classList.contains('active')), 'Key 3 -> Microkernel');
  await page.keyboard.press('1');
  // Play / pause
  await page.click('#speed-slider'); 
  await page.evaluate(()=>{const s=document.getElementById('speed-slider'); s.value=150; s.dispatchEvent(new Event('input',{bubbles:true}));});
  log(true, 'Speed readout @150', await txt('#speed-readout'));
  await page.click('#btn-reset'); await page.click('#btn-play-pause');
  await page.waitForTimeout(1800);
  log((await txt('#stage-number-chip')).startsWith('STAGE 7'), 'Autoplay reaches stage 7 and stops', await txt('#stage-number-chip')+' / btn='+await txt('#play-btn-text'));
  // Switching arch while playing
  await page.click('#btn-reset'); await page.click('#btn-play-pause'); await page.click('#tab-layer');
  log((await txt('#play-btn-text')).trim()==='Play', 'Switching arch mid-play pauses');
  // Theme
  await page.click('#btn-theme-toggle');
  log(await page.evaluate(()=>document.body.classList.contains('light-theme')), 'Theme toggles to light');
  await page.screenshot({ path: path.join(__dirname,'..','screenshots','light-theme.png') });
  await page.click('#btn-theme-toggle');
  // Drawer
  await page.click('#btn-theory-drawer'); await page.waitForTimeout(400);
  log(!(await page.evaluate(()=>document.getElementById('theory-drawer').classList.contains('hide'))), 'Theory drawer opens');
  await page.click('#btn-close-theory');
  // Export
  await page.click('#tab-mono');
  await page.click('#btn-export-report'); await page.waitForTimeout(200);
  const rep = await txt('#printable-report-content');
  log(rep.trim().length>200, 'Report renders', rep.trim().length+' chars');
  const [dl] = await Promise.all([page.waitForEvent('download', {timeout:3000}).catch(()=>null), page.click('#btn-download-json')]);
  if (dl) { const p = await dl.path(); const j = JSON.parse(require('fs').readFileSync(p,'utf8')); log(true,'JSON download valid', Object.keys(j).join(',')); } else log(false,'JSON download');
  await page.click('#btn-close-report');
  // Responsive
  for (const [w,h] of [[1100,800],[800,900],[390,844]]) {
    await page.setViewportSize({width:w,height:h}); await page.waitForTimeout(150);
    const ov = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
    log(ov.sw<=ov.cw+1, `No horizontal overflow @${w}px`, `scrollW ${ov.sw} vs ${ov.cw}`);
  }
  await page.setViewportSize({width:1440,height:900});
  // Timing: render perf
  const perf = await page.evaluate(async () => { const b=document.getElementById('btn-step-fwd'), r=document.getElementById('btn-reset'); const t=performance.now(); for(let i=0;i<200;i++){ r.click(); for(let k=0;k<6;k++) b.click(); } return Math.round((performance.now()-t)/200*100)/100; });
  out.push(`PROFILE | avg ${perf}ms per full 7-stage run render (reset + 6 steps)`);
  const heap = await page.evaluate(()=>performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576*10)/10 : null);
  out.push(`PROFILE | JS heap ${heap} MB; DOM nodes ${await page.evaluate(()=>document.getElementsByTagName('*').length)}`);
  await page.click('#tab-mono'); 
  out.push('ERRORS | '+(errors.length? errors.join(' || ') : 'none'));
  console.log(out.join('\n'));
  const failed = out.filter(l=>l.startsWith('FAIL')).length || (errors.length?1:0);
  console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
  await browser.close();
  process.exit(failed?1:0);
})().catch(e => { console.log(out.join('\n')); console.error('HARNESS ERROR', e.message); process.exit(1); });
