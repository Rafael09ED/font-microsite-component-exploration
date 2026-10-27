// Functions passed to page.evaluate(). They run inside the browser, so they must be self-contained.

// Outline: the page's top-level visual blocks, with a feature summary for each.
// Finds the "content container" by descending through wrappers that hold a single dominant child,
// then takes its children as blocks. Tall blocks with several substantial children are split one level.
export function extractOutline() {
  const vh = innerHeight, vw = innerWidth;
  const doc = document.documentElement;
  // Inner scroller marked by archive.mjs, for sites that don't scroll the window.
  const scroller = document.querySelector('[data-archive-scroller]');
  const pageH = scroller ? scroller.scrollHeight : Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
  const pageW = scroller ? scroller.scrollWidth : doc.scrollWidth;
  const originY = scroller ? scroller.getBoundingClientRect().top - scroller.scrollTop : -scrollY;
  const originX = scroller ? scroller.getBoundingClientRect().left - scroller.scrollLeft : -scrollX;

  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left - originX), y: Math.round(r.top - originY), w: Math.round(r.width), h: Math.round(r.height) };
  };
  // Visible children of el that are big enough to be blocks. Wrappers that take no space of their own
  // (display: contents, zero-height roots like Readymag's #root) are looked through, not stopped at.
  // Opacity is not checked: reveal-on-scroll sections are often opacity 0 until scrolled into view.
  const SKIP = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META'];
  const kids = (el, depth = 0) => {
    const out = [];
    for (const c of el.children) {
      if (SKIP.includes(c.tagName)) continue;
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const b = box(c);
      if ((cs.display === 'contents' || b.h < 40) && c.childElementCount && depth < 5) { out.push(...kids(c, depth + 1)); continue; }
      if (b.h >= 40 && b.w >= vw * 0.3) out.push(c);
    }
    return out;
  };
  const floating = (el) => ['fixed', 'absolute'].includes(getComputedStyle(el).position) && box(el).h <= vh * 1.5;

  const cssPath = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.documentElement; e = e.parentElement) {
      if (e.id && /^[A-Za-z][\w-]*$/.test(e.id)) { parts.unshift(`#${e.id}`); break; }
      const sib = [...(e.parentElement?.children ?? [])].filter((s) => s.tagName === e.tagName);
      parts.unshift(e.tagName.toLowerCase() + (sib.length > 1 ? `:nth-of-type(${sib.indexOf(e) + 1})` : ''));
    }
    return parts.join(' > ');
  };

  const features = (el) => {
    const all = el.querySelectorAll('*');
    const sample = [...all].slice(0, 400);
    const families = new Set(), sizes = new Set();
    let maxFont = 0, singleChar = 0, varSettings = new Set();
    for (const e of sample) {
      const cs = getComputedStyle(e);
      families.add(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim());
      const fs = parseFloat(cs.fontSize);
      sizes.add(Math.round(fs));
      if (e.childElementCount === 0 && e.textContent.trim()) {
        maxFont = Math.max(maxFont, fs);
        if ([...e.textContent.trim()].length <= 2) singleChar++;
      }
      if (cs.fontVariationSettings && cs.fontVariationSettings !== 'normal') varSettings.add(cs.fontVariationSettings);
    }
    const cs = getComputedStyle(el);
    const text = el.innerText ?? '';
    const q = (s) => el.querySelectorAll(s).length;
    return {
      textLength: text.length,
      textPreview: text.replace(/\s+/g, ' ').trim().slice(0, 240),
      headings: [...el.querySelectorAll('h1,h2,h3,h4')].slice(0, 4).map((h) => h.innerText.replace(/\s+/g, ' ').trim().slice(0, 80)),
      elementCount: all.length,
      fontFamilies: [...families].slice(0, 8),
      distinctFontSizes: sizes.size,
      maxFontSizePx: Math.round(maxFont),
      maxFontVsViewport: +(maxFont / vw).toFixed(3),
      singleCharLeaves: singleChar,
      variationSettings: [...varSettings].slice(0, 8),
      controls: {
        range: q('input[type=range]'), text: q('input[type=text],input:not([type]),textarea'), contenteditable: q('[contenteditable=""],[contenteditable=true]'),
        checkbox: q('input[type=checkbox]'), select: q('select'), buttons: q('button,[role=button]'), color: q('input[type=color]'),
      },
      media: { img: q('img'), svg: q('svg'), video: q('video'), canvas: q('canvas'), iframe: q('iframe') },
      links: q('a[href]'),
      background: cs.backgroundColor, color: cs.color, position: cs.position, opacity: +cs.opacity,
    };
  };

  // Descend into the dominant in-flow child (≥ 85% of the page) as long as there are at most a few
  // in-flow siblings; floating siblings (fixed navs, overlays) and small leftovers become blocks too.
  let container = scroller ?? document.body;
  const extras = [];
  for (let i = 0; i < 15; i++) {
    const k = kids(container);
    const inflow = k.filter((c) => !floating(c));
    const big = inflow.reduce((a, c) => (!a || box(c).h > box(a).h ? c : a), null);
    if (big && box(big).h >= pageH * 0.85 && inflow.length <= 3) { extras.push(...k.filter((c) => c !== big)); container = big; }
    else break;
  }

  const blocks = [];
  const add = (el, depth, parent) => {
    const b = box(el);
    blocks.push({ i: blocks.length, depth, parent, tag: el.tagName.toLowerCase(), id: el.id || null,
      classes: (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 6),
      role: el.getAttribute('role'), selector: cssPath(el), box: b, ...features(el) });
    return blocks.length - 1;
  };
  // Tall blocks (> 2.5 viewports) are split into their children when those look like separate
  // components: at least two children carry their own heading (GT America's chapters), or the block
  // is huge (> 8 viewports). A section with one heading followed by captions and images
  // (GT Walsheim's story chapters) stays whole.
  const visit = (el, depth, parent) => {
    const idx = add(el, depth, parent);
    const h = box(el).h;
    if (depth >= 3 || h <= vh * 2.5 || blocks.length > 150) return;
    const sub = kids(el).filter((c) => box(c).h > vh * 0.25 && !floating(c));
    const headed = sub.filter((c) => c.querySelector('h1,h2,h3,h4')).length;
    if (sub.length >= 2 && (headed >= 2 || h > vh * 8)) for (const c of sub.slice(0, 40)) visit(c, depth + 1, idx);
  };
  for (const el of [...kids(container), ...extras]) visit(el, 0, null);
  return { viewport: { w: vw, h: vh }, pageHeight: pageH, pageWidth: pageW, axis: doc.dataset.archiveAxis || null, container: cssPath(container), blocks };
}

