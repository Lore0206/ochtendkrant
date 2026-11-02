'use strict';
/* De Ochtendkrant – webversie. Haalt weer, quote en nieuws op, maakt puzzels en bouwt de krant op (2 A4-pagina's). */

const CONFIG = {
  LAT: 51.0543, LON: 3.7174, // Gent
  NIEUWS_FEED: 'https://www.vrt.be/vrtnws/nl.rss.articles.xml',
  QUOTE_FEED: 'https://www.brainyquote.com/link/quotebr.rss',
  // Als een feed niet rechtstreeks kan, proberen we deze doorgeefluiken (alleen openbare feeds, geen persoonlijke gegevens)
  PROXIES: [
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  ],
  TIMEOUT_MS: 6000,
  QUOTE_BRON_VERMELDEN: true, // kleine bronvermelding onderaan; zet op false om die weg te laten
  GOOGLE_CLIENT_ID: '605238330372-81mk6hhbod8f1gcpinbfm1ibeadncv33.apps.googleusercontent.com',
};

const DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const WEERCODES = {
  0: 'Helder', 1: 'Overwegend helder', 2: 'Wisselend bewolkt', 3: 'Bewolkt', 45: 'Mist', 48: 'Rijpmist',
  51: 'Lichte motregen', 53: 'Motregen', 55: 'Zware motregen', 56: 'Lichte ijzel', 57: 'Ijzel',
  61: 'Lichte regen', 63: 'Regen', 65: 'Zware regen', 66: 'Lichte ijzel', 67: 'Ijzel',
  71: 'Lichte sneeuw', 73: 'Sneeuw', 75: 'Zware sneeuw', 77: 'Sneeuwkorrels',
  80: 'Lichte buien', 81: 'Buien', 82: 'Zware buien', 85: 'Sneeuwbuien', 86: 'Zware sneeuwbuien',
  95: 'Onweer', 96: 'Onweer met hagel', 99: 'Zwaar onweer met hagel',
};
const SPREUKEN = [
  ['Een goed begin is het halve werk.', 'spreekwoord'], ['Oefening baart kunst.', 'spreekwoord'],
  ['Wie niet waagt, niet wint.', 'spreekwoord'], ['Na regen komt zonneschijn.', 'spreekwoord'],
  ['Al doende leert men.', 'spreekwoord'], ['Beter laat dan nooit.', 'spreekwoord'],
  ['Kleine stappen brengen je ook ver.', 'spreekwoord'], ['Wie begint, is al halverwege.', 'spreekwoord'],
];

