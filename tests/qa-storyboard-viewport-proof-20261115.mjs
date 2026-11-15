// QA storyboard browser proof: run locally with playwright installed; synthetic static HTML only.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=resolve('문서/스토리보드'), output=resolve('artifacts/wrong-storyboard-320-390');
mkdirSync(output,{recursive:true});
const pages=['index.html','02_WRONG_클릭형_가상체험_v1.0.html','W01_첫화면.html','W06_아이재풀이.html','W08_부모관찰.html'];
const browser=await chromium.launch({headless:true});
let failures=[], results=[];
for(const width of [390,320]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 for(const file of pages){
  if(!existsSync(join(root,file))){failures.push('missing '+file);continue;}
  await page.goto(pathToFileURL(join(root,file)).href,{waitUntil:'load'});
  const info=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,title:document.title,buttons:document.querySelectorAll('button,a').length}));
  const label=file.replace(/[^a-zA-Z0-9가-힣]/g,'_');
  await page.screenshot({path:join(output,width+'-'+label+'.png'),fullPage:true});
  if(info.scrollWidth>info.clientWidth+1)failures.push(width+' overflow '+file+' '+JSON.stringify(info));
  results.push({width,file,...info,errors:[...errors]});
  errors.length=0;
 }
 await page.close();
}
await browser.close();
writeFileSync(join(output,'result.json'),JSON.stringify({results,failures},null,2));
if(failures.length) {console.error(failures.join('\n'));process.exitCode=1;}
else console.log('PASS static viewport/JS checks; interactive user flow and device remain unverified');
