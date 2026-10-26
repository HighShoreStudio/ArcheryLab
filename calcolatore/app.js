'use strict';

const $ = (id) => document.getElementById(id);
const num = (id) => {
  const value = Number.parseFloat($(id).value);
  return Number.isFinite(value) ? value : 0;
};
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const fmt = (n, digits = 2) => Number.isFinite(n) ? n.toLocaleString('it-IT', {minimumFractionDigits: digits, maximumFractionDigits: digits}) : '—';
const COLORS = ['#0a84ff','#ff9f0a','#30b0c7','#8e8e93','#af52de','#34c759'];
let lastSimulation = null;

// Tabs
for (const button of document.querySelectorAll('.tab')) {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === button));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${button.dataset.tab}`));
    const activePanel = document.getElementById(`panel-${button.dataset.tab}`);
    if (activePanel) { const y = activePanel.getBoundingClientRect().top + window.scrollY - 150; if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); }
    try { history.replaceState(null, '', '#' + button.dataset.tab); } catch (_) {}
    try { const bar = button.parentElement; bar.scrollTo({ left: button.offsetLeft - (bar.clientWidth - button.offsetWidth) / 2, behavior: 'smooth' }); } catch (_) {}
    if (button.dataset.tab === 'trajectory') setTimeout(() => { if (lastSimulation) { drawTrajectory(lastSimulation.points, lastSimulation.target); playTrajectoryAnimation(); } }, 30);
  });
}

function getArrow() {
  const length = Math.max(0, num('arrowLength'));
  const gpi = Math.max(0, num('gpi'));
  const measuredShaftRaw = Math.max(0, num('shaftWeightMeasured'));
  const inputUnit = $('weightInputUnit')?.value || 'gr';
  const measuredShaft = measuredShaftRaw * (inputUnit === 'g' ? 15.4323584 : 1);
  const shaft = measuredShaft > 0 ? measuredShaft : length * gpi;
  const shaftWeightMethod = measuredShaft > 0 ? 'peso asta misurato' : 'lunghezza × GPI';
  const toGrains = (value) => Math.max(0, value) * (inputUnit === 'g' ? 15.4323584 : 1);
  const point = toGrains(num('pointWeight'));
  const insert = toGrains(num('insertWeight'));
  const nock = toGrains(num('nockWeight'));
  const pinRaw = toGrains(num('pinWeight'));
  const pin = $('rearAssembly')?.value === 'integrated' ? 0 : pinRaw;
  const count = Math.max(0, num('vaneCount'));
  const fletchingSet = toGrains(num('fletchingSetWeight'));
  const vaneTotal = count === 0 ? 0 : fletchingSet * count / 3;
  const total = shaft + point + insert + pin + nock + vaneTotal;
  // Approximation documented by DO ARCHERY: shaft mass at L/2, point and insert at L, fletching (including Wrap) at 2 in from nock.
  const moment = shaft * (length / 2) + point * length + insert * length + vaneTotal * 2 + (pin + nock) * 1.5;
  const cg = total > 0 ? moment / total : NaN;
  const foc = length > 0 && Number.isFinite(cg) ? ((cg - length / 2) / length) * 100 : NaN;
  return {length, gpi, shaft, shaftWeightMethod, measuredShaft, point, insert, pin, pinRaw, nock, count, vaneTotal, total, moment, cg, foc,
    grams: total / 15.4323584, diameterIn: Math.max(0.001, num('shaftDiameter'))};
}

function updateWeightBar(a) {
  const parts = [
    ['Asta', a.shaft], ['Punta', a.point], ['Inserto', a.insert], ['Pin', a.pin], ['Cocca', a.nock], ['Impennaggio + Wrap', a.vaneTotal]
  ].filter((item) => item[1] > 0);
  $('weightBar').innerHTML = '';
  $('weightLegend').innerHTML = '';
  parts.forEach(([label, weight], i) => {
    const span = document.createElement('span');
    span.style.width = `${weight / Math.max(a.total, 1) * 100}%`;
    span.style.background = COLORS[i % COLORS.length];
    span.title = `${label}: ${fmt(weight, 1)} grani`;
    $('weightBar').appendChild(span);
    const leg = document.createElement('span');
    leg.className = 'legend-item';
    const swatch = document.createElement('i'); swatch.style.background = COLORS[i % COLORS.length];
    leg.append(swatch, document.createTextNode(`${label} ${fmt(weight, 1)} gr`));
    $('weightLegend').appendChild(leg);
  });
  $('weightBarSummary').textContent = `${fmt(a.total, 1)} gr`;
}

function updateBalanceGraphic(a) {
  const graphic = $('arrowBalanceGraphic');
  const valid = a.length > 0 && a.total > 0 && Number.isFinite(a.cg) && Number.isFinite(a.foc);
  if (!valid) {
    graphic.innerHTML = '<div class="empty-chart" style="height:150px">Inserisci lunghezza e pesi validi per visualizzare il baricentro.</div>';
    $('cgPositionLabel').textContent = '—';
    $('focGaugeValue').textContent = '—';
    $('focGaugeMarker').classList.add('hidden');
    $('focDescription').textContent = 'Servono una lunghezza dell’asta e un peso totale maggiori di zero.';
    return;
  }
  const width = 800, height = 220, x0 = 62, x1 = 738;
  const span = x1 - x0;
  const cgRatio = clamp(a.cg / a.length, 0, 1);
  const xCg = x0 + span * cgRatio;
  const xMid = x0 + span * 0.5;
  const lead = a.cg - a.length / 2;
  const focText = `${a.foc > 0 ? '+' : ''}${fmt(a.foc, 2)}%`;
  const cgXText = clamp(xCg, x0 + 55, x1 - 55);
  const midLabelX = clamp(xMid, x0 + 55, x1 - 55);
  const markerStart = Math.min(xMid, xCg), markerEnd = Math.max(xMid, xCg);
  const dimension = Math.abs(lead);
  graphic.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Freccia completa con cocca, tre alette, asta e punta. Lunghezza ${fmt(a.length,2)} pollici; centro geometrico a ${fmt(a.length/2,2)} pollici; baricentro a ${fmt(a.cg,2)} pollici dal fondo della cocca; FOC ${focText}.">
    <defs>
      <linearGradient id="arrowShaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe4ed"/><stop offset=".38" stop-color="#8fa3b8"/><stop offset=".7" stop-color="#526a82"/><stop offset="1" stop-color="#263b52"/></linearGradient>
      <linearGradient id="arrowPoint" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#718096"/><stop offset=".48" stop-color="#f8fafc"/><stop offset="1" stop-color="#718096"/></linearGradient>
      <linearGradient id="arrowVane" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6a14d"/><stop offset="1" stop-color="#b86b20"/></linearGradient>
      <marker id="arrowDimHead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="#c17c28"/></marker>
    </defs>
    <rect x="1" y="1" width="798" height="218" rx="13" fill="#fbfcfe" stroke="#e1e8f0"/>
    <text x="${x0}" y="22" fill="#66788d" font-size="11" font-weight="800" letter-spacing="1">COCCA</text><text x="${x1}" y="22" text-anchor="end" fill="#66788d" font-size="11" font-weight="800" letter-spacing="1">PUNTA</text>
    <!-- Tre alette tradizionali, strette e affusolate: vista laterale schematica -->
    <path d="M${x0+19} 101 C${x0+37} 88 ${x0+61} 69 ${x0+91} 52 C${x0+100} 47 ${x0+108} 47 ${x0+116} 51 C${x0+91} 70 ${x0+65} 87 ${x0+38} 101 Z" fill="#b9c4cf" stroke="#586a7c" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M${x0+19} 107 C${x0+39} 116 ${x0+64} 132 ${x0+91} 148 C${x0+101} 153 ${x0+109} 152 ${x0+117} 147 C${x0+91} 128 ${x0+65} 113 ${x0+38} 106 Z" fill="#d3dbe2" stroke="#586a7c" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M${x0+22} 103 C${x0+43} 99 ${x0+67} 96 ${x0+94} 96 L${x0+111} 102 L${x0+94} 108 C${x0+66} 108 ${x0+43} 106 ${x0+22} 105 Z" fill="#eef2f5" stroke="#586a7c" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M${x0+36} 91 Q${x0+68} 69 ${x0+108} 52 M${x0+36} 117 Q${x0+70} 136 ${x0+109} 148" fill="none" stroke="#7d8b99" stroke-width="1" opacity=".9"/>
    <path d="M${x0+1} 95 L${x0+13} 95 L${x0+13} 100 L${x0+21} 100 L${x0+21} 108 L${x0+13} 108 L${x0+13} 113 L${x0+1} 113 Z" fill="#25384d" stroke="#15283c" stroke-width="1.2"/><path d="M${x0+4} 98 L${x0+11} 98 L${x0+11} 110 L${x0+4} 110" fill="none" stroke="#aebdca" stroke-width="1.3"/>
    <path d="M${x0+18} 101 L${x1-43} 101 L${x1-43} 107 L${x0+18} 107 Z" fill="url(#arrowShaft)" stroke="#3c526a" stroke-width=".8"/><path d="M${x0+22} 102 L${x1-45} 102" stroke="#f4f7fa" stroke-width="1.1"/>
    <rect x="${x1-48}" y="99" width="9" height="10" rx="1.5" fill="#7b8998" stroke="#43566b" stroke-width=".8"/><path d="M${x1-40} 99 L${x1-25} 94 L${x1-1} 104 L${x1-25} 114 L${x1-40} 109 Z" fill="url(#arrowPoint)" stroke="#526477" stroke-width="1.1" stroke-linejoin="round"/>
    <line x1="${xMid}" y1="38" x2="${xMid}" y2="166" stroke="#536f91" stroke-width="2" stroke-dasharray="5 5"/><text x="${midLabelX}" y="34" text-anchor="middle" fill="#425d7d" font-size="11" font-weight="800">CENTRO 50%</text>
    <line x1="${xCg}" y1="45" x2="${xCg}" y2="169" stroke="#c17c28" stroke-width="3"/><circle cx="${xCg}" cy="104" r="8" fill="#f7c77f" stroke="#9a5b18" stroke-width="2.5"/><circle cx="${xCg}" cy="104" r="2.5" fill="#71400f"/>
    <rect x="${cgXText-49}" y="43" width="98" height="22" rx="11" fill="#fff1dc" stroke="#e8bd86"/><text x="${cgXText}" y="58" text-anchor="middle" fill="#8d5115" font-size="11" font-weight="900">BARICENTRO</text>
    ${dimension > 0.005 ? `<line x1="${markerStart}" y1="178" x2="${markerEnd}" y2="178" stroke="#c17c28" stroke-width="2.4" marker-start="url(#arrowDimHead)" marker-end="url(#arrowDimHead)"/>` : `<line x1="${xMid-5}" y1="178" x2="${xMid+5}" y2="178" stroke="#c17c28" stroke-width="2.4"/>`}
    <text x="400" y="202" text-anchor="middle" fill="#42566d" font-size="12" font-weight="700">Scostamento dal centro: ${lead > 0 ? '+' : ''}${fmt(lead,2)}″ · FOC ${focText}</text>
  </svg>`;
  $('cgPositionLabel').textContent = `${fmt(a.cg,2)}″ dal fondo`;
  $('focGaugeValue').textContent = focText;
  const gaugeMin = -10, gaugeMax = 30;
  const gaugePos = clamp((a.foc - gaugeMin) / (gaugeMax - gaugeMin), 0, 1) * 100;
  $('focGaugeMarker').style.left = `${gaugePos}%`;
  $('focGaugeMarker').classList.remove('hidden');
  $('focGauge').setAttribute('aria-label', `FOC ${focText}; scala visualizzata da meno 10 a più 30 per cento`);
  let detail;
  if (Math.abs(lead) < 0.005) detail = 'Il baricentro coincide con il centro geometrico: FOC pari a circa 0%.';
  else if (lead > 0) detail = `Il baricentro è ${fmt(lead,2)}″ davanti al centro geometrico, verso la punta.`;
  else detail = `Il baricentro è ${fmt(Math.abs(lead),2)}″ dietro il centro geometrico, verso la cocca.`;
  if (a.foc < gaugeMin || a.foc > gaugeMax) detail += ` Il valore è fuori dalla scala grafica (${gaugeMin}% / +${gaugeMax}%).`;
  $('focDescription').textContent = detail;
}

