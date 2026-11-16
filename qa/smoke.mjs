import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:"/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
await page.goto((process.env.TUSA_URL||'http://127.0.0.1:3101'));
await page.screenshot({path:'/root/party-hub/qa/home-desktop.png',fullPage:true});
console.log(await page.title(),await page.locator('[data-game]').count());
await page.locator('#create').click();await page.locator('.tv-join img').waitFor();await page.waitForFunction(()=>document.querySelector('.tv-join img')?.naturalWidth>0);await page.screenshot({path:'/root/party-hub/qa/lobby-desktop.png',fullPage:true});page.on('dialog',d=>d.accept());await browser.close();