const DEMO = {
  weer: { tmax: 11, tmin: 5, code: 2, wind: 22,
    uren: [[6,0],[7,0],[8,5],[9,10],[10,20],[11,30],[11,40],[11,50],[10,60],[10,45],[9,30],[8,15],[7,10],[7,5],[6,0]] },
  nieuws: [
    ['Voorbeeldkop van het eerste nieuwsbericht', 'Dit is een voorbeeldtekst. Ze bestaat uit enkele zinnen met de kern van het verhaal. Een derde zin geeft wat achtergrond. Een vierde zin vult dat aan met een reactie.', 'Politiek'],
    ['Voorbeeldkop van het tweede nieuwsbericht', 'Een korte samenvatting in één of twee zinnen, genoeg om de kern van het bericht te begrijpen.'],
    ['Voorbeeldkop van het derde nieuwsbericht', 'Een korte samenvatting in één of twee zinnen, genoeg om de kern van het bericht te begrijpen.'],
    ['Voorbeeldkop van het vierde nieuwsbericht', 'Een korte samenvatting in één of twee zinnen, genoeg om de kern van het bericht te begrijpen.'],
  ],
  feitje: { taal: 'nl', dag: 2, maand: 'november', jaar: 1936, tekst: 'Dit is een voorbeeld van een feitje van de dag, met een korte omschrijving van wat er op deze dag gebeurde.', titel: 'Onderwerp', uitleg: 'Hier staat wat meer uitleg over het onderwerp, zodat je iets nieuws leest. Een tweede zin vult dat aan met nog wat achtergrond en context om rustig door te lezen.' },
  quotes: [['Voorbeeldquote van de dag.', 'Auteur'], ['Een tweede voorbeeldquote.', 'Auteur']],
  todos: ['Opdracht indienen', 'Boodschappen doen', 'Training voorbereiden', 'Mail beantwoorden', 'Fiets laten nakijken'],
  agenda: { 0: ['10:00 Les ontwerp', '19:00 Training'], 2: ['10:00 Les', '16:30 Tandarts'], 4: ['Deadline opdracht', '19:30 Etentje'], 5: ['14:00 Wedstrijd'], 6: ['12:00 Familiebezoek'] },
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const $ = id => document.getElementById(id);

/* ---------- netwerk ---------- */
async function haalOp(url) {
  const probeer = async u => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), CONFIG.TIMEOUT_MS);
    try {
      const r = await fetch(u, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } finally { clearTimeout(t); }
  };
  try { return await probeer(url); } catch (e) { /* rechtstreeks lukt niet: doorgeefluik proberen */ }
  for (const p of CONFIG.PROXIES) {
    try { return await probeer(p(url)); } catch (e) { /* volgende */ }
  }
  throw new Error('niet bereikbaar: ' + url);
}
const parseXml = t => new DOMParser().parseFromString(t, 'text/xml');
const platteTekst = h => { const d = document.createElement('div'); d.innerHTML = h; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };

