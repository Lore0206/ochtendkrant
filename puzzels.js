'use strict';
/* De puzzels van de Ochtendkrant. Alles wordt lokaal gegenereerd; elke puzzel heeft precies één oplossing.
   Elke generator geeft { html: '<svg…>', oplossing: 'tekst' } terug. */

function maakRng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function schud(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const reeks = n => Array.from({ length: n }, (_, i) => i);
const ink = '#1b1a17', grijs = '#6b665a';
const svgKop = (w, h) => '<svg class="puz-svg" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">';
const lijn = (x1, y1, x2, y2, dik, extra) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + ink + '" stroke-width="' + dik + '"' + (extra || '') + '/>';
const tekstSvg = (x, y, t, grootte, extra) => '<text x="' + x + '" y="' + y + '" font-size="' + grootte + '" text-anchor="middle" dominant-baseline="central" fill="' + ink + '"' + (extra || '') + '>' + t + '</text>';

/* ======================= 9x9-sudokufamilie ======================= */
const DOOS = reeks(81).map(i => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));
function maakBuren(regio) {
  return reeks(81).map(i => {
    const r = Math.floor(i / 9), c = i % 9, s = new Set();
    for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); }
    for (let j = 0; j < 81; j++) if (regio[j] === regio[i]) s.add(j);
    s.delete(i); return [...s];
  });
}
const BUREN_DOOS = maakBuren(DOOS);
const BITS = new Uint8Array(1024); for (let i = 1; i < 1024; i++) BITS[i] = BITS[i >> 1] + (i & 1);
const gebruikt = (g, i, buren) => { let m = 0; for (const j of buren[i]) if (g[j]) m |= 1 << g[j]; return m; }; // bits 1..9
const vrijTel = m => 9 - BITS[m >> 1 & 511];

function sudokuTel(g, buren, limiet) {
  let beste = -1, bm = 0, bn = 10;
  for (let i = 0; i < 81; i++) if (!g[i]) {
    const m = gebruikt(g, i, buren), n = vrijTel(m);
    if (n === 0) return 0;
    if (n < bn) { beste = i; bm = m; bn = n; if (n === 1) break; }
  }
  if (beste < 0) return 1;
  let t = 0;
  for (let v = 1; v <= 9; v++) if (!(bm >> v & 1)) { g[beste] = v; t += sudokuTel(g, buren, limiet - t); g[beste] = 0; if (t >= limiet) break; }
  return t;
}
function sudokuVul(g, buren, rng, teller) {
  let beste = -1, bm = 0, bn = 10;
  for (let i = 0; i < 81; i++) if (!g[i]) {
    const m = gebruikt(g, i, buren), n = vrijTel(m);
    if (n === 0) return false;
    if (n < bn) { beste = i; bm = m; bn = n; }
  }
  if (beste < 0) return true;
  if (++teller.n > 30000) return false;
  for (const v of schud([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(v => !(bm >> v & 1)), rng)) {
    g[beste] = v; if (sudokuVul(g, buren, rng, teller)) return true; g[beste] = 0;
    if (teller.n > 30000) return false;
  }
  return false;
}
function sudokuUitdunnen(opl, buren, rng, gegeven) {
  const puz = opl.slice(); let aantal = 81;
  for (const i of schud(reeks(81), rng)) {
    if (aantal <= gegeven) break;
    const oud = puz[i]; puz[i] = 0;
    if (sudokuTel(puz.slice(), buren, 2) === 1) aantal--; else puz[i] = oud;
  }
  return puz;
}
function sudokuSvg(puz, regio) {
  const c = 84 / 9; let s = svgKop(84, 84);
  for (let i = 0; i <= 9; i++) { s += lijn(0, i * c, 84, i * c, 0.25, '') + lijn(i * c, 0, i * c, 84, 0.25, ''); }
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), k = i % 9, x = k * c, y = r * c;
    if (k === 8 || regio[i] !== regio[i + 1]) s += lijn(x + c, y, x + c, y + c, 1);
    if (k === 0) s += lijn(x, y, x, y + c, 1);
    if (r === 8 || regio[i] !== regio[i + 9]) s += lijn(x, y + c, x + c, y + c, 1);
    if (r === 0) s += lijn(x, y, x + c, y, 1);
    if (puz[i]) s += tekstSvg(x + c / 2, y + c / 2 + 0.3, puz[i], 6.2, ' font-weight="600"');
  }
  return s + '</svg>';
}
const rijenTekst = (g, n, kar) => reeks(n).map(r => reeks(n).map(c => kar(g[r * n + c], r, c)).join('')).join(' ');

function maakSudoku(rng) {
  const opl = new Array(81).fill(0); sudokuVul(opl, BUREN_DOOS, rng, { n: 0 });
  const puz = sudokuUitdunnen(opl, BUREN_DOOS, rng, 28);
  return { html: sudokuSvg(puz, DOOS), oplossing: opl.join(''), intern: { puz, opl } };
}

