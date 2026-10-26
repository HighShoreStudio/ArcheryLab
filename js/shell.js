/* Archery Lab · Web App shell
   Tab bar, scroll-edge nav, in-app alerts (replacing confirm/prompt),
   share actions and offline support. */
(() => {
  'use strict';
  const body = document.body;
  const root = body.dataset.root || '';
  const current = body.dataset.tab || 'home';

  /* ---------- Ambient background ---------- */
  if (!document.querySelector('.ambient')) {
    const amb = document.createElement('div');
    amb.className = 'ambient';
    amb.setAttribute('aria-hidden', 'true');
    body.prepend(amb);
  }

  /* ---------- Tab bar ---------- */
  const icons = {
    home: '<path d="M3.5 11.4 12 4.2l8.5 7.2"/><path d="M5.9 9.8V20h4.3v-5.6h3.6V20h4.3V9.8"/>',
    arrow: '<path d="M5 19 18.6 5.4"/><path d="M12.6 4.6h6.8v6.8"/><path d="M5 19l-.4-4.2M5 19l4.2.4M7.7 16.3l-.4-4.1M7.7 16.3l4.1.4"/>',
    target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><path d="M12 1.6v3.2M12 19.2v3.2M1.6 12h3.2M19.2 12h3.2"/>',
    group: '<circle cx="12" cy="12" r="9"/><circle cx="9.6" cy="10.2" r="1.35" fill="currentColor" stroke="none"/><circle cx="13.9" cy="10.9" r="1.35" fill="currentColor" stroke="none"/><circle cx="11.2" cy="14.4" r="1.35" fill="currentColor" stroke="none"/><circle cx="15.1" cy="15.1" r="1.35" fill="currentColor" stroke="none"/>',
    more: '<rect x="3.8" y="3.8" width="6.6" height="6.6" rx="1.8"/><rect x="13.6" y="3.8" width="6.6" height="6.6" rx="1.8"/><rect x="3.8" y="13.6" width="6.6" height="6.6" rx="1.8"/><rect x="13.6" y="13.6" width="6.6" height="6.6" rx="1.8"/>'
  };
  const tabs = [
    ['home', 'index.html', 'Home', icons.home],
    ['calcolatore', 'calcolatore/index.html', 'Freccia', icons.arrow],
    ['spennata', 'spennata/index.html', 'Spennata', icons.target],
    ['rosata', 'rosata/index.html', 'Rosata', icons.group],
    ['altro', 'altro/index.html', 'Altro', icons.more]
  ];
  if (!document.querySelector('.tabbar')) {
    const nav = document.createElement('nav');
    nav.className = 'tabbar glass';
    nav.setAttribute('aria-label', 'Sezioni principali');
    nav.innerHTML = tabs.map(([key, href, label, svg]) =>
      `<a class="tab-item" href="${root}${href}"${key === current ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg><span>${label}</span></a>`
    ).join('');
    body.append(nav);
  }

  /* ---------- Scroll edge + compact title ---------- */
  const html = document.documentElement;
  const onScroll = () => html.classList.toggle('scrolled', window.scrollY > 36);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- In-app alerts (confirm / prompt / alert / toast) ---------- */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function sheet({ title = '', message = '', input = null, ok = 'OK', cancel = 'Annulla', destructive = false }) {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'sheet-backdrop';
      back.innerHTML = `<div class="alert glass" role="alertdialog" aria-modal="true" aria-labelledby="gl-alert-t" aria-describedby="gl-alert-m">
        ${title ? `<h3 id="gl-alert-t">${esc(title)}</h3>` : ''}
        <p id="gl-alert-m">${esc(message)}</p>
        ${input !== null ? `<input class="input" id="gl-alert-input" type="text" value="${esc(input)}" autocomplete="off">` : ''}
        <div class="btn-row">${cancel ? `<button type="button" class="btn glassy" data-v="0">${esc(cancel)}</button>` : ''}<button type="button" class="btn filled" data-v="1"${destructive ? ' style="background:var(--red)"' : ''}>${esc(ok)}</button></div>
      </div>`;
      if (!cancel) back.querySelector('.btn-row').style.gridTemplateColumns = '1fr';
      const prevFocus = document.activeElement;
      const done = (v) => {
        back.remove();
        document.removeEventListener('keydown', onKey, true);
        try { prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); } catch (_) {}
        resolve(v);
      };
      const field = () => back.querySelector('#gl-alert-input');
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); done(input !== null ? null : false); }
        if (e.key === 'Enter' && input !== null) { e.preventDefault(); done(field().value); }
      };
      back.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (b) done(b.dataset.v === '1' ? (input !== null ? field().value : true) : (input !== null ? null : false));
        else if (e.target === back && cancel) done(input !== null ? null : false);
      });
      document.addEventListener('keydown', onKey, true);
      (document.querySelector('dialog[open]') || body).append(back);
      setTimeout(() => (field() || back.querySelector('[data-v="1"]')).focus(), 30);
      if (field()) setTimeout(() => field().select(), 40);
    });
  }
  let toastTimer = null;
  const GlassUI = {
    confirm: (message, opts = {}) => sheet({ title: opts.title || 'Confermi?', message, ok: opts.ok || 'Conferma', cancel: opts.cancel || 'Annulla', destructive: !!opts.destructive }),
    prompt: (message, value = '', opts = {}) => sheet({ title: opts.title || '', message, input: value, ok: opts.ok || 'OK' }),
    alert: (message, opts = {}) => sheet({ title: opts.title || '', message, ok: 'OK', cancel: '' }),
    toast(message, ms = 2800) {
      document.querySelector('.toast')?.remove();
      const t = document.createElement('div');
      t.className = 'toast glass';
      t.setAttribute('role', 'status');
      t.textContent = message;
      body.append(t);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.remove(), ms);
    }
  };
  window.GlassUI = GlassUI;

  /* ---------- Share ---------- */
  const appUrl = (() => { try { return new URL(root || './', location.href).href; } catch (_) { return location.href; } })();
  const shareTitle = 'Archery Lab — Il laboratorio digitale dell’arciere';
  const shareText = 'Strumenti pratici per frecce, rosate e accordatura del tiro con l’arco.';
  const say = (m) => { const s = document.getElementById('share-status'); if (s) s.textContent = m; GlassUI.toast(m); };
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      const f = document.createElement('textarea'); f.value = text; f.setAttribute('readonly', ''); f.style.position = 'fixed'; f.style.opacity = '0'; body.append(f); f.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      f.remove(); return ok;
    }
  }
  document.querySelectorAll('[data-share-url]').forEach(n => { n.textContent = appUrl; });
  document.querySelectorAll('[data-share="native"]').forEach(b => b.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: shareTitle, text: shareText, url: appUrl }); }
      catch (e) { if (e && e.name !== 'AbortError') say(await copy(appUrl) ? 'Collegamento copiato negli appunti.' : 'Copia il collegamento qui sotto.'); }
    } else {
      say(await copy(appUrl) ? 'Collegamento copiato: incollalo nell’app che preferisci.' : 'Copia manualmente il collegamento qui sotto.');
    }
  }));
  document.querySelectorAll('[data-share="copy"]').forEach(b => b.addEventListener('click', async () => {
    say(await copy(appUrl) ? 'Collegamento copiato negli appunti.' : 'Copia manualmente: ' + appUrl);
  }));
  document.querySelectorAll('a[data-share-to]').forEach(a => {
    const u = encodeURIComponent(appUrl), t = encodeURIComponent('Archery Lab — strumenti per il tiro con l’arco');
    a.href = { whatsapp: `https://wa.me/?text=${t}%20${u}`, telegram: `https://t.me/share/url?url=${u}&text=${t}`, facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}` }[a.dataset.shareTo] || a.href;
  });
  document.querySelectorAll('[data-install-help]').forEach(b => b.addEventListener('click', () => {
    GlassUI.alert('iPhone e iPad: apri il sito in Safari, tocca Condividi e scegli “Aggiungi alla schermata Home”. Android: apri il menu di Chrome e scegli “Installa app”. Computer: usa l’icona di installazione nella barra degli indirizzi oppure aggiungi la pagina ai Preferiti.', { title: 'Installa Archery Lab' });
  }));

  /* ---------- Persisted checklists (per device) ---------- */
  document.querySelectorAll('[data-persist]').forEach(scope => {
    const key = 'archeryLab.check.' + scope.dataset.persist;
    const boxes = [...scope.querySelectorAll('input[type="checkbox"]')];
    try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); boxes.forEach((b, i) => { if (saved[i]) b.checked = true; }); } catch (_) {}
    const save = () => { try { localStorage.setItem(key, JSON.stringify(boxes.map(b => b.checked))); } catch (_) {} };
    scope.addEventListener('change', save);
    scope.addEventListener('al:reset', () => { boxes.forEach(b => { b.checked = false; }); save(); });
  });

  /* ---------- Offline support (GitHub Pages / any HTTPS host) ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude|anthropic|claudeusercontent/.test(location.hostname)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(root + 'sw.js').catch(() => {});
    });
  }
})();