/* ---------- weer ---------- */
async function haalWeer() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CONFIG.LAT + '&longitude=' + CONFIG.LON +
    '&hourly=temperature_2m,precipitation_probability' +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max&timezone=Europe%2FBrussels&forecast_days=1';
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('weer HTTP ' + r.status);
  const d = await r.json();
  const per = {};
  d.hourly.time.forEach((t, i) => {
    const u = parseInt(t.slice(11, 13), 10);
    if (u >= 8 && u <= 22) per[u] = [Math.round(d.hourly.temperature_2m[i]), d.hourly.precipitation_probability[i] || 0];
  });
  return {
    tmax: Math.round(d.daily.temperature_2m_max[0]), tmin: Math.round(d.daily.temperature_2m_min[0]),
    code: d.daily.weather_code[0], wind: Math.round(d.daily.wind_speed_10m_max[0]),
    uren: Array.from({ length: 15 }, (_, i) => per[8 + i]),
  };
}
const maxRegen = w => Math.max(...w.uren.map(u => u[1]));
function windTekst(kmh) {
  if (kmh < 6) return 'Windstil';
  if (kmh < 20) return 'Een zachte wind';
  if (kmh < 30) return 'Een milde wind';
  if (kmh < 50) return 'Een stevige wind';
  if (kmh < 75) return 'Een harde wind';
  return 'Stormachtig weer';
}
function weerOmschrijving(w) {
  let t = (WEERCODES[w.code] || 'Wisselvallig') + '.';
  if (maxRegen(w) >= 30) t += ' Tot ' + maxRegen(w) + '% kans op regen.';
  return t + ' ' + windTekst(w.wind) + '.';
}
const regenUren = (w, drempel) => w.uren.map((u, i) => [8 + i, u[1]]).filter(x => x[1] >= drempel).map(x => x[0]);
function kledingAdvies(w) {
  const temps = w.uren.map(u => u[0]), hoog = Math.max(...temps), laag = Math.min(...temps);
  let gevoel = (hoog + laag) / 2; // gemiddelde van 8u tot 22u
  if (w.wind >= 50) gevoel -= 4; else if (w.wind >= 30) gevoel -= 2;
  const banden = [
    [0, 'Winterjas, muts, sjaal en handschoenen. Warm ondergoed is geen overbodige luxe.'],
    [4, 'Winterjas, muts, sjaal en handschoenen.'],
    [8, 'Warme jas, dikke trui en eventueel een sjaal.'],
    [11, 'Jas met voering en een trui.'],
    [14, 'Lichte jas en een trui of vest.'],
    [17, 'Vest of dun jasje over een longsleeve.'],
    [20, 'T-shirt met een dun vest.'],
    [24, 'T-shirt en lichte broek; een vest voor ’s avonds.'],
    [28, 'Luchtige zomerkleding.'],
  ];
  const band = banden.find(b => gevoel <= b[0]);
  let s = band ? band[1] : 'Heel luchtige kleding, zonnecrème en een flesje water.';
  if (hoog - laag >= 6 && gevoel < 20) s += ' Om 8u is het ' + temps[0] + '° en overdag tot ' + hoog + '°: kleed je in lagen.';
  const nat = regenUren(w, 50), bui = regenUren(w, 30);
  if (nat.length) s += ' Regenjas of paraplu mee: regen tussen ' + nat[0] + 'u en ' + (nat[nat.length - 1] + 1) + 'u.';
  else if (bui.length) s += ' Regenjas in je tas: kans op een bui rond ' + bui[0] + 'u.';
  if (w.wind >= 40) s += ' Een winddichte jas is aan te raden.';
  if ([56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(w.code)) s += ' Waterdichte schoenen, het kan glad zijn.';
  return s;
}

/* ---------- quotes en nieuws ---------- */
let feedsBelofte = null;
function haalFeeds() {
  if (!feedsBelofte) {
    feedsBelofte = fetch('data/feeds.json?t=' + Date.now(), { signal: AbortSignal.timeout(6000) })
      .then(r => { if (!r.ok) throw new Error('geen feeds.json'); return r.json(); });
  }
  return feedsBelofte;
}
async function uitFeedsBestand(sleutel) {
  try {
    const f = await haalFeeds();
    if (f && Array.isArray(f[sleutel]) && f[sleutel].length) { STAAT.feedDatum = f.datum || ''; return f[sleutel]; }
  } catch (e) { /* bestand ontbreekt: rechtstreeks proberen */ }
  return null;
}
async function haalFeitje() {
  try { const f = await haalFeeds(); return f && f.feitje && f.feitje.tekst ? f.feitje : null; } catch (e) { return null; }
}
async function haalQuotes() {
  const bestand = await uitFeedsBestand('quotes');
  if (bestand) return bestand.map(q => [q.tekst, q.auteur || '']);
  const xml = parseXml(await haalOp(CONFIG.QUOTE_FEED));
  const uit = [];
  xml.querySelectorAll('item').forEach(it => {
    const tekst = platteTekst(it.querySelector('description')?.textContent || '').replace(/^["“”]+|["“”]+$/g, '').trim();
    const auteur = platteTekst(it.querySelector('title')?.textContent || '');
    if (tekst) uit.push([tekst, auteur]);
  });
  if (uit.length < 1) throw new Error('geen quotes');
  return uit;
}
const zinnen = t => t.replace(/([.!?])\s+/g, '$1\u0001').split('\u0001').map(z => z.trim()).filter(Boolean);
function inkorten(t, max) {
  let uit = '';
  for (const z of zinnen(t)) { if (uit && uit.length + z.length + 1 > max) break; uit = (uit + ' ' + z).trim(); }
  return uit.length > max ? uit.slice(0, max) : uit;
}
async function haalNieuws(n = 4) {
  const bestand = await uitFeedsBestand('nieuws');
  if (bestand) return bestand.slice(0, n).map(x => [x.titel, x.samenvatting || '', x.onderwerp || '']);
  const xml = parseXml(await haalOp(CONFIG.NIEUWS_FEED)); // de VRT-feed is een Atom-feed (entry/summary); RSS (item/description) kan ook
  const uit = [];
  for (const it of xml.querySelectorAll('entry, item')) {
    const titel = platteTekst(it.querySelector('title')?.textContent || '');
    const besch = platteTekst((it.querySelector('summary') || it.querySelector('description'))?.textContent || '');
    if (titel && besch.length >= 60) uit.push([titel, besch, platteTekst(it.querySelector('nstag')?.textContent || '')]);
    if (uit.length === n) break;
  }
  if (!uit.length) throw new Error('geen nieuws');
  return uit;
}

/* ---------- HTML-stukken ---------- */
function weerHtml(w) {
  const kop = '<div class="sec" style="margin-bottom:0"><h2>Weer in Gent</h2></div>';
  if (!w) return '<div class="wx">' + kop + '<p>Weergegevens zijn nu niet beschikbaar.</p></div>';
  let uren = '<div class="h lab"><b>Uur</b><span class="t">°C</span><div class="bar2" style="border-bottom-color:transparent"></div><span class="p">Regen</span></div>';
  w.uren.forEach(([temp, p], i) => {
    uren += '<div class="h"><b>' + (8 + i) + 'u</b><span class="t">' + temp + '°</span><div class="bar2"><i style="height:' + p + '%"></i></div><span class="p">' + p + '%</span></div>';
  });
  return '<div class="wx">' + kop + '<div class="wxtop"><div class="temp">' + w.tmax + '°<span> / ' + w.tmin + '°</span></div><div>' + esc(weerOmschrijving(w)) +
    '</div><div><span class="tag">Wat trek je aan</span><br>' + esc(kledingAdvies(w)) + '</div></div><div class="hours">' + uren + '</div></div>';
}
const quoteHtml = ([t, a, bron]) => '<div class="quote"><q>' + esc(t) + '</q><small>— ' + esc(a) + (bron && CONFIG.QUOTE_BRON_VERMELDEN ? ' · BrainyQuote.com' : '') + '</small></div>';
function nieuwsHtml(items) {
  if (!items || !items.length) return '';
  const art = items.map(([titel, besch, onderwerp], i) => {
    const tekst = inkorten(besch || '', i === 0 ? 300 : 210);
    return '<div class="art"><span class="tag">' + esc(onderwerp ? onderwerp + ' · VRT NWS' : 'VRT NWS') + '</span><h3>' + esc(titel) + '</h3>' + (tekst ? '<p>' + esc(tekst) + '</p>' : '') + '</div>';
  }).join('');
  return '<div class="sec" style="margin:4mm 0 2mm"><h2>Nieuws</h2></div><div class="newsgrid">' + art + '</div>';
}
const isoDatum = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const maandagEerst = d => (d.getDay() + 6) % 7;
function agendaEind(start) {
  const e = new Date(start); e.setDate(e.getDate() + 6);
  while (maandagEerst(e) !== 6) e.setDate(e.getDate() + 1); // altijd tot en met zondag
  return e;
}
function agendaHtml(start, data) {
  const eind = agendaEind(start);
  let cellen = '<div></div>'.repeat(maandagEerst(start));
  for (const d = new Date(start); d <= eind; d.setDate(d.getDate() + 1)) {
    const items = data[isoDatum(d)] || [];
    const lijst = items.map(a => {
      const m = a.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
      return '<div>' + (m ? '<b>' + esc(m[1]) + '</b> ' + esc(m[2]) : esc(a)) + '</div>';
    }).join('');
    const nu = d.getTime() === start.getTime();
    cellen += '<div class="cel' + (nu ? ' nu' : '') + '"><h3>' + DAGEN[maandagEerst(d)] + '</h3><div class="dd">' + d.getDate() + ' ' + MAANDEN[d.getMonth()].slice(0, 3) + '</div>' + lijst + '</div>';
  }
  return '<div class="sec agwrap"><h2>Agenda</h2><div class="week">' + cellen + '</div></div>';
}
const datumKort = iso => { const [, m, d] = iso.split('-').map(Number); return d + ' ' + MAANDEN[m - 1].slice(0, 3); };
function todosHtml(todos) {
  const li = todos.map(t => {
    const o = typeof t === 'string' ? { titel: t } : t;
    return '<li>' + esc(o.titel) + (o.due ? ' <small>· ' + datumKort(o.due) + '</small>' : '') + '</li>';
  }).join('');
  const n = todos.length, kol = n <= 10 ? '' : n <= 20 ? ' kol2' : ' kol3'; // vanaf 11 taken meerdere kolommen
  return '<ul class="todo' + (n > 6 ? ' krap' : '') + kol + '">' + li + '</ul>';
}
function puzzelHtml(p) {
  return '<div class="sec" style="margin-bottom:0"><h2>' + esc(p.naam) + '</h2></div>' + p.html;
}
function feitjeHtml(f) {
  if (!f) return '';
  const kop = (f.taal === 'nl' ? 'Op ' : '') + f.dag + ' ' + f.maand + ' ' + f.jaar;
  return '<div class="sec" style="margin-bottom:0"><h2>Feitje van de dag</h2></div><div class="feit"><p class="feit-kop">' + esc(kop) + '</p><p>' + esc(f.tekst) + '</p>' +
    (f.uitleg ? '<p><b>' + esc(f.titel) + '.</b> ' + esc(f.uitleg) + '</p>' : '') + '<p class="feit-bron">Bron: Wikipedia</p></div>';
}

/* ---------- Google: agenda en taken ---------- */
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly';
async function googleGet(url, token) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(12000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || ('HTTP ' + r.status));
  return d;
}
const twee = n => String(n).padStart(2, '0');
async function haalAgenda(token, start, eind) {
  const grens = new Date(eind); grens.setDate(grens.getDate() + 1);
  const kalenders = ((await googleGet('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader', token)).items || [])
    .filter(k => k.selected || k.primary);
  const per = {};
  const voegToe = (dag, sorteer, tekst) => { (per[dag] = per[dag] || []).push([sorteer, tekst]); };
  await Promise.all(kalenders.map(async k => {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(k.id) + '/events?singleEvents=true&orderBy=startTime&maxResults=250' +
      '&timeMin=' + encodeURIComponent(start.toISOString()) + '&timeMax=' + encodeURIComponent(grens.toISOString());
    ((await googleGet(url, token)).items || []).forEach(ev => {
      if (ev.status === 'cancelled' || !ev.start) return;
      const titel = ev.summary || '(zonder titel)';
      if (ev.start.dateTime) {
        const b = new Date(ev.start.dateTime), uur = twee(b.getHours()) + ':' + twee(b.getMinutes());
        voegToe(isoDatum(b), uur.replace(':', ''), uur + ' ' + titel);
      } else if (ev.start.date) { // hele dag(en): de einddatum is exclusief
        const b = new Date(ev.start.date + 'T00:00:00');
        let e = ev.end && ev.end.date ? new Date(ev.end.date + 'T00:00:00') : null;
        if (!e || e <= b) { e = new Date(b); e.setDate(e.getDate() + 1); }
        for (const d = new Date(b); d < e; d.setDate(d.getDate() + 1)) if (d >= start && d < grens) voegToe(isoDatum(d), '0000', titel);
      }
    });
  }));
  const uit = {};
  Object.keys(per).forEach(dag => {
    const lijst = per[dag].sort((x, y) => x[0].localeCompare(y[0])).map(x => x[1]);
    uit[dag] = lijst.filter((t, i) => lijst.indexOf(t) === i); // dubbels weg
  });
  return uit;
}
async function haalTaken(token) {
  const lijsten = (await googleGet('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=20', token)).items || [];
  const alle = [];
  await Promise.all(lijsten.map(async l => {
    const d = await googleGet('https://tasks.googleapis.com/tasks/v1/lists/' + encodeURIComponent(l.id) + '/tasks?showCompleted=false&showHidden=false&maxResults=100', token);
    (d.items || []).forEach(t => { if (t.title && t.title.trim() && !t.parent) alle.push({ titel: t.title.trim(), due: t.due ? t.due.slice(0, 10) : '' }); });
  }));
  return alle.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
}
function oudMelding() {
  const gisteren = new Date(); gisteren.setDate(gisteren.getDate() - 1);
  return STAAT.feedDatum && STAAT.feedDatum < isoDatum(gisteren)
    ? 'Nieuws en quotes zijn van ' + datumKort(STAAT.feedDatum) + ' (de automatische update staat stil).' : '';
}
function statusTekst(mislukt) {
  const m = [];
  if (!STAAT.past) m.push('Let op: niet alles past op de pagina.');
  if (mislukt && mislukt.length) m.push('Niet gelukt: ' + mislukt.join(', ') + '.');
  if (oudMelding()) m.push(oudMelding());
  return m.join(' ');
}
async function laadGoogle(token, mislukt) {
  status('Agenda en taken ophalen…');
  const fouten = [];
  const [ag, tk] = await Promise.all([
    haalAgenda(token, STAAT.start, agendaEind(STAAT.start)).catch(e => { fouten.push('agenda (' + e.message + ')'); return null; }),
    haalTaken(token).catch(e => { fouten.push('taken (' + e.message + ')'); return null; }),
  ]);
  if (ag) STAAT.agenda = ag;
  if (tk) STAAT.todos = tk;
  teken();
  const meldingen = [statusTekst(mislukt)].filter(Boolean);
  if (fouten.length) meldingen.push('Google: ' + fouten.join('; ') + '.');
  status(meldingen.join(' '));
}
let tokenClient = null;
function initGoogle() {
  const knop = $('google');
  if (!CONFIG.GOOGLE_CLIENT_ID) { knop.hidden = true; return; }
  if (!(window.google && google.accounts && google.accounts.oauth2)) { if (++initGoogle.n < 40) setTimeout(initGoogle, 400); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID, scope: SCOPES,
    callback: resp => {
      if (resp.error) { status('Google: ' + resp.error); return; }
      STAAT.token = resp.access_token; STAAT.tokenTot = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
      knop.textContent = 'Google opnieuw ophalen';
      laadGoogle(resp.access_token, STAAT.mislukt);
    },
    error_callback: e => status('Google: ' + (e.message || e.type)),
  });
}
initGoogle.n = 0;