/* ---- Chaos sudoku: onregelmatige gebieden i.p.v. 3x3-blokken ---- */
function maakGebieden(rng) {
  const naast = i => { const r = Math.floor(i / 9), c = i % 9, u = []; if (r > 0) u.push(i - 9); if (r < 8) u.push(i + 9); if (c > 0) u.push(i - 1); if (c < 8) u.push(i + 1); return u; };
  for (let poging = 0; poging < 2000; poging++) {
    const reg = new Array(81).fill(-1), cellen = reeks(9).map(() => []);
    const kol = schud(reeks(9), rng);
    for (let r = 0; r < 9; r++) { reg[r * 9 + kol[r]] = r; cellen[r].push(r * 9 + kol[r]); }
    let vrij = 72, vast = false;
    while (vrij > 0 && !vast) {
      const kand = reeks(9).filter(id => cellen[id].length < 9);
      const min = Math.min(...kand.map(id => cellen[id].length));
      const volgorde = schud(kand.filter(id => cellen[id].length <= min + 1), rng);
      let gelukt = false;
      for (const id of volgorde) {
        const opties = [];
        for (const i of cellen[id]) for (const j of naast(i)) if (reg[j] < 0) opties.push(j);
        if (!opties.length) continue;
        const j = opties[Math.floor(rng() * opties.length)];
        reg[j] = id; cellen[id].push(j); vrij--; gelukt = true; break;
      }
      if (!gelukt) vast = true;
    }
    if (!vast && cellen.every(c => c.length === 9)) return reg;
  }
  throw new Error('geen gebieden');
}
function maakChaos(rng) {
  for (let poging = 0; poging < 60; poging++) {
    const reg = maakGebieden(rng), buren = maakBuren(reg), opl = new Array(81).fill(0);
    if (!sudokuVul(opl, buren, rng, { n: 0 })) continue;
    const puz = sudokuUitdunnen(opl, buren, rng, 31);
    return { html: sudokuSvg(puz, reg), oplossing: opl.join(''), intern: { reg, puz, opl } };
  }
  throw new Error('geen chaos-sudoku');
}

/* ---- Killer sudoku: kooien met een som ---- */
function killerOplossingen(kooi, doel, grootte, vast, limiet) {
  let knopen = 0;
  const g = vast.slice(), som = new Array(doel.length).fill(0), tel = new Array(doel.length).fill(0), masker = new Array(doel.length).fill(0);
  for (let i = 0; i < 81; i++) if (g[i]) { const k = kooi[i]; som[k] += g[i]; tel[k]++; masker[k] |= 1 << g[i]; }
  const uit = [];
  const min = k => k * (k + 1) / 2, max = k => { let s = 0; for (let v = 9; v > 9 - k; v--) s += v; return s; };
  (function rec() {
    if (++knopen > 60000) { uit.afgebroken = true; return; }
    let beste = -1, bm = 0, bn = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const k = kooi[i]; let m = gebruikt(g, i, BUREN_DOOS) | masker[k], n = 0, ok = 0;
      for (let v = 1; v <= 9; v++) {
        if (m >> v & 1) continue;
        const s = som[k] + v, rest = grootte[k] - tel[k] - 1, over = doel[k] - s;
        if (rest === 0 ? over === 0 : (over >= min(rest) && over <= max(rest))) { n++; ok |= 1 << v; }
      }
      if (n === 0) return;
      if (n < bn) { beste = i; bm = ok; bn = n; if (n === 1) break; }
    }
    if (beste < 0) { uit.push(g.slice()); return; }
    const k = kooi[beste];
    for (let v = 1; v <= 9 && uit.length < limiet && !uit.afgebroken; v++) if (bm >> v & 1) {
      g[beste] = v; som[k] += v; tel[k]++; masker[k] |= 1 << v;
      rec();
      g[beste] = 0; som[k] -= v; tel[k]--; masker[k] &= ~(1 << v);
    }
  })();
  return uit;
}
function maakKiller(rng) {
  for (let poging = 0; poging < 40; poging++) {
    const opl = new Array(81).fill(0); sudokuVul(opl, BUREN_DOOS, rng, { n: 0 });
    const kooi = new Array(81).fill(-1); let aantal = 0;
    const naast = i => { const r = Math.floor(i / 9), c = i % 9, u = []; if (r > 0) u.push(i - 9); if (r < 8) u.push(i + 9); if (c > 0) u.push(i - 1); if (c < 8) u.push(i + 1); return u; };
    for (const start of schud(reeks(81), rng)) {
      if (kooi[start] >= 0) continue;
      const doelGrootte = [2, 2, 3, 3, 3, 4, 4][Math.floor(rng() * 7)], leden = [start];
      kooi[start] = aantal; let cijfers = 1 << opl[start];
      while (leden.length < doelGrootte) {
        const opties = []; for (const i of leden) for (const j of naast(i)) if (kooi[j] < 0 && !(cijfers >> opl[j] & 1)) opties.push(j);
        if (!opties.length) break;
        const j = opties[Math.floor(rng() * opties.length)]; kooi[j] = aantal; leden.push(j); cijfers |= 1 << opl[j];
      }
      aantal++;
    }
    const doel = new Array(aantal).fill(0), grootte = new Array(aantal).fill(0);
    for (let i = 0; i < 81; i++) { doel[kooi[i]] += opl[i]; grootte[kooi[i]]++; }
    // maak de oplossing uniek door telkens één cijfer te onthullen waar twee oplossingen verschillen
    const vast = new Array(81).fill(0); let lukt = false;
    for (const i of schud(reeks(81), rng).slice(0, 5)) vast[i] = opl[i];
    for (let ronde = 0; ronde < 60; ronde++) {
      const sols = killerOplossingen(kooi, doel, grootte, vast, 2);
      if (sols.length === 1 && !sols.afgebroken) { lukt = true; break; }
      if (sols.length === 0 && !sols.afgebroken) break;
      const i = sols.length > 1 ? reeks(81).find(x => sols[0][x] !== sols[1][x]) : schud(reeks(81).filter(x => !vast[x]), rng)[0];
      vast[i] = opl[i];
    }
    if (!lukt) continue;
    return { html: killerSvg(kooi, doel, vast), oplossing: opl.join(''), intern: { kooi, doel, vast, opl } };
  }
  throw new Error('geen killer');
}
function killerSvg(kooi, doel, vast) {
  const c = 84 / 9; let s = svgKop(84, 84);
  for (let i = 0; i <= 9; i++) { s += lijn(0, i * c, 84, i * c, 0.2, ' stroke-opacity="0.45"') + lijn(i * c, 0, i * c, 84, 0.2, ' stroke-opacity="0.45"'); }
  for (let i = 0; i <= 9; i += 3) { s += lijn(0, i * c, 84, i * c, 0.9) + lijn(i * c, 0, i * c, 84, 0.9); }
  const gezien = new Set(), d = 0.9; // streepjeslijn van de kooi, iets naar binnen
  const rand = (i, zijde) => { const r = Math.floor(i / 9), k = i % 9; return zijde === 0 ? (r === 0 || kooi[i - 9] !== kooi[i]) : zijde === 1 ? (k === 8 || kooi[i + 1] !== kooi[i]) : zijde === 2 ? (r === 8 || kooi[i + 9] !== kooi[i]) : (k === 0 || kooi[i - 1] !== kooi[i]); };
  const stip = ' stroke-dasharray="1.1 0.8" stroke-width="0.3"';
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), k = i % 9, x = k * c, y = r * c, e = 0.35;
    const ox = rand(i, 3) ? d : 0, ex = rand(i, 1) ? c - d : c, oy = rand(i, 0) ? d : 0, ey = rand(i, 2) ? c - d : c;
    if (rand(i, 0)) s += lijn(x + ox, y + d, x + ex, y + d, 0.3, stip.replace(' stroke-width="0.3"', ''));
    if (rand(i, 2)) s += lijn(x + ox, y + c - d, x + ex, y + c - d, 0.3, stip.replace(' stroke-width="0.3"', ''));
    if (rand(i, 3)) s += lijn(x + d, y + oy, x + d, y + ey, 0.3, stip.replace(' stroke-width="0.3"', ''));
    if (rand(i, 1)) s += lijn(x + c - d, y + oy, x + c - d, y + ey, 0.3, stip.replace(' stroke-width="0.3"', ''));
    if (!gezien.has(kooi[i])) { gezien.add(kooi[i]); s += '<text x="' + (x + 1.2) + '" y="' + (y + 2.9) + '" font-size="3.1" fill="' + ink + '">' + doel[kooi[i]] + '</text>'; }
    if (vast[i]) s += tekstSvg(x + c / 2 + 0.4, y + c / 2 + 1.2, vast[i], 5.6, ' font-weight="600"');
  }
  return s + '</svg>';
}

