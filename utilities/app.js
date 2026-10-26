(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fmt = (n, max = 4) => Number.isFinite(n)
    ? n.toLocaleString('it-IT', { maximumFractionDigits: Math.abs(n) >= 1000 ? 1 : max, minimumFractionDigits: 0 })
    : '—';

  // Factors to a base unit: grams, millimetres, newtons, metres per second.
  const GRAIN_G = 0.06479891;
  const units = {
    weight: { base: { gr: GRAIN_G, g: 1, oz: 28.349523125, lb: 453.59237, kg: 1000 },
      label: { gr: 'Grani', g: 'Grammi', oz: 'Once', lb: 'Libbre', kg: 'Chilogrammi' },
      sym: { gr: 'gr', g: 'g', oz: 'oz', lb: 'lb', kg: 'kg' } },
    length: { base: { inch: 25.4, cm: 10, mm: 1, ft: 304.8, m: 1000 },
      label: { inch: 'Pollici', cm: 'Centimetri', mm: 'Millimetri', ft: 'Piedi', m: 'Metri' },
      sym: { inch: '″', cm: 'cm', mm: 'mm', ft: 'ft', m: 'm' } },
    force: { base: { lbf: 4.4482216152605, kgf: 9.80665, N: 1 },
      label: { lbf: 'Libbre-forza', kgf: 'Chilogrammi-forza', N: 'Newton' },
      sym: { lbf: 'lbf', kgf: 'kgf', N: 'N' } },
    speed: { base: { ms: 1, fps: 0.3048, kmh: 1 / 3.6 },
      label: { ms: 'Metri al secondo', fps: 'Piedi al secondo', kmh: 'Chilometri orari' },
      sym: { ms: 'm/s', fps: 'fps', kmh: 'km/h' } }
  };

  function convert(kind) {
    const u = units[kind];
    const value = Number.parseFloat($(`${kind}Value`).value);
    const from = $(`${kind}Unit`).value;
    const box = $(`${kind}Results`);
    box.replaceChildren();
    Object.keys(u.base).filter(k => k !== from).forEach(k => {
      const row = document.createElement('div');
      row.className = 'row';
      const name = document.createElement('span');
      name.textContent = u.label[k];
      const out = document.createElement('strong');
      out.className = 'row-value num';
      out.textContent = Number.isFinite(value) ? `${fmt(value * u.base[from] / u.base[k])} ${u.sym[k]}` : '—';
      row.append(name, out);
      box.append(row);
    });
  }

  function sumArrow() {
    const ids = ['shaft', 'point', 'insert', 'nock', 'vanes', 'other'];
    const grains = ids.reduce((s, id) => {
      const v = Number.parseFloat($(id).value);
      return s + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0);
    $('arrowGrains').textContent = `${fmt(grains, 1)} gr`;
    $('arrowGrams').textContent = `${fmt(grains * GRAIN_G, 2)} g`;
  }

  Object.keys(units).forEach(kind => {
    $(`${kind}Value`).addEventListener('input', () => convert(kind));
    $(`${kind}Unit`).addEventListener('change', () => convert(kind));
    convert(kind);
  });
  ['shaft', 'point', 'insert', 'nock', 'vanes', 'other'].forEach(id => $(id).addEventListener('input', sumArrow));
  sumArrow();
})();