// Page-level signals: fonts, OpenType/variable usage, interactivity, commerce, tech.
export function extractSignals() {
  const els = [...document.querySelectorAll('body *')].slice(0, 4000);
  const varSettings = new Map(), featSettings = new Map(), animated = new Set();
  for (const e of els) {
    const cs = getComputedStyle(e);
    if (cs.fontVariationSettings !== 'normal') varSettings.set(cs.fontVariationSettings, (varSettings.get(cs.fontVariationSettings) ?? 0) + 1);
    if (cs.fontFeatureSettings !== 'normal') featSettings.set(cs.fontFeatureSettings, (featSettings.get(cs.fontFeatureSettings) ?? 0) + 1);
    if (cs.animationName !== 'none') animated.add(cs.animationName);
  }

  const fontFaceRules = [], keyframesWithVariation = [];
  let blockedSheets = 0;
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { blockedSheets++; continue; }
    for (const r of rules) {
      if (r instanceof CSSFontFaceRule) fontFaceRules.push({ family: r.style.getPropertyValue('font-family').replace(/["']/g, ''),
        weight: r.style.getPropertyValue('font-weight'), style: r.style.getPropertyValue('font-style'), src: r.style.getPropertyValue('src').slice(0, 300) });
      if (r instanceof CSSKeyframesRule && /font-variation-settings|font-weight|font-stretch/.test(r.cssText)) keyframesWithVariation.push(r.name);
    }
  }

  const ranges = [...document.querySelectorAll('input[type=range]')].map((r) => ({
    name: r.name || r.id || null, label: r.getAttribute('aria-label') || r.labels?.[0]?.innerText?.trim() || r.closest('label')?.innerText?.trim()?.slice(0, 40) || null,
    min: r.min, max: r.max, step: r.step, value: r.value }));

  // Glyph grids: containers whose many children are mostly 1–2 character cells.
  const glyphGrids = [];
  for (const e of document.querySelectorAll('body *')) {
    if (e.childElementCount < 40) continue;
    const cells = [...e.children];
    const short = cells.filter((c) => { const t = c.textContent.trim(); return t && [...t].length <= 2; }).length;
    if (short / cells.length > 0.8) glyphGrids.push({ cells: cells.length, sample: cells.slice(0, 24).map((c) => c.textContent.trim()).join('') });
    if (glyphGrids.length >= 10) break;
  }

  const bodyText = document.body.innerText;
  const prices = [...new Set(bodyText.match(/(?:[€$£¥]|CHF|USD|EUR|GBP)\s?\d[\d.,']*|\d[\d.,']*\s?(?:[€$£]|CHF|USD|EUR|GBP)\b/g) ?? [])].slice(0, 15);
  const actionRe = /\b(buy|purchase|cart|checkout|shop|licen[cs]e|trial|download|get (the )?font|order|github)\b/i;
  const actionLinks = [...document.querySelectorAll('a[href],button')].filter((a) => actionRe.test(a.innerText))
    .slice(0, 25).map((a) => ({ text: a.innerText.replace(/\s+/g, ' ').trim().slice(0, 60), href: a.href ?? null }));

  const here = location.hostname;
  const subpages = [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href)
    .filter((h) => { try { const u = new URL(h); return u.hostname === here && u.pathname !== location.pathname && !/\.(pdf|zip|otf|ttf|woff2?|png|jpe?g|gif|svg|mp4)$/i.test(u.pathname); } catch { return false; } })
    .map((h) => h.split('#')[0]))].slice(0, 40);

  const html = document.documentElement.outerHTML;
  const tech = {
    generator: document.querySelector('meta[name=generator]')?.content ?? null,
    next: !!document.getElementById('__NEXT_DATA__') || /\/_next\//.test(html),
    nuxt: !!window.__NUXT__, gatsby: !!document.getElementById('___gatsby'),
    webflow: !!document.documentElement.dataset.wfSite, wordpress: /wp-content/.test(html),
    squarespace: /squarespace/.test(html), framer: /framerusercontent|data-framer/.test(html),
    webgl: [...document.querySelectorAll('canvas')].some((c) => { try { return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }),
    gsap: !!window.gsap, three: !!window.THREE, opentypejs: !!window.opentype,
  };

  return {
    title: document.title, lang: document.documentElement.lang || null,
    description: document.querySelector('meta[name=description]')?.content ?? null,
    loadedFonts: [...document.fonts].map((f) => ({ family: f.family.replace(/["']/g, ''), weight: f.weight, style: f.style, stretch: f.stretch, status: f.status })).slice(0, 80),
    fontFaceRules: fontFaceRules.slice(0, 80), blockedStylesheets: blockedSheets,
    variationSettings: Object.fromEntries([...varSettings].slice(0, 40)),
    featureSettings: Object.fromEntries([...featSettings].slice(0, 40)),
    animations: [...animated].slice(0, 40), keyframesWithVariation,
    interactivity: {
      ranges, contenteditable: document.querySelectorAll('[contenteditable=""],[contenteditable=true]').length,
      textInputs: document.querySelectorAll('input[type=text],input:not([type]),textarea').length,
      checkboxes: document.querySelectorAll('input[type=checkbox]').length, selects: document.querySelectorAll('select').length,
      colorInputs: document.querySelectorAll('input[type=color]').length,
    },
    glyphGrids, prices, actionLinks, subpages, tech,
  };
}