/* ======================= Woordzoeker ======================= */
const THEMAS = {
  'Dieren': 'HOND KAT PAARD KONIJN EEKHOORN EGEL VOS HERT ZWAAN EEND HAAS MUIS KIKKER VLINDER SPIN OTTER MEEUW OLIFANT KAMEEL ZEEHOND'.split(' '),
  'Eten': 'BROOD KAAS FRIETEN SOEP APPEL PEER TOMAAT WORTEL PASTA RIJST VLEES TAART KOEK WAFEL CHOCOLADE BONEN SPRUITJES MOSSELEN ASPERGE POMPOEN'.split(' '),
  'Natuur': 'BOS BOOM RIVIER MEER STRAND DUIN HEUVEL BERG VELD WEIDE BLOEM GRAS WOLK REGEN WIND STORM MIST BEEK MOERAS HEIDE'.split(' '),
  'Sport': 'VOETBAL TENNIS ZWEMMEN FIETSEN HOCKEY JUDO TURNEN ROEIEN ZEILEN BASKET VOLLEYBAL ATLETIEK WIELRENNEN SCHERMEN KLIMMEN BOKSEN KARATE GOLF SKIEN DANSEN'.split(' '),
  'Stad': 'MARKT KERK BRUG PARK STATION STRAAT PLEIN TRAM HAVEN STADHUIS BELFORT LEIE SCHELDE THEATER MUSEUM STEEG KADE FONTEIN WINKEL TERRAS'.split(' '),
  'Muziek en kunst': 'GITAAR PIANO VIOOL TROMPET FLUIT ZANGER ORKEST KOOR LIED NOOT MELODIE RITME CONCERT FESTIVAL SCHILDER TEKENEN BEELD KLEUR PENSEEL DOEK'.split(' '),
  'Huis en tuin': 'KEUKEN KAMER TRAP DEUR RAAM DAK MUUR TUIN SCHUUR GARAGE BANK STOEL TAFEL KAST LAMP KUSSEN GORDIJN TAPIJT OVEN SCHOORSTEEN'.split(' '),
  'Reizen': 'VLIEGTUIG TREIN HOTEL KOFFER PASPOORT TICKET REIS VAKANTIE KAART ROUTE CAMPING TENT RUGZAK BAGAGE STRAND BOOT GIDS LUCHTHAVEN KOMPAS VALIES'.split(' '),
  'Beroepen': 'BAKKER SLAGER ARTS LERARES TIMMERMAN SCHILDER PILOOT BOER VISSER ADVOCAAT KAPPER JOURNALIST MECANICIEN VERPLEGER CHAUFFEUR LOODGIETER BOEKHOUDER ARCHITECT'.split(' '),
  'Film en media': 'CAMERA SCENARIO MONTAGE REGISSEUR ACTEUR ACTRICE LICHT GELUID SCENE STUDIO FILM SERIE TRAILER SCRIPT LENS BEELD PRODUCENT OBJECTIEF CAMERAMAN'.split(' '),
};
function maakWoordzoeker(rng) {
  const n = 12, namen = Object.keys(THEMAS), thema = namen[Math.floor(rng() * namen.length)];
  const RICHT = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
  const PIJL = { '0,1': '→', '1,0': '↓', '1,1': '↘', '-1,1': '↗', '0,-1': '←', '-1,0': '↑', '-1,-1': '↖', '1,-1': '↙' };
  const ALFABET = 'EEEEEEEENNNNNAAAATTTIIIOOORRRDDLLSSGGHKMBPVWUZJCF';
  for (let poging = 0; poging < 200; poging++) {
    const woorden = schud(THEMAS[thema].filter(w => w.length >= 4 && w.length <= 10), rng).slice(0, 12).sort((a, b) => b.length - a.length);
    const grid = new Array(n * n).fill(''), geplaatst = []; let ok = true;
    for (const w of woorden) {
      let gelukt = false;
      for (let t = 0; t < 300 && !gelukt; t++) {
        const [dr, dc] = RICHT[Math.floor(rng() * 8)], r0 = Math.floor(rng() * n), c0 = Math.floor(rng() * n);
        const r1 = r0 + dr * (w.length - 1), c1 = c0 + dc * (w.length - 1);
        if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
        let past = true;
        for (let k = 0; k < w.length && past; k++) { const x = grid[(r0 + dr * k) * n + c0 + dc * k]; if (x && x !== w[k]) past = false; }
        if (!past) continue;
        for (let k = 0; k < w.length; k++) grid[(r0 + dr * k) * n + c0 + dc * k] = w[k];
        geplaatst.push({ w, r: r0, c: c0, p: PIJL[dr + ',' + dc] }); gelukt = true;
      }
      if (!gelukt) { ok = false; break; }
    }
    if (!ok) continue;
    for (let i = 0; i < n * n; i++) if (!grid[i]) grid[i] = ALFABET[Math.floor(rng() * ALFABET.length)];
    const cel = 6.4, x0 = (84 - n * cel) / 2; let s = svgKop(84, 96);
    for (let i = 0; i < n * n; i++) s += tekstSvg(x0 + (i % n + 0.5) * cel, (Math.floor(i / n) + 0.5) * cel + 0.3, grid[i], 4.6, ' font-weight="600"');
    s += '<rect x="' + x0 + '" y="0" width="' + n * cel + '" height="' + n * cel + '" fill="none" stroke="' + ink + '" stroke-width="0.6"/>';
    const lijstOp = woorden.slice().sort();
    lijstOp.forEach((w, i) => { s += '<text x="' + (3 + Math.floor(i / 4) * 28.5) + '" y="' + (n * cel + 5 + (i % 4) * 4.6) + '" font-size="3.3" fill="' + ink + '">' + w + '</text>'; });
    return { html: s + '</svg>', oplossing: geplaatst.map(p => p.w + ' ' + (p.r + 1) + ',' + (p.c + 1) + p.p).join(' '), intern: { geplaatst, grid, n } };
  }
  throw new Error('geen woordzoeker');
}