function updateArrow() {
  const a = getArrow();
  $('shaftWeight').textContent = `${fmt(a.shaft, 1)} gr`;
  if ($('shaftWeightMethod')) $('shaftWeightMethod').textContent = a.shaftWeightMethod;
  $('totalGrains').textContent = `${fmt(a.total, 1)} gr`;
  $('totalGrams').textContent = `${fmt(a.grams, 2)} grammi`;
  $('foc').textContent = Number.isFinite(a.foc) ? `${fmt(a.foc, 2)}%` : '—';
  $('cg').textContent = Number.isFinite(a.cg) ? `${fmt(a.cg, 2)}″` : '—';
  updateBalanceGraphic(a);
  updateWeightBar(a);
  return a;
}

function iboEstimate(totalGrains) {
  if (!$('bowType') || $('bowType').value !== 'compound') return NaN;
  const ibo = num('compoundIboRating');
  const dl = num('setupDrawLength');
  const dw = num('actualDrawWeight'); // use peak draw weight for compound profile
  if (ibo <= 0 || dl <= 0 || dw <= 0) return NaN;
  // Simplified IBO-style correction only for compound bows; not a chronograph substitute.
  return ibo - (30 - dl) * 10 - Math.max(0, (70 - dw) * 2) - (totalGrains - 350) / 3 - 8;
}

function effectiveDrawWeight() {
  const type = $('bowType')?.value || 'barebow';
  const drawLengthIn = Math.max(10, Math.min(40, num('setupDrawLength')));
  // Se il tiratore ha misurato la potenza all'allungo, quel dato ha priorità.
  if ($('measuredDrawWeight')?.checked) return Math.max(1, num('actualDrawWeight'));
  // Altrimenti stima la potenza al proprio allungo dalla potenza nominale,
  // normalmente dichiarata a 28 pollici AMO. Regola indicativa: circa 2 lb/in.
  let rated = type === 'longbow' || type === 'traditional' || type === 'horsebow' || type === 'other'
    ? num('traditionalRatedWeight') : num('limbRatedWeight');
  if (type === 'compound') rated = num('actualDrawWeight'); // picco impostato dall'utente
  if (!(rated > 0) || !(drawLengthIn > 0)) return NaN;
  if (type === 'compound') return rated;
  return Math.max(1, rated + (drawLengthIn - 28) * 2);
}
function equipmentSpeedEstimate(totalGrains) {
  // Stima energetica semplificata: energia accumulata ≈ forza media (50% del picco)
  // × allungo. Efficienza ipotizzata al 70%; non sostituisce un cronografo.
  const type = $('bowType')?.value || 'barebow';
  const drawLengthIn = Math.max(10, Math.min(40, num('setupDrawLength')));
  const drawWeightLb = effectiveDrawWeight();
  const efficiency = 0.70;
  if (totalGrains <= 0 || drawLengthIn <= 0 || !Number.isFinite(drawWeightLb) || drawWeightLb <= 0) return NaN;
  if (type === 'compound') {
    const ibo = iboEstimate(totalGrains);
    if (Number.isFinite(ibo) && ibo > 0) return ibo;
  }
  const storedEnergyFtLb = drawWeightLb * drawLengthIn / 24;
  const arrowEnergyFtLb = storedEnergyFtLb * efficiency;
  const fps = Math.sqrt((arrowEnergyFtLb * 450240) / totalGrains);
  if (!Number.isFinite(fps) || fps < 30 || fps > 500) return NaN;
  return fps;
}
function currentSpeed(totalGrains) {
  const source = $('velocitySource') ? $('velocitySource').value : 'estimated';
  if (source === 'measured') return Math.max(0, num('measuredSpeed'));
  if (source === 'manual') return Math.max(0, num('measuredSpeed'));
  if (source === 'ibo') return iboEstimate(totalGrains);
  return equipmentSpeedEstimate(totalGrains);
}
function updateVelocityNotice(totalGrains) {
  const source = $('velocitySource') ? $('velocitySource').value : 'estimated';
  const notice = $('velocitySourceNotice');
  const details = $('iboDetails');
  const speedInput = $('measuredSpeed');
  const speedLabel = $('measuredSpeedLabel');
  if (details) details.classList.toggle('hidden', $('bowType')?.value !== 'compound');
  if (speedInput) speedInput.disabled = source === 'estimated' || source === 'ibo';
  if (speedLabel) speedLabel.textContent = source === 'measured' ? 'Velocità misurata al cronografo' : source === 'manual' ? 'Velocità inserita manualmente' : 'Velocità misurata (opzionale)';
  if (!notice) return;
  notice.className = 'status-message';
  if (source === 'measured') {
    notice.classList.add('success');
    notice.textContent = 'Velocità misurata al cronografo: questo dato reale sostituisce la stima. Usa la stessa freccia e lo stesso setup.';
  } else if (source === 'ibo') {
    const estimate = iboEstimate(totalGrains);
    if ($('bowType')?.value === 'compound' && Number.isFinite(estimate) && estimate > 0) {
      notice.classList.add('warn');
      notice.textContent = `Stima IBO semplificata: ${fmt(estimate,1)} fps. Indicativa, non una misura reale.`;
    } else {
      notice.classList.add('error');
      notice.textContent = 'La stima IBO richiede un profilo Compound completo. In alternativa usa la velocità stimata dall’attrezzatura o quella misurata.';
    }
  } else if (source === 'manual') {
    notice.classList.add('warn');
    notice.textContent = 'Velocità inserita manualmente: sostituisce la stima automatica. È un dato ipotetico se non proviene da un cronografo.';
  } else {
    const estimate = equipmentSpeedEstimate(totalGrains);
    if (Number.isFinite(estimate)) {
      notice.classList.add('warn');
      notice.textContent = `Velocità stimata dall’attrezzatura: ${fmt(estimate,1)} fps. Modello energetico semplificato con efficienza ipotizzata al 70%; calibra con un cronografo quando possibile.`;
    } else {
      notice.classList.add('error');
      notice.textContent = 'Stima non disponibile: controlla potenza effettiva all’allungo, allungo AMO e massa della freccia.';
    }
  }
}
function updateBallistics(a) {
  const speed = Math.max(0, currentSpeed(a.total));
  const ke = (a.total * speed * speed) / 450240;
  const momentum = (a.total * speed) / 225218;
  $('kineticEnergy').textContent = Number.isFinite(ke) ? `${fmt(ke, 2)}` : '—';
  $('momentum').textContent = Number.isFinite(momentum) ? `${fmt(momentum, 4)}` : '—';
  $('speedMetric').textContent = Number.isFinite(speed) ? `${fmt(speed * 0.3048, 2)}` : '—';
  $('massGrams').textContent = `${fmt(a.grams, 2)}`;
  const estimate = iboEstimate(a.total);
  $('iboResult').textContent = Number.isFinite(estimate) ? `${fmt(estimate, 1)} fps` : 'disponibile solo per compound con dati validi';
  if ($('syncTrajectorySpeed')?.checked && Number.isFinite(speed) && speed > 0) $('trajectorySpeed').value = speed.toFixed(1);
  if ($('velocitySource')) updateVelocityNotice(a.total);
}

