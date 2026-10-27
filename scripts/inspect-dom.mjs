import { chromium } from 'playwright';
const urls = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chromium' });
for (const url of urls) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); await p.waitForTimeout(4000);
  const tree = await p.evaluate(() => {
    const out = [];
    const walk = (el, d) => {
      if (d > 5) return;
      for (const c of el.children) {
        if (['SCRIPT','STYLE','NOSCRIPT','LINK','META','TEMPLATE'].includes(c.tagName)) continue;
        const r = c.getBoundingClientRect(), cs = getComputedStyle(c);
        if (r.height < 20 && c.childElementCount === 0) continue;
        out.push(`${'  '.repeat(d)}${c.tagName.toLowerCase()}${c.id ? '#' + c.id : ''}.${String(c.className).split(' ').slice(0, 2).join('.')} ${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.top)} ${cs.position} ${cs.display} ovf:${cs.overflowY} sh:${c.scrollHeight} kids:${c.childElementCount}`);
        if (out.length < 60) walk(c, d + 1);
      }
    };
    walk(document.body, 0);
    return { docH: document.documentElement.scrollHeight, bodyH: document.body.scrollHeight, out };
  });
  console.log(`== ${url} docH=${tree.docH} bodyH=${tree.bodyH}`); console.log(tree.out.slice(0, 30).join('\n'));
  await p.close();
}
await b.close();