/* ======================= Nonogram ======================= */
function lijnMogelijkheden(clue, lijn) {
  const n = lijn.length, kan = [new Array(n).fill(false), new Array(n).fill(false)], cur = new Array(n).fill(0); let any = false;
  (function plaats(bi, pos) {
    if (bi === clue.length) {
      for (let p = pos; p < n; p++) { if (lijn[p] === 1) return; cur[p] = 0; }
      any = true; for (let p = 0; p < n; p++) kan[cur[p]][p] = true; return;
    }
    const len = clue[bi]; let rest = 0; for (let k = bi + 1; k < clue.length; k++) rest += clue[k] + 1;
    for (let start = pos; start + len + rest <= n; start++) {
      let vrij = true; for (let p = pos; p < start; p++) if (lijn[p] === 1) { vrij = false; break; }
      if (!vrij) break;
      let ok = true; for (let p = start; p < start + len; p++) if (lijn[p] === 0) { ok = false; break; }
      if (!ok) continue;
      const na = start + len; if (na < n && lijn[na] === 1) continue;
      for (let p = pos; p < start; p++) cur[p] = 0; for (let p = start; p < na; p++) cur[p] = 1; if (na < n) cur[na] = 0;
      plaats(bi + 1, Math.min(n, na + 1));
    }
  })(0, 0);
  return any ? kan : null;
}
function nonoTel(rc, cc, n, limiet) {
  let aantal = 0;
  (function rec(g) {
    let veranderd = true;
    while (veranderd) {
      veranderd = false;
      for (let l = 0; l < 2 * n; l++) {
        const rij = l < n, k = l % n, idx = reeks(n).map(p => rij ? k * n + p : p * n + k);
        const kan = lijnMogelijkheden(rij ? rc[k] : cc[k], idx.map(i => g[i]));
        if (!kan) return;
        idx.forEach((i, p) => { if (g[i] < 0) { if (kan[0][p] && !kan[1][p]) { g[i] = 0; veranderd = true; } else if (kan[1][p] && !kan[0][p]) { g[i] = 1; veranderd = true; } } });
      }
    }
    const i = g.indexOf(-1);
    if (i < 0) { aantal++; return; }
    for (const v of [1, 0]) { if (aantal >= limiet) return; const h = g.slice(); h[i] = v; rec(h); }
  })(new Int8Array(n * n).fill(-1));
  return aantal;
}
const nonoClues = (g, n, rij) => reeks(n).map(k => { const uit = []; let t = 0; for (let p = 0; p < n; p++) { if (g[rij ? k * n + p : p * n + k]) t++; else if (t) { uit.push(t); t = 0; } } if (t) uit.push(t); return uit; });
function maakNonogram(rng) {
  const n = 10;
  for (let poging = 0; poging < 3000; poging++) {
    const g = reeks(n * n).map(() => (rng() < 0.55 ? 1 : 0));
    const rc = nonoClues(g, n, true), cc = nonoClues(g, n, false);
    if (rc.some(c => !c.length) || cc.some(c => !c.length)) continue;
    if (nonoTel(rc, cc, n, 2) !== 1) continue;
    const mr = Math.max(...rc.map(c => c.length)), mc = Math.max(...cc.map(c => c.length));
    const cel = Math.min(84 / (n + mr), 84 / (n + mc)), x0 = mr * cel, y0 = mc * cel; let s = svgKop(x0 + n * cel, y0 + n * cel);
    for (let i = 0; i <= n; i++) {
      const dik = i % 5 === 0 ? 0.7 : 0.25;
      s += lijn(x0, y0 + i * cel, x0 + n * cel, y0 + i * cel, dik) + lijn(x0 + i * cel, y0, x0 + i * cel, y0 + n * cel, dik);
    }
    rc.forEach((c, r) => c.forEach((v, k) => { s += tekstSvg(x0 - (c.length - k - 0.5) * cel, y0 + (r + 0.5) * cel + 0.2, v, cel * 0.62, ' font-weight="600"'); }));
    cc.forEach((c, k) => c.forEach((v, r) => { s += tekstSvg(x0 + (k + 0.5) * cel, y0 - (c.length - r - 0.5) * cel + 0.2, v, cel * 0.62, ' font-weight="600"'); }));
    return { html: s + '</svg>', oplossing: rijenTekst(g, n, v => (v ? '#' : '.')), intern: { g, rc, cc } };
  }
  throw new Error('geen nonogram');
}