function airModel() {
  const altitude = num('altitude');
  const tempC = num('temperature');
  const tempK = tempC + 273.15;
  const lapse = 0.0065, t0 = 288.15, p0 = 101325, g = 9.80665, molarMass = 0.02896, R = 8.3144;
  const base = 1 - lapse * altitude / t0;
  const pressure = base > 0 ? p0 * Math.pow(base, (g * molarMass) / (R * lapse)) : NaN;
  const density = tempK > 0 ? (pressure * molarMass) / (R * tempK) : NaN;
  const shaftCd = Math.max(0, num('cdShaft'));
  const fletchBase = Math.max(0, num('fletchProfile'));
  const vaneCount = num('vaneCount');
  const fletchCd = fletchBase * (vaneCount === 4 ? 1.33 : vaneCount >= 5 ? vaneCount / 3 : vaneCount === 3 ? 1 : vaneCount / 3);
  const tipCd = Math.max(0, num('tipCd'));
  const totalCd = shaftCd + fletchCd + tipCd;
  $('airDensity').textContent = fmt(density, 4);
  $('airPressure').textContent = fmt(pressure / 100, 1);
  $('cdFletchResult').textContent = fmt(fletchCd, 2);
  $('cdTotal').textContent = fmt(totalCd, 2);
  return {altitude, tempC, pressure, density, shaftCd, fletchBase, fletchCd, tipCd, totalCd};
}

function updateGrainConversions() {
  const factor = 15.4323584;
  const unit = $('weightInputUnit')?.value || 'gr';
  const fields = [
    ['pointWeight', 'pointWeightGrams', false], ['insertWeight', 'insertWeightGrams', false],
    ['pinWeight', 'pinWeightGrams', false], ['shaftWeightMeasured', 'shaftWeightMeasuredGrams', false], ['nockWeight', 'nockWeightGrams', false],
    ['fletchingSetWeight', 'fletchingSetWeightGrams', false]
  ];
  const fmtUnit = (v) => Number.isFinite(v) ? v.toLocaleString('it-IT', {maximumFractionDigits: 3}) : '—';
  fields.forEach(([inputId, outputId, perItem]) => {
    const input = $(inputId), output = $(outputId);
    if (!input || !output) return;
    const n = Number(input.value);
    const converted = Number.isFinite(n) ? (unit === 'g' ? n * factor : n / factor) : NaN;
    output.textContent = `≈ ${fmtUnit(converted)} ${unit === 'g' ? 'gr' : 'g'}${outputId === 'fletchingSetWeightGrams' ? ' · totale 3 pezzi' : ''}`;
  });
  document.querySelectorAll('.weight-unit-label').forEach(el => { el.textContent = unit === 'g' ? 'grammi' : 'grani'; });
  const assembly = $('rearAssembly');
  const pinInput = $('pinWeight');
  const pinHelp = $('pinWeightGrams');
  if (assembly && pinInput && pinHelp) {
    const integrated = assembly.value === 'integrated';
    pinInput.disabled = integrated;
    pinInput.setAttribute('aria-disabled', String(integrated));
    if (integrated) pinHelp.textContent = `Non sommato: peso incluso nel sistema cocca-pin`;
  }
}
function changeWeightInputUnit(nextUnit) {
  const select = $('weightInputUnit');
  if (!select) return;
  const oldUnit = select.dataset.previousUnit || 'gr';
  if (nextUnit !== oldUnit) {
    const factor = 15.4323584;
    ['pointWeight','insertWeight','pinWeight','shaftWeightMeasured','nockWeight','fletchingSetWeight'].forEach(id => {
      const input = $(id); if (!input || !input.value.trim()) return;
      const value = Number(input.value); if (!Number.isFinite(value)) return;
      input.value = String(Number((nextUnit === 'g' ? value / factor : value * factor).toFixed(4)));
    });
    select.dataset.previousUnit = nextUnit;
  }
  refresh();
}

function refresh() {
  updateGrainConversions();
  const arrow = updateArrow();
  updateBallistics(arrow);
  airModel();
}

