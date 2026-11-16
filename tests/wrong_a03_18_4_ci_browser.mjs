import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
const dir='artifacts/a18-4'; await mkdir(dir,{recursive:true});
let browser;
try {
  browser=await chromium.launch({headless:true});
  for(const width of [320,390]){
    const page=await browser.newPage({viewport:{width,height:780}});
    const url='http://127.0.0.1:8765/tests/wrong_a03_18_2_indexeddb_aba_browser.html';
    let loaded=false;
    for(let i=0;i<15;i++){try{await page.goto(url,{waitUntil:'load',timeout:2000});loaded=true;break}catch{await sleep(500)}}
    if(!loaded)throw Error('fixture HTTP unavailable');
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.querySelector('#out').textContent.includes('result'),{timeout:10000});
    const data=JSON.parse(await page.locator('#out').innerText());
    const expected=data.sameContent===true&&data.changedRevision===true&&data.first?.revision===1&&data.second?.revision===3&&data.result?.startsWith('PASS');
    await page.screenshot({path:`${dir}/a18-4-${width}.png`,fullPage:true});
    await writeFile(`${dir}/a18-4-${width}.json`,JSON.stringify({width,expected,scenario:data.scenario,first:data.first,second:data.second,sameContent:data.sameContent,changedRevision:data.changedRevision,result:data.result},null,2));
    console.log(`A18-4 width=${width} expected=${expected}`);
    await page.close();
    if(!expected)process.exitCode=1;
  }
}finally{await browser?.close();server.kill()}