/* ======================= Light up ======================= */
function lichtTel(n, wit, ziet, rond, getal, limiet) {
  const N = n * n; let aantal = 0; const genummerd = Object.keys(getal).map(Number);
  (function rec(val) {
    let veranderd = true;
    while (veranderd) {
      veranderd = false;
      for (let i = 0; i < N; i++) if (val[i] === 1) for (const j of ziet[i]) { if (val[j] === 1) return; if (val[j] === -1) { val[j] = 0; veranderd = true; } }
      for (const b of genummerd) {
        let bol = 0, onb = 0; for (const j of rond[b]) { if (val[j] === 1) bol++; else if (val[j] === -1) onb++; }
        if (bol > getal[b] || bol + onb < getal[b]) return;
        if (onb && bol === getal[b]) { for (const j of rond[b]) if (val[j] === -1) val[j] = 0; veranderd = true; }
        else if (onb && bol + onb === getal[b]) { for (const j of rond[b]) if (val[j] === -1) val[j] = 1; veranderd = true; }
      }
    }
    let beste = null;
    for (let i = 0; i < N; i++) if (wit[i]) {
      if (val[i] === 1 || ziet[i].some(j => val[j] === 1)) continue;
      const kand = [i, ...ziet[i]].filter(c => val[c] === -1);
      if (!kand.length) return;
      if (!beste || kand.length < beste.length) beste = kand;
    }
    if (!beste) { for (const b of genummerd) if (rond[b].filter(j => val[j] === 1).length !== getal[b]) return; aantal++; return; }
    for (let t = 0; t < beste.length && aantal < limiet; t++) {
      const v2 = val.slice(); for (let s = 0; s < t; s++) v2[beste[s]] = 0; v2[beste[t]] = 1; rec(v2);
    }
  })(Int8Array.from({ length: N }, (_, i) => (wit[i] ? -1 : 0)));
  return aantal;
}
function maakLicht(rng) {
  const n = 8, N = 64;
  for (let poging = 0; poging < 800; poging++) {
    const zwart = reeks(N).map(() => rng() < 0.2), wit = zwart.map(z => !z);
    if (zwart.filter(Boolean).length < 8) continue;
    const ziet = reeks(N).map(() => []);
    for (let i = 0; i < N; i++) if (wit[i]) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let r = Math.floor(i / n) + dr, c = i % n + dc;
      while (r >= 0 && r < n && c >= 0 && c < n && wit[r * n + c]) { ziet[i].push(r * n + c); r += dr; c += dc; }
    }
    const bol = new Array(N).fill(0), verlicht = new Array(N).fill(false);
    for (const i of schud(reeks(N).filter(i => wit[i]), rng)) if (!verlicht[i]) { bol[i] = 1; verlicht[i] = true; for (const j of ziet[i]) verlicht[j] = true; }
    const rond = {}, getal = {};
    reeks(N).filter(i => zwart[i]).forEach(b => {
      const r = Math.floor(b / n), c = b % n;
      rond[b] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, d]) => a >= 0 && a < n && d >= 0 && d < n && wit[a * n + d]).map(([a, d]) => a * n + d);
      getal[b] = rond[b].filter(j => bol[j]).length;
    });
    if (lichtTel(n, wit, ziet, rond, getal, 2) !== 1) continue;
    for (const b of schud(Object.keys(getal).map(Number), rng)) {
      const oud = getal[b]; delete getal[b];
      if (lichtTel(n, wit, ziet, rond, getal, 2) !== 1) getal[b] = oud;
    }
    const cel = 84 / n; let s = svgKop(84, 84);
    for (let i = 0; i < N; i++) {
      const x = (i % n) * cel, y = Math.floor(i / n) * cel;
      s += '<rect x="' + x + '" y="' + y + '" width="' + cel + '" height="' + cel + '" fill="' + (zwart[i] ? ink : 'none') + '" stroke="' + ink + '" stroke-width="0.3"/>';
      if (zwart[i] && getal[i] !== undefined) s += '<text x="' + (x + cel / 2) + '" y="' + (y + cel / 2 + 0.3) + '" font-size="6.4" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="#fff">' + getal[i] + '</text>';
    }
    s += '<rect x="0" y="0" width="84" height="84" fill="none" stroke="' + ink + '" stroke-width="0.9"/>';
    return { html: s + '</svg>', oplossing: rijenTekst(reeks(N).map(i => (zwart[i] ? '#' : bol[i] ? 'L' : '.')), n, v => v), intern: { zwart, bol, getal } };
  }
  throw new Error('geen light up');
}