/* ---------- krant bouwen ---------- */
const STAAT = { start: null, weer: null, nieuws: null, q1: null, q2: null, puzzels: [], agenda: {}, todos: [], mislukt: [], token: null, tokenTot: 0, feedDatum: '', feitje: null, past: true };
function status(t) { $('status').textContent = t || ''; }
function schaal() {
  const f = Math.min(1, (window.innerWidth - 16) / 793.7);
  document.querySelectorAll('.sheet').forEach(x => { x.style.zoom = f; });
}

function teken() {
  const S = STAAT, start = S.start;
  const datumtekst = DAGEN[maandagEerst(start)] + ' ' + start.getDate() + ' ' + MAANDEN[start.getMonth()] + ' ' + start.getFullYear();
  $('stage').innerHTML =
    '<section class="sheet"><header class="mast"><h1>De Ochtendkrant</h1><div class="strip">' + esc(datumtekst) + '</div></header>' +
    quoteHtml(S.q1) + weerHtml(S.weer) + agendaHtml(start, S.agenda) + nieuwsHtml(S.nieuws) + '</section>' +
    '<section class="sheet"><header class="mast" style="padding-bottom:2mm"><h1 style="font-size:26pt">Puzzels &amp; To-do’s</h1></header>' + quoteHtml(S.q2) +
    '<div class="row1"><div class="sec" style="margin-bottom:0"><h2>To-do’s</h2>' + todosHtml(S.todos) + '</div>' +
    '<div>' + puzzelHtml(S.puzzels[0]) + '</div></div>' +
    (S.feitje
      ? '<div class="row2 duo"><div>' + puzzelHtml(S.puzzels[1]) + '</div><div>' + feitjeHtml(S.feitje) + '</div></div>'
      : '<div class="row2"><div>' + puzzelHtml(S.puzzels[1]) + '</div></div>') +
    '<div class="sol">' + S.puzzels.map(p => esc(p.naam.toLowerCase() + ': ' + p.oplossing)).join('<br>') + '</div></section>';
  document.querySelectorAll('.sheet').forEach(x => { x.style.zoom = 1; });
  S.past = pasAan();
  schaal();
}
// Past alles niet op een pagina? Dan maken we agenda, nieuws, to-do's en feitje stapsgewijs iets kleiner.
function pasAan() {
  let past = true;
  document.querySelectorAll('.sheet').forEach(sh => {
    for (const k of ['', 'k1', 'k2', 'k3']) {
      sh.classList.remove('k1', 'k2', 'k3');
      if (k) sh.classList.add(k);
      if (sh.scrollHeight <= sh.clientHeight + 1) return;
    }
    past = false;
  });
  return past;
}