// RK4 3D flight model (SI units). State: [x, y, z, vx, vy, vz].
function derivatives(s, p) {
  const [x, y, z, vx, vy, vz] = s;
  const relX = vx - p.windX, relY = vy, relZ = vz - p.windZ;
  const vRel = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
  const dragFactor = p.density * p.cd * p.area / (2 * p.mass);
  return [vx, vy, vz, -dragFactor * vRel * relX, -p.g - dragFactor * vRel * relY, -dragFactor * vRel * relZ];
}
function plusScaled(s, k, scale) { return s.map((v, i) => v + k[i] * scale); }
function rk4(s, dt, p) {
  const k1 = derivatives(s, p);
  const k2 = derivatives(plusScaled(s, k1, dt / 2), p);
  const k3 = derivatives(plusScaled(s, k2, dt / 2), p);
  const k4 = derivatives(plusScaled(s, k3, dt), p);
  return s.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
function simulate(angleRad, targetX, p, step = 0.001, collect = false) {
  let s = [0, 0, 0, p.speed * Math.cos(angleRad), p.speed * Math.sin(angleRad), 0];
  let t = 0;
  const points = collect ? [{x: 0, y: 0, z: 0, t: 0, speed: p.speed}] : null;
  let prev = {x: 0, y: 0, z: 0, t: 0, vx: s[3], vy: s[4], vz: s[5]};
  const maxSteps = 12000;
  for (let i = 0; i < maxSteps; i++) {
    const next = rk4(s, step, p);
    t += step;
    const current = {x: next[0], y: next[1], z: next[2], t, vx: next[3], vy: next[4], vz: next[5]};
    if (![current.x,current.y,current.z,current.vx,current.vy,current.vz].every(Number.isFinite)) return null;
    if (current.x >= targetX) {
      const f = (targetX - prev.x) / (current.x - prev.x);
      const impact = {
        x: targetX,
        y: prev.y + f * (current.y - prev.y),
        z: prev.z + f * (current.z - prev.z),
        t: prev.t + f * (current.t - prev.t),
        vx: prev.vx + f * (current.vx - prev.vx),
        vy: prev.vy + f * (current.vy - prev.vy),
        vz: prev.vz + f * (current.vz - prev.vz)
      };
      impact.speed = Math.sqrt(impact.vx**2 + impact.vy**2 + impact.vz**2);
      if (collect) {
        points.push({x: impact.x, y: impact.y, z: impact.z, t: impact.t, speed: impact.speed});
        impact.points = points;
      }
      return impact;
    }
    if (collect && (i % 8 === 0)) points.push({x: current.x, y: current.y, z: current.z, t: current.t, speed: Math.sqrt(current.vx**2 + current.vy**2 + current.vz**2)});
    prev = current;
    s = next;
    if (current.y < -100 || current.x < -1 || t > 12 || current.x > targetX * 1.5 + 100) break;
  }
  return null;
}
function getTrajectoryParams() {
  const a = getArrow();
  const air = airModel();
  const speedMps = Math.max(1, num('trajectorySpeed')) * 0.3048;
  const diameterM = Math.max(0.0001, num('trajectoryDiameter') * 0.0254);
  const windMs = Math.max(0, num('windSpeed'));
  const windAngle = num('windDirection') * Math.PI / 180;
  const targetDistance = Math.max(1, num('targetDistance'));
  const slope = num('slopeAngle') * Math.PI / 180;
  const targetX = targetDistance * Math.cos(slope);
  const targetY = targetDistance * Math.sin(slope);
  const vanes = num('vaneCount');
  const p = {
    speed: speedMps,
    mass: Math.max(0.000001, a.total / 15432.3584), // grains to kg
    area: Math.PI * (diameterM / 2) ** 2,
    density: Math.max(0.1, air.density),
    cd: Math.max(0.01, air.totalCd),
    g: 9.80665,
    windX: windMs * Math.cos(windAngle),
    windZ: windMs * Math.sin(windAngle)
  };
  return {p, targetX, targetY, targetDistance, slope, arrow: a};
}
function setSimulationMessage(message, type = '') {
  $('simulationMessage').textContent = message;
  $('simulationMessage').className = `status-message ${type}`.trim();
}
function runSimulation() {
  if ($('syncTrajectorySpeed')?.checked) {
    const freshSpeed = currentSpeed(getArrow().total);
    if (Number.isFinite(freshSpeed) && freshSpeed > 0) $('trajectorySpeed').value = freshSpeed.toFixed(1);
  }
  if ($('velocitySource')?.value === 'ibo' && !Number.isFinite(iboEstimate(getArrow().total))) {
    setSimulationMessage('La stima IBO richiede un profilo Compound completo: rating IBO, allungo e potenza di picco. Correggi i dati o scegli una velocità misurata/inserita.', 'error');
    $('launchAngle').textContent = $('flightTime').textContent = $('lateralDrift').textContent = $('impactKE').textContent = '—';
    $('impactSpeed').textContent = $('targetHeight').textContent = '—';
    return;
  }
  const {p, targetX, targetY, targetDistance, slope} = getTrajectoryParams();
  if (!Number.isFinite(p.density) || !Number.isFinite(p.mass) || p.mass <= 0) {
    setSimulationMessage('Controlla i dati della freccia e le condizioni dell’aria.', 'error'); return;
  }
  setSimulationMessage('Calcolo in corso…');
  // For typical archery shots, this bracket covers an adequate low-angle solution.
  let lo = -10 * Math.PI / 180;
  let hi = 55 * Math.PI / 180;
  let fLo = simulate(lo, targetX, p);
  let fHi = simulate(hi, targetX, p);
  if (!fLo || !fHi || !(fLo.y <= targetY && fHi.y >= targetY)) {
    setSimulationMessage('Non trovo una soluzione nel campo angolare previsto. Verifica velocità, distanza, peso e pendenza.', 'error');
    $('launchAngle').textContent = $('flightTime').textContent = $('lateralDrift').textContent = $('impactKE').textContent = '—';
    $('impactSpeed').textContent = $('targetHeight').textContent = '—';
    $('trajectoryChart').innerHTML = '<div class="empty-chart">Nessuna traiettoria calcolata: controlla i parametri.</div>';
    lastSimulation = null; lastTrajectoryView = null; if ($('playTrajectory')) $('playTrajectory').disabled = true; return;
  }
  let mid = 0, impact = null;
  for (let i=0; i<30; i++) {
    mid = (lo + hi) / 2;
    impact = simulate(mid, targetX, p);
    if (!impact) { hi = mid; continue; }
    if (impact.y < targetY) lo = mid; else hi = mid;
  }
  mid = (lo + hi) / 2;
  impact = simulate(mid, targetX, p, 0.001, true);
  if (!impact) { setSimulationMessage('La simulazione non è riuscita: prova a modificare i parametri.', 'error'); return; }
  const massKg = p.mass;
  const keJ = 0.5 * massKg * impact.speed * impact.speed;
  const keFtLbs = keJ * 0.737562;
  $('launchAngle').textContent = `${fmt(mid * 180 / Math.PI, 3)}°`;
  $('flightTime').textContent = fmt(impact.t, 3);
  $('lateralDrift').textContent = fmt(impact.z * 100, 1);
  $('impactKE').textContent = fmt(keFtLbs, 2);
  $('impactSpeed').textContent = fmt(impact.speed, 2);
  $('targetHeight').textContent = fmt(targetY, 2);
  setSimulationMessage(`Soluzione trovata per ${fmt(targetDistance,1)} m lungo la linea di tiro; altezza bersaglio ${fmt(targetY,2)} m.`, 'success');
  lastSimulation = {points: impact.points, target: {x: targetX, y: targetY}};
  const bowTypeLabel = $('bowType')?.selectedOptions?.[0]?.textContent || 'Arco non specificato';
  const sourceLabel = $('velocitySource')?.selectedOptions?.[0]?.textContent || 'Velocità inserita';
  const spine = $('spineValue')?.value?.trim() || 'non indicato';
  const accessories = `${fmt(num('riserAddedWeight'),0)} g pesi riser + ${fmt(num('stabilizerWeight'),0)} g stabilizzatori + ${fmt(num('damperWeight'),0)} g smorzatori`;
  $('trajectoryContext').textContent = `${bowTypeLabel} · freccia ${fmt(p.mass*1000,2)} g · spine ${spine} · ${fmt(p.speed/0.3048,1)} fps (${sourceLabel}) · masse arco annotate: ${accessories} (non applicate direttamente al modello di volo)`;
  drawTrajectory(impact.points, {x: targetX, y: targetY});
  if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) setTimeout(playTrajectoryAnimation, 90);
}
let lastTrajectoryView = null;
let trajectoryAnimationFrame = null;
let trajectoryAnimationToken = 0;
function drawTrajectory(points, target) {
  const box = $('trajectoryChart');
  const play = $('playTrajectory');
  if (!points || points.length < 2) {
    box.innerHTML = '<div class="empty-chart">La traiettoria comparirà qui dopo il calcolo.</div>';
    if (play) play.disabled = true;
    lastTrajectoryView = null;
    return;
  }
  const width = 1040, height = 430, pad = {l:76,r:112,t:44,b:68};
  const xMax = Math.max(target.x, ...points.map(p=>p.x), 1);
  let yMin = Math.min(0, target.y, ...points.map(p=>p.y));
  let yMax = Math.max(0.1, target.y, ...points.map(p=>p.y));
  const padY = Math.max(0.25, (yMax-yMin)*0.18); yMin -= padY; yMax += padY;
  const sx = x => pad.l + x / xMax * (width-pad.l-pad.r);
  const sy = y => height-pad.b - (y-yMin)/(yMax-yMin)*(height-pad.t-pad.b);
  const mapped = points.map(p=>({x:sx(p.x), y:sy(p.y), t:p.t, vx:p.vx, vy:p.vy, speed:p.speed}));
  const path = mapped.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const grid=[];
  for(let i=0;i<=5;i++){
    const x=xMax*i/5, px=sx(x);
    grid.push(`<line x1="${px}" y1="${pad.t}" x2="${px}" y2="${height-pad.b}" class="grid-line"/>`);
    grid.push(`<text x="${px}" y="${height-pad.b+26}" text-anchor="middle" class="axis-tick">${fmt(x,0)}</text>`);
  }
  for(let i=0;i<=5;i++){
    const y=yMin+(yMax-yMin)*i/5, py=sy(y);
    grid.push(`<line x1="${pad.l}" y1="${py}" x2="${width-pad.r}" y2="${py}" class="grid-line"/>`);
    grid.push(`<text x="${pad.l-13}" y="${py+4}" text-anchor="end" class="axis-tick">${fmt(y,1)}</text>`);
  }
  const targetX=sx(target.x), targetY=sy(target.y), baseline=sy(clamp(0,yMin,yMax));
  const areaPath = `${path} L ${mapped[mapped.length-1].x.toFixed(2)} ${baseline.toFixed(2)} L ${mapped[0].x.toFixed(2)} ${baseline.toFixed(2)} Z`;
  const targetMark = `<g transform="translate(${targetX},${targetY})"><circle r="23" fill="#f8c96e" opacity=".12"/><circle r="16" fill="#f8f9ff" stroke="#91b2ca" stroke-width="1.4"/><circle r="11" fill="#ef7f55" stroke="#fff" stroke-width="1.4"/><circle r="6" fill="#f8d46a" stroke="#8c5546" stroke-width="1"/><circle r="2.5" fill="#172b4a"/><path d="M-25 0H25M0-25V25" stroke="#d9f6ff" stroke-width="1" opacity=".85"/></g>`;
  box.innerHTML = `<svg id="trajectorySvg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Simulazione animata della traiettoria teorica: distanza, altezza, freccia in movimento e altezza del bersaglio.">
    <defs>
      <linearGradient id="flightSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#102a4a"/><stop offset="50%" stop-color="#174b66"/><stop offset="100%" stop-color="#1b6d78"/></linearGradient>
      <linearGradient id="flightLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#59e1c4"/><stop offset="48%" stop-color="#ffcb67"/><stop offset="76%" stop-color="#ff9167"/><stop offset="100%" stop-color="#fff19b"/></linearGradient>
      <linearGradient id="flightArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffbd61" stop-opacity=".32"/><stop offset="100%" stop-color="#54dcc0" stop-opacity=".015"/></linearGradient>
      <filter id="flightGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="plotClip"><rect x="${pad.l}" y="${pad.t}" width="${width-pad.l-pad.r}" height="${height-pad.t-pad.b}" rx="4"/></clipPath>
    </defs>
    <rect width="${width}" height="${height}" rx="18" fill="url(#flightSky)"/>
    <g opacity=".26" fill="#fff"><circle cx="115" cy="40" r="1.5"/><circle cx="205" cy="72" r="1"/><circle cx="340" cy="30" r="1.3"/><circle cx="500" cy="65" r="1"/><circle cx="710" cy="33" r="1.4"/><circle cx="835" cy="81" r="1.1"/><circle cx="920" cy="44" r="1.4"/></g>
    <text x="${pad.l}" y="25" class="chart-top-label">FLIGHT PATH / RK4 MODEL</text><text x="${width-pad.r}" y="25" text-anchor="end" class="chart-top-label">${fmt(xMax,0)} m · TARGET</text>
    <g>${grid.join('')}</g>
    <g clip-path="url(#plotClip)">
      <path d="${areaPath}" fill="url(#flightArea)"/>
      <line x1="${pad.l}" y1="${baseline}" x2="${width-pad.r}" y2="${baseline}" stroke="#72dcb7" stroke-width="2" opacity=".75"/>
      <path d="${path}" fill="none" stroke="#08182b" stroke-width="10" opacity=".35" stroke-linecap="round" stroke-linejoin="round"/>
      <path id="trajectoryMainPath" d="${path}" fill="none" stroke="url(#flightLine)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#flightGlow)"/>
      <path d="${path}" fill="none" stroke="#effff9" stroke-width="1.8" stroke-dasharray="4 12" class="trajectory-flow" opacity=".95"/>
      <path id="trajectoryMotionTrail" d="" fill="none" stroke="#fff2b2" stroke-width="8" stroke-linecap="round" opacity=".65" filter="url(#flightGlow)"/>
    </g>
    <line x1="${targetX}" y1="${pad.t}" x2="${targetX}" y2="${height-pad.b}" stroke="#f8d57a" stroke-width="1.7" stroke-dasharray="5 7" opacity=".8"/>
    ${targetMark}
    <text x="${Math.min(width-pad.r+18,targetX+15)}" y="${Math.max(pad.t+18,targetY-31)}" class="target-label">BERSAGLIO</text>
    <g id="flyingArrow" transform="translate(${mapped[0].x},${mapped[0].y})">
      <circle cx="0" cy="0" r="13" fill="#ffce69" opacity=".20"/>
      <path d="M-29 0L-9 -3L8 -1L20 0L8 1L-9 3Z" fill="#fff4c2" stroke="#0e3147" stroke-width="1.2"/>
      <path d="M-28 0L-38 -8L-35 0L-38 8Z" fill="#55e1c1" stroke="#dbfff4" stroke-width=".7"/>
      <path d="M-20 -2L-27 -8L-18 -4M-20 2L-27 8L-18 4" stroke="#ff9b66" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M17 -3L27 0L17 3Z" fill="#ff9f58" stroke="#fff4c2" stroke-width=".8"/>
    </g>
    <text x="${width/2}" y="${height-13}" text-anchor="middle" class="axis-title">DISTANZA ORIZZONTALE (m)</text>
    <text x="18" y="${height/2}" transform="rotate(-90 18 ${height/2})" text-anchor="middle" class="axis-title">ALTEZZA (m)</text>
  </svg>`;
  lastTrajectoryView = {points:mapped, totalTime:Math.max(.1,points[points.length-1].t || 1)};
  if (play) play.disabled = false;
}
function playTrajectoryAnimation() {
  if (!lastTrajectoryView || !lastTrajectoryView.points.length) return;
  const svg = $('trajectorySvg'), arrow = $('flyingArrow'), trail = $('trajectoryMotionTrail');
  if (!svg || !arrow) return;
  if (trajectoryAnimationFrame) cancelAnimationFrame(trajectoryAnimationFrame);
  const token = ++trajectoryAnimationToken;
  const pts = lastTrajectoryView.points;
  const duration = 4600;
  const start = performance.now();
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    const p=pts[pts.length-1]; arrow.setAttribute('transform',`translate(${p.x},${p.y})`); if(trail)trail.setAttribute('d',''); return;
  }
  arrow.setAttribute('transform',`translate(${pts[0].x},${pts[0].y})`);
  if (trail) trail.setAttribute('d','');
  const frame = (now) => {
    if (token !== trajectoryAnimationToken) return;
    const progress = clamp((now-start)/duration,0,1);
    const idxFloat = progress*(pts.length-1), idx=Math.floor(idxFloat), frac=idxFloat-idx;
    const a=pts[Math.min(idx,pts.length-1)], b=pts[Math.min(idx+1,pts.length-1)];
    const x=a.x+(b.x-a.x)*frac, y=a.y+(b.y-a.y)*frac;
    const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    arrow.setAttribute('transform',`translate(${x},${y}) rotate(${angle})`);
    if (trail) {
      const from=Math.max(0,idx-14), seg=pts.slice(from,idx+1);
      if (seg.length>1) trail.setAttribute('d',seg.map((p,j)=>`${j?'L':'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '));
      else trail.setAttribute('d','');
    }
    if (progress<1) trajectoryAnimationFrame=requestAnimationFrame(frame);
    else { trajectoryAnimationFrame=null; if(trail)trail.setAttribute('d',''); }
  };
  trajectoryAnimationFrame=requestAnimationFrame(frame);
}

$('runSimulation').addEventListener('click', runSimulation);
$('useArrowValues').addEventListener('click', () => {
  $('trajectoryDiameter').value = $('shaftDiameter').value;
  $('trajectorySpeed').value = String(currentSpeed(getArrow().total));
  $('syncTrajectorySpeed').checked = true;
  runSimulation();
});


// Equipment profile: describes the whole setup; it deliberately does not infer recurve speed from pounds.
const EQUIPMENT_IDS = ['bowType','bowHand','bowModel','riserLength','limbLength','limbRatedWeight','limbBrand','limbPreset','limbCarbonPercent','limbMaterial','limbModel','compoundAta','compoundLetoff','compoundIboRating','compoundCam','traditionalBowLength','traditionalRatedWeight','traditionalBuild','actualDrawWeight','measuredDrawWeight','setupDrawLength','braceHeight','stringMaterial','releaseType','shootingUse','stabilizerSetup','riserAddedWeight','stabilizerWeight','damperCount','damperWeight','shaftMaterial','spineValue','shaftModel','tipType','fletchType','nockType','arrowUse','arrowLength','gpi','pointWeight','insertWeight','nockWeight','fletchingSetWeight','vaneCount','shaftDiameter','velocitySource','measuredSpeed','altitude','temperature','cdShaft','fletchProfile','tipCd'];
const profileNameMap = {barebow:'Arco nudo · ricurvo', olympic:'Ricurvo olimpico', compound:'Compound', longbow:'Longbow', traditional:'Tradizionale ricurvo', horsebow:'Arco storico / a cavallo', other:'Configurazione custom'};
const LIMB_PRESETS = {
  'uukha-alpha': {brand:'uukha', model:'Uukha ALPHA · U5 Target', carbon:'70', material:'carbon-monolith', note:'Uukha ALPHA U5 Target: 70% carbonio e 30% fibra di vetro. La serie Target è misurata su riser da 25″, con bulloni di tiller in posizione mediana e incrementi nominali da 2 lb. Fonte: pagina ufficiale Uukha Target.'},
  'uukha-sigma': {brand:'uukha', model:'Uukha SIGMA · U5 Target', carbon:'90', material:'carbon-monolith', note:'Uukha SIGMA U5 Target: 90% carbonio e 10% fibra di vetro. La serie Target è misurata su riser da 25″, con bulloni di tiller in posizione mediana e incrementi nominali da 2 lb. Fonte: pagina ufficiale Uukha Target.'},
  'uukha-omega': {brand:'uukha', model:'Uukha OMEGA · U5 Target', carbon:'100', material:'carbon-monolith', note:'Uukha OMEGA U5 Target: 100% carbonio. Il produttore segnala una costruzione con fibre di carbonio ad alte prestazioni. La serie Target è misurata su riser da 25″ con bulloni di tiller in posizione mediana e incrementi nominali da 2 lb. Fonte: pagina ufficiale Uukha Target.'}
};
function updateLimbPresetNote(message = '') {
  const target = $('limbPresetNote');
  if (!target) return;
  if (message) {
    target.innerHTML = `${message} <a href="https://www.uukha.com/en/limbs/target" target="_blank" rel="noopener noreferrer">Fonte ufficiale Uukha ↗</a>`;
    return;
  }
  target.innerHTML = 'La percentuale di carbonio è un dato di composizione dichiarato, non un coefficiente balistico. Non tutte le marche pubblicano una percentuale direttamente confrontabile: per i modelli non elencati inserisci soltanto un dato verificato. <a href="https://www.uukha.com/en/limbs/target" target="_blank" rel="noopener noreferrer">Uukha Target: fonte ufficiale ↗</a>';
}
function applyLimbPreset() {
  const key = $('limbPreset')?.value || 'manual';
  const preset = LIMB_PRESETS[key];
  if (!preset) { updateLimbPresetNote(); updateEquipmentSummary(); return; }
  $('limbBrand').value = preset.brand;
  $('limbModel').value = preset.model;
  $('limbCarbonPercent').value = preset.carbon;
  $('limbMaterial').value = preset.material;
  updateLimbPresetNote(preset.note);
  updateEquipmentSummary();
  refresh();
}
function clearLimbPresetOnManualEdit() {
  const preset = $('limbPreset')?.value;
  if (preset && preset !== 'manual' && $('limbModel')?.value !== (LIMB_PRESETS[preset]?.model || '')) {
    $('limbPreset').value = 'manual';
    updateLimbPresetNote();
  }
}

function updateEquipmentSummary() {
  const type = $('bowType')?.value || 'barebow';
  const recurve = ['barebow','olympic'].includes(type);
  const compound = type === 'compound';
  const traditional = !recurve && !compound;
  const recGroup=$('recurveFields'), compGroup=$('compoundFields'), tradGroup=$('traditionalFields'), limbGroup=$('limbTechGroup');
  if (recGroup) { recGroup.hidden = !recurve; recGroup.classList.toggle('hidden', !recurve); }
  if (compGroup) { compGroup.hidden = !compound; compGroup.classList.toggle('hidden', !compound); }
  if (tradGroup) { tradGroup.hidden = !traditional; tradGroup.classList.toggle('hidden', !traditional); }
  if (limbGroup) { limbGroup.hidden = compound; limbGroup.classList.toggle('hidden', compound); }
  const actualLabel = $('actualWeightLabel');
  if (actualLabel) actualLabel.textContent = compound ? 'Potenza di picco dell’arco' : 'Potenza all’allungo (se misurata)';
  const measuredBox = $('measuredDrawWeight');
  if (measuredBox) { measuredBox.disabled = compound; if (compound) measuredBox.checked = false; }
  const release = $('releaseType');
  if (release) {
    const mech = release.querySelector('option[value="mechanical"]');
    if (mech) mech.textContent = compound ? 'Sgancio meccanico / release' : 'Sgancio meccanico (se usato)';
  }
  let bowLen;
  if (recurve) {
    const riser = num('riserLength');
    const limbEff = {short:41,medium:43,long:45,'extra-long':47}[$('limbLength').value] || 43;
    bowLen = riser + limbEff;
  } else if (compound) bowLen = num('compoundAta');
  else bowLen = num('traditionalBowLength');
  $('overallBowLength').textContent = bowLen > 0 ? `${fmt(bowLen,0)}″` : '—';
  $('bowProfileSummary').textContent = profileNameMap[type] || 'Configurazione custom';
  let note = '';
  if (compound) note = 'Per compound, la stima IBO può usare rating, allungo, potenza di picco e massa della freccia. Il cronografo resta preferibile.';
  else if (type === 'other') note = 'Profilo libero: registra i dati reali. La simulazione non deduce la velocità dal tipo di arco.';
  else note = 'La potenza stampata sui flettenti è normalmente riferita a una lunghezza standard. Per i calcoli usa la potenza effettiva misurata al tuo allungo.';
  const carbon = $('limbCarbonPercent')?.value;
  if (!compound && carbon) note += ` Composizione registrata: ${carbon}% carbonio dichiarato; il dato descrive i materiali, ma non viene convertito direttamente in velocità.`;
  else if (!compound) note += ' La percentuale di carbonio è solo descrittiva: non sostituisce il peso effettivo né la misura al cronografo.';
  const riserMass = Math.max(0, num('riserAddedWeight'));
  const stabilizerMass = Math.max(0, num('stabilizerWeight'));
  const damperMass = Math.max(0, num('damperWeight'));
  const damperCount = Math.max(0, num('damperCount'));
  const stabilizationName = $('stabilizerSetup')?.selectedOptions?.[0]?.textContent || 'non specificata';
  note += ` Stabilizzazione: ${stabilizationName}. Masse registrate: ${fmt(riserMass,0)} g sul riser, ${fmt(stabilizerMass,0)} g stabilizzatori e ${fmt(damperMass,0)} g smorzatori (${fmt(damperCount,0)}). Questi dati descrivono equilibrio, inerzia e smorzamento: possono influire sulla reazione dell'arco e sulla ripetibilità, ma non vengono convertiti direttamente in velocità o traiettoria.`;
  $('equipmentAdvice').textContent = note;
  const details = $('iboDetails'); if (details) details.classList.toggle('hidden', !compound);
}
function saveEquipmentProfile() {
  const profile = {};
  EQUIPMENT_IDS.forEach(id => { const el=$(id); if(el) profile[id]=el.value; });
  profile.syncTrajectorySpeed = Boolean($('syncTrajectorySpeed')?.checked);
  try {
    localStorage.setItem('archeryLab.equipmentProfile.v1', JSON.stringify(profile));
    $('equipmentSaveStatus').textContent = 'Configurazione salvata su questo dispositivo.';
    $('equipmentSaveStatus').classList.add('saved');
  } catch (err) {
    $('equipmentSaveStatus').textContent = 'Il browser non consente di salvare il profilo. Puoi comunque usare i calcoli.';
  }
}
function loadEquipmentProfile() {
  try {
    const raw = localStorage.getItem('archeryLab.equipmentProfile.v1');
    if (!raw) { $('equipmentSaveStatus').textContent = 'Non trovo ancora un profilo salvato su questo dispositivo.'; return; }
    const profile = JSON.parse(raw);
    EQUIPMENT_IDS.forEach(id => { const el=$(id); if(el && Object.prototype.hasOwnProperty.call(profile,id)) el.value=profile[id]; });
    if ($('syncTrajectorySpeed') && typeof profile.syncTrajectorySpeed === 'boolean') $('syncTrajectorySpeed').checked=profile.syncTrajectorySpeed;
    updateEquipmentSummary();
    if ($('fletchType')) syncFletchProfile();
    if ($('tipType')) {
      const cd = {field:0,target:0,mechanical:.2,fixedCompact:1.2,fixedLarge:2.8,blunt:0}[$('tipType').value];
      if (Number.isFinite(cd)) $('tipCd').value=String(cd);
    }
    refresh();
    $('equipmentSaveStatus').textContent = 'Profilo caricato. Controlla che tutte le misure corrispondano alla configurazione reale.';
  } catch(err) { $('equipmentSaveStatus').textContent = 'Impossibile leggere il profilo salvato.'; }
}
const ARROW_PROFILE_IDS = ['shaftMaterial','spineValue','shaftModel','fletchType','tipType','nockType','rearAssembly','arrowUse','weightInputUnit','arrowLength','gpi','shaftWeightMeasured','pointWeight','insertWeight','nockWeight','pinWeight','fletchingSetWeight','vaneCount','shaftDiameter'];
const ARROW_ARCHIVE_KEY = 'archeryLab.arrowProfiles.v2';
function migrateArrowValues(values) {
  const migrated = {...values};
  if (!Object.prototype.hasOwnProperty.call(migrated, 'fletchingSetWeight')) {
    const oldVane = Number.parseFloat(migrated.vaneWeight) || 0;
    const oldCount = Math.max(0, Number.parseFloat(migrated.vaneCount) || 0);
    const oldWrap = Number.parseFloat(migrated.wrapWeight) || 0;
    migrated.fletchingSetWeight = String(oldVane * oldCount + oldWrap);
  }
  delete migrated.wrapWeight; delete migrated.vaneWeight;
  return migrated;
}
function readArrowArchive() {
  try {
    const raw = localStorage.getItem(ARROW_ARCHIVE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(p => p && p.id && p.values) : [];
  } catch (_) { return []; }
}
function writeArrowArchive(list) { localStorage.setItem(ARROW_ARCHIVE_KEY, JSON.stringify(list)); }
function currentArrowValues() {
  const values = {};
  ARROW_PROFILE_IDS.forEach(id => { const el = $(id); if (el) values[id] = el.value; });
  return values;
}
function applyArrowValues(values) {
  values = migrateArrowValues(values);
  ARROW_PROFILE_IDS.forEach(id => { const el = $(id); if (el && Object.prototype.hasOwnProperty.call(values, id)) el.value = values[id]; });
  if ($('weightInputUnit')) $('weightInputUnit').dataset.previousUnit = $('weightInputUnit').value;
  fletchingWeightEdited = Object.prototype.hasOwnProperty.call(values, 'fletchingSetWeight');
  updateGrainConversions(); refresh();
}
function setArrowArchiveStatus(message, ok=false) {
  const el=$('arrowSaveStatus'); if (!el) return;
  el.textContent=message; el.classList.toggle('saved',ok);
}
function refreshArrowArchiveSelect(selectId='') {
  const select=$('arrowProfileSelect'); if (!select) return;
  const list=readArrowArchive();
  select.innerHTML='<option value="">Seleziona una freccia salvata</option>' + list.map(p=>`<option value="${String(p.id).replace(/&/g,'&amp;').replace(/"/g,'&quot;')} ">${String(p.name||'Freccia senza nome').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('');
  // Remove intentional padding from values and restore the selected record.
  [...select.options].forEach(o=>{o.value=o.value.trim();});
  if (selectId && list.some(p=>p.id===selectId)) select.value=selectId;
}
function selectedArrowRecord() {
  const id=$('arrowProfileSelect')?.value;
  return id ? readArrowArchive().find(p=>p.id===id) : null;
}
function saveArrowProfile() {
  const name=$('arrowProfileName')?.value.trim();
  if (!name) { setArrowArchiveStatus('Inserisci un nome per la freccia prima di salvarla.'); $('arrowProfileName')?.focus(); return; }
  try {
    const list=readArrowArchive();
    if (list.some(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase())) {
      setArrowArchiveStatus('Esiste già una freccia con questo nome. Usa “Aggiorna selezionata” oppure scegli un nome diverso.'); return;
    }
    const record={id:`arrow-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,values:currentArrowValues(),savedAt:new Date().toISOString()};
    list.push(record); writeArrowArchive(list); refreshArrowArchiveSelect(record.id);
    setArrowArchiveStatus(`“${name}” salvata nell’archivio.`,true);
  } catch (_) { setArrowArchiveStatus('Salvataggio non disponibile in questo browser.'); }
}
function updateArrowProfile() {
  const selected=selectedArrowRecord();
  if (!selected) { setArrowArchiveStatus('Seleziona prima una freccia da aggiornare.'); return; }
  const name=$('arrowProfileName')?.value.trim();
  if (!name) { setArrowArchiveStatus('Inserisci un nome per la configurazione.'); return; }
  const list=readArrowArchive();
  if (list.some(p=>p.id!==selected.id && p.name.toLocaleLowerCase()===name.toLocaleLowerCase())) { setArrowArchiveStatus('Un’altra freccia usa già questo nome.'); return; }
  const updated=list.map(p=>p.id===selected.id?{...p,name,values:currentArrowValues(),savedAt:new Date().toISOString()}:p);
  try { writeArrowArchive(updated); refreshArrowArchiveSelect(selected.id); setArrowArchiveStatus(`“${name}” aggiornata.`,true); }
  catch (_) { setArrowArchiveStatus('Impossibile aggiornare l’archivio.'); }
}
function loadArrowProfile() {
  const record=selectedArrowRecord();
  if (record) {
    applyArrowValues(record.values); $('arrowProfileName').value=record.name;
    setArrowArchiveStatus(`Configurazione “${record.name}” caricata.`,true); return;
  }
  // Migrazione trasparente del vecchio salvataggio singolo.
  try {
    const raw=localStorage.getItem('archeryLab.arrowProfile.v1');
    if (raw) {
      const old=JSON.parse(raw); const list=readArrowArchive();
      const record={id:`arrow-migrated-${Date.now()}`,name:'Freccia salvata (archivio precedente)',values:{}};
      [...ARROW_PROFILE_IDS,'wrapWeight','vaneWeight'].forEach(id=>{if(Object.prototype.hasOwnProperty.call(old,id)) record.values[id]=old[id];});
      record.values = migrateArrowValues(record.values);
      list.push(record); writeArrowArchive(list); refreshArrowArchiveSelect(record.id); applyArrowValues(record.values); $('arrowProfileName').value=record.name;
      setArrowArchiveStatus('Vecchia configurazione recuperata e aggiunta all’archivio.',true); return;
    }
  } catch (_) {}
  setArrowArchiveStatus('Seleziona una freccia salvata. Se hai un vecchio salvataggio, verrà recuperato automaticamente.');
}
async function duplicateArrowProfile() {
  const selected=selectedArrowRecord();
  if (!selected) { setArrowArchiveStatus('Seleziona prima una freccia da duplicare.'); return; }
  const name=await window.GlassUI.prompt('Nome della nuova variante:',`${selected.name} · variante`,{title:'Duplica freccia',ok:'Duplica'});
  if (name===null) return;
  const clean=name.trim(); if (!clean) { setArrowArchiveStatus('Il nome della variante non può essere vuoto.'); return; }
  const list=readArrowArchive(); if(list.some(p=>p.name.toLocaleLowerCase()===clean.toLocaleLowerCase())) { setArrowArchiveStatus('Esiste già una freccia con questo nome.'); return; }
  const record={id:`arrow-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:clean,values:{...selected.values},savedAt:new Date().toISOString()};
  try { list.push(record); writeArrowArchive(list); refreshArrowArchiveSelect(record.id); $('arrowProfileName').value=clean; setArrowArchiveStatus(`Variante “${clean}” creata.`,true); }
  catch (_) { setArrowArchiveStatus('Impossibile duplicare la configurazione.'); }
}
async function deleteArrowProfile() {
  const selected=selectedArrowRecord(); if(!selected) {setArrowArchiveStatus('Seleziona prima una freccia da eliminare.');return;}
  if(!(await window.GlassUI.confirm(`Eliminare la configurazione “${selected.name}”? L’operazione non si può annullare.`,{title:'Elimina freccia',ok:'Elimina',destructive:true}))) return;
  try { writeArrowArchive(readArrowArchive().filter(p=>p.id!==selected.id)); refreshArrowArchiveSelect(); setArrowArchiveStatus(`“${selected.name}” eliminata dall’archivio.`,true); }
  catch (_) { setArrowArchiveStatus('Impossibile eliminare la configurazione.'); }
}
function exportArrowProfiles() {
  const list=readArrowArchive(); if(!list.length) {setArrowArchiveStatus('L’archivio è vuoto: non c’è nulla da esportare.');return;}
  const blob=new Blob([JSON.stringify({app:'Archery Lab',schema:2,exportedAt:new Date().toISOString(),arrows:list},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='archery-lab-archivio-frecce.json'; a.click(); URL.revokeObjectURL(url);
  setArrowArchiveStatus(`Esportate ${list.length} configurazioni.`,true);
}
function importArrowProfilesFile(file) {
  if(!file) return;
  const reader=new FileReader(); reader.onload=()=>{
    try {
      const data=JSON.parse(String(reader.result)); const incoming=Array.isArray(data)?data:data.arrows;
      if(!Array.isArray(incoming)) throw new Error('Formato');
      const current=readArrowArchive(); let added=0;
      for(const item of incoming) {
        if(!item || !item.values || typeof item.values!=='object') continue;
        let name=String(item.name||'Freccia importata').trim()||'Freccia importata';
        let base=name, n=2; while(current.some(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase())) name=`${base} (${n++})`;
        const values={}; ARROW_PROFILE_IDS.forEach(id=>{if(Object.prototype.hasOwnProperty.call(item.values,id)) values[id]=String(item.values[id]);});
        const migrated = migrateArrowValues(values);
        current.push({id:`arrow-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,values:migrated,savedAt:new Date().toISOString()}); added++;
      }
      writeArrowArchive(current); refreshArrowArchiveSelect(); setArrowArchiveStatus(`Importate ${added} configurazioni.`,true);
    } catch (_) { setArrowArchiveStatus('File non valido: scegli un archivio JSON esportato da Archery Lab.'); }
  }; reader.readAsText(file);
}
$('saveArrowProfile')?.addEventListener('click',saveArrowProfile);
$('updateArrowProfile')?.addEventListener('click',updateArrowProfile);
$('loadArrowProfile')?.addEventListener('click',loadArrowProfile);
$('duplicateArrowProfile')?.addEventListener('click',duplicateArrowProfile);
$('deleteArrowProfile')?.addEventListener('click',deleteArrowProfile);
$('exportArrowProfiles')?.addEventListener('click',exportArrowProfiles);
$('importArrowProfiles')?.addEventListener('click',()=>$('importArrowProfilesFile')?.click());
$('importArrowProfilesFile')?.addEventListener('change',e=>{importArrowProfilesFile(e.target.files?.[0]);e.target.value='';});
$('arrowProfileSelect')?.addEventListener('change',()=>{const r=selectedArrowRecord();if(r){$('arrowProfileName').value=r.name;setArrowArchiveStatus(`Selezionata: ${r.name}. Premi “Carica selezionata” per applicarla.`);}});
refreshArrowArchiveSelect();