/* ======================= Binairo ======================= */
function binairoPropageer(g, n) {
  const half = n / 2; let veranderd = true;
  const zet = (i, v) => { g[i] = v; veranderd = true; };
  while (veranderd) {
    veranderd = false;
    for (let l = 0; l < 2 * n; l++) {
      const rij = l < n, k = l % n, idx = reeks(n).map(p => rij ? k * n + p : p * n + k);
      let c0 = 0, c1 = 0;
      for (let p = 0; p < n; p++) { const v = g[idx[p]]; if (v === 0) c0++; else if (v === 1) c1++; }
      if (c0 > half || c1 > half) return false;
      for (let p = 0; p + 2 < n; p++) { const a = g[idx[p]]; if (a >= 0 && a === g[idx[p + 1]] && a === g[idx[p + 2]]) return false; }
      for (let p = 0; p < n; p++) if (g[idx[p]] < 0) {
        let forceer = -1;
        if (p >= 2 && g[idx[p - 1]] >= 0 && g[idx[p - 1]] === g[idx[p - 2]]) forceer = 1 - g[idx[p - 1]];
        else if (p + 2 < n && g[idx[p + 1]] >= 0 && g[idx[p + 1]] === g[idx[p + 2]]) forceer = 1 - g[idx[p + 1]];
        else if (p >= 1 && p + 1 < n && g[idx[p - 1]] >= 0 && g[idx[p - 1]] === g[idx[p + 1]]) forceer = 1 - g[idx[p - 1]];
        if (forceer < 0 && c0 === half) forceer = 1;
        if (forceer < 0 && c1 === half) forceer = 0;
        if (forceer >= 0) { zet(idx[p], forceer); if (forceer) c1++; else c0++; }
      }
    }
  }
  return true;
}
function binairoUniek(g, n) {
  const rij = k => g.slice(k * n, k * n + n).join(''), kol = k => reeks(n).map(p => g[p * n + k]).join('');
  const r = reeks(n).map(rij), c = reeks(n).map(kol);
  return new Set(r).size === n && new Set(c).size === n;
}
function binairoTel(start, n, limiet, rng, maxKnopen) {
  let aantal = 0, eerste = null, knopen = 0, afgebroken = false;
  (function rec(g) {
    if (aantal >= limiet || afgebroken) return;
    if (maxKnopen && ++knopen > maxKnopen) { afgebroken = true; return; }
    if (!binairoPropageer(g, n)) return;
    const i = g.indexOf(-1);
    if (i < 0) { if (binairoUniek(g, n)) { aantal++; if (!eerste) eerste = g.slice(); } return; }
    const volgorde = rng && rng() < 0.5 ? [1, 0] : [0, 1];
    for (const v of volgorde) { const h = g.slice(); h[i] = v; rec(h); }
  })(Int8Array.from(start));
  return { aantal, eerste, afgebroken };
}
function maakBinairo(rng) {
  const n = 10;
  for (let poging = 0; poging < 20; poging++) {
    const opl = binairoTel(new Int8Array(n * n).fill(-1), n, 1, rng, 3000).eerste;
    if (!opl) continue;
    const puz = Int8Array.from(opl); let gegeven = n * n;
    for (const i of schud(reeks(n * n), rng)) {
      if (gegeven <= 34) break;
      const oud = puz[i]; puz[i] = -1;
      const t = binairoTel(puz, n, 2, null, 4000);
      if (t.aantal !== 1 || t.afgebroken) puz[i] = oud; else gegeven--;
    }
    const cel = 84 / n; let s = svgKop(84, 84);
    for (let i = 0; i <= n; i++) s += lijn(0, i * cel, 84, i * cel, 0.25) + lijn(i * cel, 0, i * cel, 84, 0.25);
    s += '<rect x="0" y="0" width="84" height="84" fill="none" stroke="' + ink + '" stroke-width="0.9"/>';
    for (let i = 0; i < n * n; i++) if (puz[i] >= 0) s += tekstSvg((i % n + 0.5) * cel, (Math.floor(i / n) + 0.5) * cel + 0.3, puz[i], 6, ' font-weight="600"');
    return { html: s + '</svg>', oplossing: rijenTekst(opl, n, v => v), intern: { puz, opl } };
  }
  throw new Error('geen binairo');
}