async function bouw() {
  try { await bouwKrant(); } catch (fout) { status('Fout: ' + fout.message); console.error(fout); }
}

async function bouwKrant() {
  const demo = new URLSearchParams(location.search).has('demo');
  const nu = new Date();
  const start = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  const rng = maakRng(Math.floor(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) / 86400000));
  const mislukt = [];
  status('Krant wordt gemaakt…');
  feedsBelofte = null; STAAT.feedDatum = '';

  const limiet = () => new Promise((_, nee) => setTimeout(() => nee(new Error('time-out')), 15000));
  const wacht = (naam, p) => Promise.race([p, limiet()]).catch(() => { mislukt.push(naam); return null; });
  const [weer, nieuws, quotes, feitje] = await Promise.all(demo
    ? [DEMO.weer, DEMO.nieuws, DEMO.quotes, DEMO.feitje]
    : [wacht('weer', haalWeer()), wacht('nieuws', haalNieuws()), wacht('quotes', haalQuotes()), haalFeitje()]);

  const dagnr = Math.floor(start.getTime() / 86400000);
  Object.assign(STAAT, {
    start, weer, nieuws, mislukt, feitje,
    q1: (quotes && quotes[0] && [...quotes[0], true]) || SPREUKEN[dagnr % SPREUKEN.length],
    q2: (quotes && quotes[1] && [...quotes[1], true]) || SPREUKEN[(dagnr + 3) % SPREUKEN.length],
    puzzels: kiesPuzzels(dagnr).map((type, i) => maakPuzzel(type, maakRng(dagnr * 131 + i * 17 + 5))),
  });
  if (demo) {
    STAAT.agenda = {};
    Object.entries(DEMO.agenda).forEach(([plus, lijst]) => { const d = new Date(start); d.setDate(d.getDate() + Number(plus)); STAAT.agenda[isoDatum(d)] = lijst; });
    STAAT.todos = DEMO.todos;
  }
  teken();
  if (!demo && STAAT.token && Date.now() < STAAT.tokenTot) { await laadGoogle(STAAT.token, mislukt); return; }
  status(statusTekst(mislukt));
}

window.addEventListener('error', e => status('Fout: ' + e.message));
window.addEventListener('unhandledrejection', e => status('Fout: ' + (e.reason && e.reason.message)));
window.addEventListener('resize', schaal);
$('afdrukken').addEventListener('click', () => window.print());
$('vernieuw').addEventListener('click', bouw);
$('google').addEventListener('click', () => {
  if (tokenClient) tokenClient.requestAccessToken();
  else status('Google is nog aan het laden. Probeer het over enkele seconden opnieuw.');
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
initGoogle();
bouw();