function syncTipCd() {
  const el=$('tipType'); if(!el || !$('tipCd')) return;
  const cd = {field:0,target:0,mechanical:.2,fixedCompact:1.2,fixedLarge:2.8,blunt:0}[el.value];
  if (Number.isFinite(cd)) $('tipCd').value=String(cd);
}
function syncFletchProfile() {
  const el=$('fletchType'); if(!el || !$('fletchProfile')) return;
  const values = {plastic_standard:1.8,plastic_low:.6,plastic_high:2.4,feather_low:.75,feather_standard:2.2,feather_high:3,spinwing:.9,none:0};
  if (Number.isFinite(values[el.value])) $('fletchProfile').value=String(values[el.value]);
  if (el.value === 'none' && $('vaneCount')) $('vaneCount').value='0';
  else if (num('vaneCount') === 0 && $('vaneCount')) $('vaneCount').value='3';
}
function syncFletchTypeFromCoefficient() {
  const el=$('fletchType'); if(!el || !$('fletchProfile')) return;
  const val=num('fletchProfile');
  const nearest = Object.entries({plastic_standard:1.8,plastic_low:.6,plastic_high:2.4,feather_low:.75,feather_standard:2.2,feather_high:3,spinwing:.9,none:0}).sort((a,b)=>Math.abs(a[1]-val)-Math.abs(b[1]-val))[0];
  if (nearest) el.value=nearest[0];
}
$('bowType')?.addEventListener('change', () => { updateEquipmentSummary(); refresh(); });
$('measuredDrawWeight')?.addEventListener('change', refresh);
$('limbPreset')?.addEventListener('change', applyLimbPreset);
$('limbBrand')?.addEventListener('change', () => { if ($('limbBrand').value !== 'uukha' && $('limbPreset').value !== 'manual') { $('limbPreset').value = 'manual'; updateLimbPresetNote(); } updateEquipmentSummary(); });
$('limbModel')?.addEventListener('input', () => { clearLimbPresetOnManualEdit(); });
$('limbCarbonPercent')?.addEventListener('change', () => { if ($('limbPreset').value !== 'manual' && $('limbCarbonPercent').value !== LIMB_PRESETS[$('limbPreset').value]?.carbon) { $('limbPreset').value='manual'; updateLimbPresetNote(); } updateEquipmentSummary(); });
['riserLength','limbLength','limbRatedWeight','actualDrawWeight','measuredDrawWeight','setupDrawLength','compoundIboRating','compoundAta','traditionalBowLength','traditionalRatedWeight'].forEach(id => $(id)?.addEventListener('input', () => { updateEquipmentSummary(); refresh(); }));
$('tipType')?.addEventListener('change', () => { syncTipCd(); refresh(); });
$('rearAssembly')?.addEventListener('change', refresh);
$('weightInputUnit')?.addEventListener('change', (event) => changeWeightInputUnit(event.target.value));
if ($('weightInputUnit')) $('weightInputUnit').dataset.previousUnit = $('weightInputUnit').value;
let fletchingWeightEdited = false;
$('fletchingSetWeight')?.addEventListener('input', () => { fletchingWeightEdited = true; });
function defaultFletchingWeight(type) {
  if (type === 'none') return 0;
  if (type.startsWith('feather_')) return 16;
  if (type === 'spinwing') return 3;
  return 8;
}
$('fletchType')?.addEventListener('change', () => {
  syncFletchProfile();
  if (!fletchingWeightEdited) { const weight = $('fletchingSetWeight'); if (weight) { const grains = defaultFletchingWeight($('fletchType').value); weight.value = String(Number(($('weightInputUnit').value === 'g' ? grains / 15.4323584 : grains).toFixed(4))); } }
  refresh();
});
$('fletchProfile')?.addEventListener('change', () => { syncFletchTypeFromCoefficient(); refresh(); });
$('saveArrowProfile')?.addEventListener('click', saveArrowProfile);
$('loadArrowProfile')?.addEventListener('click', loadArrowProfile);
$('saveEquipment')?.addEventListener('click', saveEquipmentProfile);
$('loadEquipment')?.addEventListener('click', loadEquipmentProfile);
$('useIboSpeed')?.addEventListener('click', () => {
  const estimate = iboEstimate(getArrow().total);
  if (!Number.isFinite(estimate) || estimate <= 0) {
    $('equipmentSaveStatus').textContent = 'Compila i dati compound nella scheda Attrezzatura prima di usare la stima IBO.';
    return;
  }
  $('measuredSpeed').value=String(Math.round(estimate));
  $('velocitySource').value='ibo';
  if ($('syncTrajectorySpeed')) $('syncTrajectorySpeed').checked=true;
  refresh();
  $('equipmentSaveStatus').textContent = 'Stima IBO applicata. Il dato resta indicativo: verifica al cronografo.';
});
$('velocitySource')?.addEventListener('change', () => { if ($('syncTrajectorySpeed')) $('syncTrajectorySpeed').checked=true; refresh(); });
$('syncTrajectorySpeed')?.addEventListener('change', () => { if ($('syncTrajectorySpeed').checked) { const speed=currentSpeed(getArrow().total); if(Number.isFinite(speed)&&speed>0)$('trajectorySpeed').value=String(speed); } });
$('playTrajectory')?.addEventListener('click', playTrajectoryAnimation);
$('goArrowPanel')?.addEventListener('click', () => document.querySelector('.tab[data-tab="arrow"]')?.click());
$('goTrajectoryPanel')?.addEventListener('click', () => document.querySelector('.tab[data-tab="trajectory"]')?.click());
updateEquipmentSummary();
syncTipCd(); syncFletchProfile();