/* ======================= Tectonic ======================= */
function tectonicGebieden(rng, R, C) {
  const naast = i => { const r = Math.floor(i / C), c = i % C, u = []; if (r > 0) u.push(i - C); if (r < R - 1) u.push(i + C); if (c > 0) u.push(i - 1); if (c < C - 1) u.push(i + 1); return u; };
  const reg = new Array(R * C).fill(-1); let id = 0;
  for (const start of schud(reeks(R * C), rng)) {
    if (reg[start] >= 0) continue;
    const doel = [3, 3, 4, 4, 5, 5][Math.floor(rng() * 6)], leden = [start]; reg[start] = id;
    while (leden.length < doel) {
      const opties = []; for (const i of leden) for (const j of naast(i)) if (reg[j] < 0) opties.push(j);
      if (!opties.length) break;
      const j = opties[Math.floor(rng() * opties.length)]; reg[j] = id; leden.push(j);
    }
    id++;
  }
  const grootte = () => { const g = {}; reg.forEach(x => { g[x] = (g[x] || 0) + 1; }); return g; };
  for (let ronde = 0; ronde < 4; ronde++) {
    const g = grootte();
    for (let i = 0; i < R * C; i++) if (g[reg[i]] <= 2) {
      const doelen = naast(i).filter(j => reg[j] !== reg[i] && grootte()[reg[j]] < 5);
      if (doelen.length && grootte()[reg[i]] === 1) reg[i] = reg[doelen[Math.floor(rng() * doelen.length)]];
    }
  }
  return { reg, naast, grootte: grootte() };
}
function tectonicNabij(R, C) {
  return reeks(R * C).map(i => { const r = Math.floor(i / C), c = i % C, u = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if ((a || b) && r + a >= 0 && r + a < R && c + b >= 0 && c + b < C) u.push((r + a) * C + c + b); return u; });
}
function tectonicTel(g, reg, gr, nabij, leden, limiet, rng, maxKnopen) {
  let aantal = 0, eerste = null, knopen = 0, afgebroken = false;
  (function rec() {
    if (maxKnopen && ++knopen > maxKnopen) { afgebroken = true; return; }
    let beste = -1, bk = null;
    for (let i = 0; i < g.length; i++) if (!g[i]) {
      const m = gr[reg[i]]; let gebruiktM = 0;
      for (const j of leden[reg[i]]) if (g[j]) gebruiktM |= 1 << g[j];
      for (const j of nabij[i]) if (g[j]) gebruiktM |= 1 << g[j];
      const kand = []; for (let v = 1; v <= m; v++) if (!(gebruiktM >> v & 1)) kand.push(v);
      if (!kand.length) return;
      if (!bk || kand.length < bk.length) { beste = i; bk = kand; if (kand.length === 1) break; }
    }
    if (beste < 0) { aantal++; if (!eerste) eerste = g.slice(); return; }
    for (const v of (rng ? schud(bk.slice(), rng) : bk)) { if (aantal >= limiet || afgebroken) return; g[beste] = v; rec(); g[beste] = 0; }
  })();
  return { aantal, eerste, afgebroken };
}
function maakTectonic(rng) {
  const R = 7, C = 7;
  for (let poging = 0; poging < 300; poging++) {
    const { reg, grootte } = tectonicGebieden(rng, R, C), nabij = tectonicNabij(R, C);
    const leden = {}; reg.forEach((x, i) => { (leden[x] = leden[x] || []).push(i); });
    const gr = grootte;
    const opl = tectonicTel(new Array(R * C).fill(0), reg, gr, nabij, leden, 1, rng, 1500).eerste;
    if (!opl) continue;
    const puz = opl.slice(); let gegeven = R * C;
    for (const i of schud(reeks(R * C), rng)) { if (gegeven <= 11) break; const oud = puz[i]; puz[i] = 0; const t = tectonicTel(puz.slice(), reg, gr, nabij, leden, 2, null, 6000); if (t.aantal !== 1 || t.afgebroken) puz[i] = oud; else gegeven--; }
    const cel = 84 / C; let s = svgKop(84, 84);
    for (let i = 0; i <= C; i++) s += lijn(0, i * cel, 84, i * cel, 0.2, ' stroke-opacity="0.5"') + lijn(i * cel, 0, i * cel, 84, 0.2, ' stroke-opacity="0.5"');
    for (let i = 0; i < R * C; i++) {
      const r = Math.floor(i / C), c = i % C, x = c * cel, y = r * cel;
      if (c === C - 1 || reg[i] !== reg[i + 1]) s += lijn(x + cel, y, x + cel, y + cel, 1);
      if (c === 0) s += lijn(x, y, x, y + cel, 1);
      if (r === R - 1 || reg[i] !== reg[i + C]) s += lijn(x, y + cel, x + cel, y + cel, 1);
      if (r === 0) s += lijn(x, y, x + cel, y, 1);
      if (puz[i]) s += tekstSvg(x + cel / 2, y + cel / 2 + 0.4, puz[i], 7.4, ' font-weight="600"');
    }
    return { html: s + '</svg>', oplossing: rijenTekst(opl, C, v => v), intern: { reg, puz, opl, R, C } };
  }
  throw new Error('geen tectonic');
}

/* ======================= Tenten en bomen ======================= */
const BUREN4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function tentenOplossingen(n, bomen, rij, kol) {
  const boomset = new Set(bomen.map(b => b.join(','))), sols = new Set(), tent = [], tentset = new Set();
  const rc = new Array(n).fill(0), cc = new Array(n).fill(0);
  (function rec(i) {
    if (sols.size >= 2) return;
    if (i === bomen.length) { if (rc.every((v, x) => v === rij[x]) && cc.every((v, x) => v === kol[x])) sols.add(tent.map(t => t.join(',')).sort().join('|')); return; }
    const [br, bc] = bomen[i];
    for (const [dr, dc] of BUREN4) {
      const r = br + dr, c = bc + dc, key = r + ',' + c;
      if (r < 0 || r >= n || c < 0 || c >= n || boomset.has(key) || tentset.has(key)) continue;
      if (tent.some(([a, b]) => Math.max(Math.abs(r - a), Math.abs(c - b)) <= 1)) continue;
      if (rc[r] + 1 > rij[r] || cc[c] + 1 > kol[c]) continue;
      tent.push([r, c]); tentset.add(key); rc[r]++; cc[c]++;
      rec(i + 1);
      tent.pop(); tentset.delete(key); rc[r]--; cc[c]--;
    }
  })(0);
  return sols;
}
function maakTenten(rng) {
  const n = 8, aantal = 11;
  for (let poging = 0; poging < 5000; poging++) {
    const k = poging < 3000 ? aantal : aantal - 1;
    const cellen = schud(reeks(n * n).map(i => [Math.floor(i / n), i % n]), rng), tenten = [];
    for (const [a, b] of cellen) { if (tenten.length === k) break; if (tenten.every(([x, y]) => Math.max(Math.abs(a - x), Math.abs(b - y)) > 1)) tenten.push([a, b]); }
    if (tenten.length < k) continue;
    const tentkeys = new Set(tenten.map(t => t.join(','))), bomen = []; let ok = true;
    for (const [a, b] of tenten) {
      const opt = BUREN4.map(([dr, dc]) => [a + dr, b + dc]).filter(([x, y]) => x >= 0 && x < n && y >= 0 && y < n && !tentkeys.has(x + ',' + y) && !bomen.some(q => q[0] === x && q[1] === y));
      if (!opt.length) { ok = false; break; }
      bomen.push(opt[Math.floor(rng() * opt.length)]);
    }
    if (!ok) continue;
    const rij = reeks(n).map(i => tenten.filter(t => t[0] === i).length), kol = reeks(n).map(i => tenten.filter(t => t[1] === i).length);
    const gesorteerd = bomen.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    if (tentenOplossingen(n, gesorteerd, rij, kol).size !== 1) continue;
    const cel = 84 / (n + 1); let s = svgKop(84, 84);
    for (let i = 0; i <= n; i++) s += lijn(cel, cel + i * cel, 84, cel + i * cel, 0.25) + lijn(cel + i * cel, cel, cel + i * cel, 84, 0.25);
    s += '<rect x="' + cel + '" y="' + cel + '" width="' + n * cel + '" height="' + n * cel + '" fill="none" stroke="' + ink + '" stroke-width="0.9"/>';
    kol.forEach((v, c) => { s += '<text x="' + (cel + (c + 0.5) * cel) + '" y="' + (cel / 2 + 0.3) + '" font-size="5.6" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="' + grijs + '">' + v + '</text>'; });
    rij.forEach((v, r) => { s += '<text x="' + (cel / 2) + '" y="' + (cel + (r + 0.5) * cel + 0.3) + '" font-size="5.6" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="' + grijs + '">' + v + '</text>'; });
    const sc = cel * 0.72 / 10;
    for (const [r, c] of bomen) s += '<g transform="translate(' + (cel + c * cel + cel * 0.14) + ',' + (cel + r * cel + cel * 0.12) + ') scale(' + sc + ')"><path d="M5 .5L9 6H1zM5 3l4.2 5.5H.8z" fill="' + ink + '"/><rect x="4.3" y="8.5" width="1.4" height="1.5" fill="' + ink + '"/></g>';
    return { html: s + '</svg>', oplossing: reeks(n).map(r => reeks(n).map(c => (tenten.some(t => t[0] === r && t[1] === c) ? 'A' : '.')).join('')).join(' '), intern: { n, bomen: gesorteerd, tenten, rij, kol } };
  }
  throw new Error('geen tenten en bomen');
}

/* ======================= Rooster: 2 puzzels per dag, elk type even vaak ======================= */
const PUZZELS = {
  sudoku: { naam: 'Sudoku', maak: maakSudoku },
  killer: { naam: 'Killer sudoku', maak: maakKiller },
  chaos: { naam: 'Chaos sudoku', maak: maakChaos },
  woordzoeker: { naam: 'Woordzoeker', maak: maakWoordzoeker },
  nonogram: { naam: 'Nonogram', maak: maakNonogram },
  licht: { naam: 'Light up', maak: maakLicht },
  binairo: { naam: 'Binairo', maak: maakBinairo },
  tectonic: { naam: 'Tectonic', maak: maakTectonic },
  tenten: { naam: 'Tenten en bomen', maak: maakTenten },
};
const PUZZELTYPES = Object.keys(PUZZELS);
// Elke 9 dagen komt elk type precies twee keer aan bod (2 puzzels per dag, nooit tweemaal hetzelfde type op één dag).
function kiesPuzzels(dagnr) {
  const L = PUZZELTYPES.length, ronde = Math.floor(dagnr / L), rng = maakRng(ronde * 7919 + 13);
  const a = schud(PUZZELTYPES.slice(), rng), b = schud(PUZZELTYPES.slice(), rng);
  if (b[0] === a[L - 1]) [b[0], b[1]] = [b[1], b[0]]; // dezelfde puzzel mag niet op één dag twee keer staan
  const rij = a.concat(b), p = ((dagnr % L) + L) % L;
  return [rij[2 * p], rij[2 * p + 1]];
}
function maakPuzzel(type, rng) {
  try { return Object.assign({ naam: PUZZELS[type].naam, type }, PUZZELS[type].maak(rng)); }
  catch (e) { return Object.assign({ naam: PUZZELS.sudoku.naam, type: 'sudoku' }, maakSudoku(rng)); }
}
if (typeof module !== 'undefined') module.exports = { maakRng, PUZZELS, PUZZELTYPES, kiesPuzzels, maakPuzzel, nonoTel, nonoClues, lichtTel, binairoTel, tectonicTel, killerOplossingen, sudokuTel, maakBuren, DOOS };