// Recalculate on changes; do not automatically re-run the potentially heavier trajectory solver.
for (const input of document.querySelectorAll('input, select')) {
  input.addEventListener('input', refresh);
  input.addEventListener('change', refresh);
}
$('trajectorySpeed')?.addEventListener('input', () => { if ($('syncTrajectorySpeed')?.checked) { $('syncTrajectorySpeed').checked = false; $('syncTrajectorySpeed').dispatchEvent(new Event('change')); } });
refresh();

// Web App: open the panel named in the URL hash (e.g. #trajectory).
(() => {
  const open = () => {
    const key = (location.hash || '').slice(1);
    const btn = key && document.querySelector(`.tab[data-tab="${CSS.escape(key)}"]`);
    if (btn && !btn.classList.contains('active')) btn.click();
  };
  open();
  window.addEventListener('hashchange', open);
})();

// Printable technical sheet.
(function(){
  const b=document.getElementById('al-export-arrow-pdf'); if(!b)return;
  b.addEventListener('click',function(){
    const main=document.querySelector('main')||document.body;
    const clone=main.cloneNode(true);
    clone.querySelectorAll('button,nav,header,footer,.segmented-sticky,.no-print,details').forEach(e=>e.remove());
    clone.querySelectorAll('.panel').forEach(p=>{p.style.display='block';});
    const w=window.open('','_blank');
    if(!w){window.GlassUI.alert('Il browser ha bloccato la finestra della scheda. Consenti i popup per questa pagina e riprova.',{title:'Scheda PDF'});return;}
    const title='Archery Lab — Scheda tecnica della freccia';
    w.document.open();
    w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>'+title+'</title><style>body{font:13px/1.45 -apple-system,Arial,sans-serif;color:#172033;margin:18px}h1{font-size:22px}h2{font-size:18px;margin:22px 0 6px}svg{max-width:100%;height:auto}input,select{border:0;background:transparent;color:inherit;font:inherit;font-weight:700}label{display:block;padding:3px 0;border-bottom:1px solid #eee}label span{color:#667;margin:0 6px}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.metric{border:1px solid #dde;border-radius:8px;padding:8px}.metric strong{display:block;font-size:17px}.card,section{break-inside:avoid;margin-bottom:12px}.large-title p,.empty-chart{display:none}@page{size:A4;margin:12mm}</style></head><body><h1>'+title+'</h1><p>Generata il '+new Date().toLocaleDateString('it-IT')+'</p>'+clone.innerHTML+'<script>window.onload=function(){setTimeout(function(){window.print()},250)};<\/script></body></html>');
    w.document.close();
  });
})();
