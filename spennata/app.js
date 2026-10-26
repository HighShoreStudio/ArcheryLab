(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (id) => document.getElementById(id);
  const state = { active: 'fletched', impacts: { fletched: [], bare: [] }, nextId: 1 };
  let analysisPending = false;
  const CENTER = 220;
  const FACE_RADIUS_PX = 170;
  const PLOT_RADIUS_PX = 180;
  const TARGETS = { 18: { diameter: 40, label: '40 cm · indoor' }, 50: { diameter: 122, label: '122 cm · outdoor' } };
  function targetConfig() {
    const distance = Number(el('distance')?.value || 18);
    const key = Math.round(distance);
    return TARGETS[key] || (distance < 34 ? TARGETS[18] : TARGETS[50]);
  }
  function cmPerPixel() { return (targetConfig().diameter / 2) / FACE_RADIUS_PX; }
  function maxCoordinateCm() { return PLOT_RADIUS_PX * cmPerPixel(); }
  // Stima il punteggio usando i dieci anelli concentrici della faccia selezionata.
  // Le coordinate sono il centro stimato dell'impatto; la valutazione ufficiale
  // può differire quando il diametro della freccia tocca una linea di punteggio.
  function impactScore(x, y) {
    const radius = Math.hypot(x, y);
    const faceRadius = targetConfig().diameter / 2;
    if (!Number.isFinite(radius) || radius > faceRadius + 1e-9) return 0;
    for (let score = 10; score >= 1; score--) {
      const outerRadius = faceRadius * (11 - score) / 10;
      if (radius <= outerRadius + 1e-9) return score;
    }
    return 0;
  }
  const svg = el('target');
  const layer = el('impactLayer');

  function fmt(value, decimals = 1) {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function safeText(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function selectedName(key) { return key === 'fletched' ? 'Impennate' : 'Spennate'; }
  function getStats(key) {
    const points = state.impacts[key];
    if (!points.length) return null;
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const rms = Math.sqrt(points.reduce((sum, p) => sum + (p.x - x) ** 2 + (p.y - y) ** 2, 0) / points.length);
    return { x, y, rms, n: points.length };
  }
  function addPoint(key, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (Math.abs(x) > maxCoordinateCm() || Math.abs(y) > maxCoordinateCm() || Math.hypot(x, y) > maxCoordinateCm()) {
      announce(`Coordinate fuori dall'area del grafico (circa ±${fmt(maxCoordinateCm())} cm).`);
      return;
    }
    state.impacts[key].push({ id: state.nextId++, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    render();
  }
  function announce(message) {
    el('diagnosisTitle').textContent = message;
  }
  function createSvg(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }
  function renderTarget() {
    const config = targetConfig();
    const faceRadiusCm = config.diameter / 2;
    const pxPerCm = FACE_RADIUS_PX / faceRadiusCm;
    const ringGroup = el('ringFills');
    if (ringGroup) {
      ringGroup.replaceChildren();
      // Disegna le zone regolamentari dall'esterno verso il centro:
      // bianco (1-2), nero (3-4), azzurro (5-6), rosso (7-8), giallo (9-10).
      // I cerchi sono inseriti dal più grande al più piccolo, così i colori
      // interni non vengono coperti dal cerchio esterno.
      const rings = [
        { radius: 1.0, color: '#ffffff' },
        { radius: 0.8, color: '#111820' },
        { radius: 0.6, color: '#00a8e8' },
        { radius: 0.4, color: '#ed2939' },
        { radius: 0.2, color: '#ffdf00' }
      ];
      rings.forEach(ring => ringGroup.append(createSvg('circle', {
        cx: CENTER, cy: CENTER, r: FACE_RADIUS_PX * ring.radius, fill: ring.color
      })));
    }
    const ringLines = el('ringLines');
    if (ringLines) {
      ringLines.replaceChildren();
      for (let score = 1; score <= 10; score++) {
        ringLines.append(createSvg('circle', { cx: CENTER, cy: CENTER, r: FACE_RADIUS_PX * score / 10, fill: 'none', stroke: score === 10 ? '#aab7c4' : '#c7d1db', 'stroke-width': score % 2 === 0 ? 1.2 : .8 }));
      }
    }
    const axes = el('targetAxes');
    if (axes) {
      axes.replaceChildren();
      const extent = fmt(maxCoordinateCm(), 0);
      axes.append(
        createSvg('path', { d: `M 40 ${CENTER} H 400 M ${CENTER} 40 V 400`, stroke: '#8293a5', 'stroke-width': 1, 'stroke-dasharray': '4 5' }),
        createSvg('text', { x: CENTER, y: 14, 'text-anchor': 'middle', class: 'axis-label' }),
        createSvg('text', { x: CENTER, y: 434, 'text-anchor': 'middle', class: 'axis-label' }),
        createSvg('text', { x: 18, y: 224, 'text-anchor': 'start', class: 'axis-label' }),
        createSvg('text', { x: 422, y: 224, 'text-anchor': 'end', class: 'axis-label' })
      );
      const labels = axes.querySelectorAll('text');
      labels[0].textContent = `+${extent} cm · ALTO`; labels[1].textContent = `−${extent} cm · BASSO`; labels[2].textContent = `−${extent}`; labels[3].textContent = `+${extent}`;
    }
    const tag = el('targetScaleTag');
    if (tag) tag.textContent = `Bersaglio ${config.label} · ${fmt(Number(el('distance')?.value || 18), 0)} m`;
    layer.replaceChildren();
    ['fletched', 'bare'].forEach(key => {
      const points = state.impacts[key];
      points.forEach((p, index) => {
        const x = CENTER + p.x * pxPerCm;
        const y = CENTER - p.y * pxPerCm;
        const score = impactScore(p.x, p.y);
        const g = createSvg('g', { 'aria-label': `${selectedName(key)} ${index + 1}: X ${fmt(p.x)} cm, Y ${fmt(p.y)} cm, punteggio ${score}` });
        const c = createSvg('circle', { cx: x, cy: y, r: 8.5, class: `shot-dot ${key}` });
        const t = createSvg('text', { x, y, class: 'shot-label' });
        t.textContent = String(score);
        g.append(c, t); layer.append(g);
      });
      const stats = getStats(key);
      if (stats) {
        const x = CENTER + stats.x * pxPerCm;
        const y = CENTER - stats.y * pxPerCm;
        const cross = createSvg('g', { class: `center-cross ${key}` });
        cross.append(createSvg('path', { d: `M ${x - 10} ${y} H ${x + 10} M ${x} ${y - 10} V ${y + 10}` }), createSvg('circle', { cx: x, cy: y, r: 6, fill: 'none' }));
        const badge = createSvg('text', { x: clamp(x + 11, 40, 390), y: clamp(y - 12, 32, 408), class: 'center-badge', fill: key === 'fletched' ? '#a76820' : '#1d7656' });
        badge.textContent = key === 'fletched' ? 'CENTRO I' : 'CENTRO S'; layer.append(cross, badge);
      }
    });
  }
  function renderList() {
    const rows = [];
    ['fletched', 'bare'].forEach(key => state.impacts[key].forEach((p, idx) => {
      rows.push({ ...p, key, idx });
    }));
    rows.sort((a,b) => a.id - b.id);
    const list = el('shotList');
    list.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = 'Non hai ancora registrato impatti. Seleziona un gruppo e clicca sul bersaglio.';
      list.append(empty);
    } else {
      rows.forEach(row => {
        const item = document.createElement('div');
        item.className = `shot-row ${row.key}`;
        const dot = document.createElement('i');
        const name = document.createElement('span'); name.textContent = `${row.key === 'fletched' ? 'I' : 'S'}${row.idx + 1}`;
        const coords = document.createElement('strong'); coords.textContent = `X ${fmt(row.x)} · Y ${fmt(row.y)} · ${impactScore(row.x, row.y)} pt`;
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Elimina impatto ${name.textContent}`);
        remove.addEventListener('click', () => { state.impacts[row.key] = state.impacts[row.key].filter(p => p.id !== row.id); render(); });
        item.append(dot, name, coords, remove); list.append(item);
      });
    }
    const f = state.impacts.fletched.length, b = state.impacts.bare.length;
    const scoreF = state.impacts.fletched.reduce((sum, p) => sum + impactScore(p.x, p.y), 0);
    const scoreB = state.impacts.bare.reduce((sum, p) => sum + impactScore(p.x, p.y), 0);
    el('fletchedCount').textContent = f; el('bareCount').textContent = b;
    el('totalCount').textContent = `${f + b} impatti`;
    if (el('fletchedScoreTotal')) el('fletchedScoreTotal').textContent = `${scoreF} pt`;
    if (el('bareScoreTotal')) el('bareScoreTotal').textContent = `${scoreB} pt`;
    if (el('sessionScoreTotal')) el('sessionScoreTotal').textContent = `${scoreF + scoreB} pt`;
  }
  function renderMetrics(applyPendingTechnicalChanges = false) {
    const f = getStats('fletched'), b = getStats('bare');
    const ready = Boolean(f && b);
    const dx = ready ? b.x - f.x : NaN;
    const dy = ready ? b.y - f.y : NaN;
    const distance = ready ? Math.hypot(dx, dy) : NaN;
    el('deltaX').textContent = ready ? `${dx > 0 ? '+' : ''}${fmt(dx)} cm` : '—';
    el('deltaXNote').textContent = ready ? (Math.abs(dx) < 0.5 ? 'Centri quasi allineati in orizzontale' : dx > 0 ? 'Spennate più a destra' : 'Spennate più a sinistra') : 'Serve almeno un impatto per gruppo';
    el('deltaY').textContent = ready ? `${dy > 0 ? '+' : ''}${fmt(dy)} cm` : '—';
    el('deltaYNote').textContent = ready ? (Math.abs(dy) < 0.5 ? 'Centri quasi allineati in verticale' : dy > 0 ? 'Spennate più in alto' : 'Spennate più in basso') : 'Serve almeno un impatto per gruppo';
    el('deltaTotal').textContent = ready ? `${fmt(distance)} cm` : '—';
    el('sampleStatus').textContent = `${f ? f.n : 0} / ${b ? b.n : 0}`;
    el('fletchedCenter').textContent = f ? `X ${fmt(f.x)} · Y ${fmt(f.y)} cm` : '—';
    el('bareCenter').textContent = b ? `X ${fmt(b.x)} · Y ${fmt(b.y)} cm` : '—';
    el('fletchedSpread').textContent = f ? `n=${f.n} · dispersione RMS ${fmt(f.rms)} cm` : 'Inserisci almeno un impatto';
    el('bareSpread').textContent = b ? `n=${b.n} · dispersione RMS ${fmt(b.rms)} cm` : 'Inserisci almeno un impatto';
    // Group geometry always updates. If equipment/quality fields are pending, preserve the prior diagnosis until explicit confirmation.
    // The personalized outcome is always refreshed from the current impact coordinates.
    // Pending equipment edits may defer the technical diagnosis, but must never hide the session result.
    renderLiveConclusion();
    if (!analysisPending || applyPendingTechnicalChanges) {
      renderDiagnosis(f, b, dx, dy, distance);
      if (applyPendingTechnicalChanges && typeof markAnalysisUpdated === 'function') markAnalysisUpdated();
    }
  }
  function setNextAction(kind, symbol, title, summary, steps) {
    const panel = el('nextAction');
    panel.className = `next-action action-${kind}`;
    el('actionSymbol').textContent = symbol;
    el('actionTitle').textContent = title;
    el('actionSummary').textContent = summary;
    const list = el('actionSteps');
    list.replaceChildren();
    steps.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      list.append(li);
    });
  }
  function renderDiagnosis(f, b, dx, dy, distance) {
    const title = el('diagnosisTitle'), icon = el('diagnosisIcon'), body = el('diagnosisBody');
    body.replaceChildren();
    const para = (html, cls = '') => { const p = document.createElement('p'); if (cls) p.className = cls; p.innerHTML = html; body.append(p); };
    const bow = el('bowType').value, hand = el('hand').value;
    const tol = 1.5; // threshold visual only; not a universal tuning target
    if (!f || !b) {
      title.textContent = 'In attesa dei gruppi'; icon.textContent = '1';
      setNextAction('neutral','1','Prima raccogli un campione leggibile','Per ora non modificare l’arco: servono entrambi i gruppi per confrontare le medie.',[
        'Registra almeno 3 impatti impennati e 2 spennati; meglio ripetere la sequenza più volte.',
        'Mantieni la stessa distanza, lo stesso punto di mira e lo stesso setup.',
        'Con arco nudo/stringwalking, mantieni identico il crawl e l’ancoraggio.'
      ]);
      para('Il bersaglio mostra la posizione degli impatti inseriti. Il confronto considera la differenza fra i centri medi, non la distanza dal centro del bersaglio.');
      para('Prima di interpretare il test, controlla che le frecce siano integre e che le spennate abbiano componenti comparabili alle impennate.', 'diagnosis-alert');
      return;
    }
    const enough = f.n >= 3 && b.n >= 2;
    title.textContent = enough ? 'Lettura preliminare del test' : 'Campione ancora ridotto';
    icon.textContent = enough ? '↗' : '…';
    if (!enough) {
      setNextAction('alert','!','Non regolare ancora: aumenta il campione',`Hai ${f.n} impennate e ${b.n} spennate. I centri sono calcolati, ma poche frecce possono essere influenzate da un singolo tiro impreciso.`,[
        'Aggiungi frecce e ripeti una sequenza alternata impennata / spennata.',
        'Mantieni identici distanza, mira, crawl, incocco e condizioni.',
        'Rivedi le indicazioni operative quando avrai almeno 3 impennate e 2 spennate, preferibilmente più serie.'
      ]);
      para(`Scostamento misurato nella sessione: orizzontale ${fmt(dx)} cm e verticale ${fmt(dy)} cm. Sono dati descrittivi, non sufficienti per scegliere una regolazione.`, 'diagnosis-alert');
      para('Completa prima il campione; poi controlla il verticale e, solo dopo, interpreta l’orizzontale. Cambia una sola variabile alla volta.', 'diagnosis-good');
      return;
    }
    const releaseMode = el('releaseMode')?.value || 'fingers';
    const qualityReady = Boolean(el('qSameDistance')?.checked && el('qSameComponents')?.checked && el('qCalmWeather')?.checked && (bow !== 'barebow' || el('qSameCrawl')?.checked));
    if (!qualityReady) {
      title.textContent = 'Prima valida le condizioni del test'; icon.textContent = '⚠';
      setNextAction('caution','!','Non convertire ancora lo scostamento in una regolazione','Mancano una o più conferme chiave (stessa distanza/mira, componenti confrontabili, condizioni stabili o stesso crawl per arco nudo). I numeri rimangono misure descrittive.',[
        'Spunta solo le condizioni che hai realmente rispettato e ripeti il test se necessario.',
        'Per arco nudo/stringwalking, usa lo stesso crawl, ancoraggio e pressione delle dita per entrambe le serie.',
        'Alterna le frecce impennate e spennate e valuta più cicli; se possibile compensa il peso rimosso delle alette senza aggiungere superfici aerodinamiche.',
        'Solo con un campione coerente passa alla lettura verticale e poi orizzontale.'
      ]);
      para(`Scostamento misurato: X ${fmt(dx)} cm, Y ${fmt(dy)} cm, distanza fra i centri ${fmt(distance)} cm. Questi valori descrivono il campione ma non autorizzano una diagnosi finché il test non è comparabile.`, 'diagnosis-alert');
      para('La qualità del test conta quanto la direzione degli impatti. Una spennata singola o un gruppo ampio può riflettere l’esecuzione e non l’assetto dell’arco.', 'diagnosis-good');
      addContextToDiagnosis(); return;
    }
    if (bow === 'compound' || releaseMode === 'mechanical') {
      if (enough) setNextAction('caution','!','Usa una verifica specifica per compound','Con sgancio meccanico, lo scostamento laterale non va tradotto automaticamente in “spine rigido/debole”.',[
        'Controlla prima integrità delle frecce, centro, rest e clearance.',
        'Confronta il test con un paper tune e con le indicazioni del produttore o di un tecnico qualificato.',
        'Non modificare contemporaneamente rest, cam/timing, peso della punta e altri parametri.'
      ]);
      const yText = Math.abs(dy) <= tol ? 'I centri sono relativamente vicini in verticale secondo la soglia visuale di 1,5 cm impostata qui; non è una tolleranza universale.' : dy > 0 ? '<strong>Le spennate sono più in alto.</strong> È uno scostamento da verificare con una procedura appropriata al compound, senza applicare automaticamente la regola per il rilascio con le dita.' : '<strong>Le spennate sono più in basso.</strong> È uno scostamento da verificare con una procedura appropriata al compound, senza applicare automaticamente la regola per il rilascio con le dita.';
      para(`<strong>Verticale:</strong> ${yText}`, Math.abs(dy) <= tol ? 'diagnosis-good' : 'diagnosis-alert');
      para('<strong>Orizzontale:</strong> usa una verifica specifica per compound. Il solo punto d’impatto non basta a diagnosticare lo spine.', 'diagnosis-alert');
      if (!enough) para('<strong>Campione ridotto:</strong> non basare regolazioni su questi pochi impatti.', 'diagnosis-alert');
      return;
    }
    if (releaseMode === 'unknown') {
      setNextAction('caution','!','Specifica il metodo di rilascio','Non applico la regola orizzontale classica senza sapere come viene rilasciata la corda.',[
        'Seleziona dita, sgancio meccanico o configurazione senza bottone, in base al setup reale.',
        'Verifica componenti, punto d’incocco e clearance prima di interpretare le direzioni.',
        'Consulta il manuale o un tecnico per configurazioni particolari.'
      ]);
      para('I centri sono misurati correttamente, ma la diagnosi specifica viene sospesa finché il metodo di rilascio non è noto.', 'diagnosis-alert');
      addContextToDiagnosis(); return;
    }
    // Action priority: vertical tune first; only when vertical is reasonably settled discuss horizontal tuning.
    if (Math.abs(dy) > tol) {
      const high = dy > 0;
      setNextAction('alert', high ? '↑' : '↓', high ? 'Controlla prima il punto d’incocco' : 'Controlla prima il punto d’incocco',
        high
          ? 'Il centro delle spennate è più in alto di quello delle impennate. Nel test classico con rilascio dalle dita può indicare un punto d’incocco troppo basso.'
          : 'Il centro delle spennate è più in basso di quello delle impennate. Nel test classico con rilascio dalle dita può indicare un punto d’incocco troppo alto.',
        [
          'Conferma che i gruppi siano stati tirati alla stessa distanza, con la stessa mira e lo stesso crawl.',
          'Controlla la quota del punto d’incocco con una squadretta prima di toccare il bottone o lo spine.',
          high ? 'Se il test si ripete, prova a spostare il punto d’incocco leggermente verso l’alto; ripeti subito il confronto.' : 'Se il test si ripete, prova a spostare il punto d’incocco leggermente verso il basso; ripeti subito il confronto.',
          'Non cambiare contemporaneamente altre regolazioni. Dopo aver stabilizzato il verticale, rivaluta l’orizzontale.'
        ]);
      para(high
        ? '<strong>Osservazione verticale:</strong> spennate più in alto. La lettura classica suggerisce di verificare un punto d’incocco troppo basso e, se confermato, alzarlo in piccoli passi.'
        : '<strong>Osservazione verticale:</strong> spennate più in basso. La lettura classica suggerisce di verificare un punto d’incocco troppo alto e, se confermato, abbassarlo in piccoli passi.', 'diagnosis-alert');
      para(`<strong>Orizzontale:</strong> le spennate sono ${dx > 0 ? 'più a destra' : 'più a sinistra'} di ${fmt(Math.abs(dx))} cm, ma va rivalutato dopo aver sistemato il verticale.`, 'diagnosis-alert');
    } else {
      if (Math.abs(dx) <= tol) {
        setNextAction('good','✓','I centri sono vicini: per ora non inseguire la singola freccia','Con la soglia descrittiva di 1,5 cm, i centri dei due gruppi risultano relativamente vicini sia in verticale sia in orizzontale.',[
          'Ripeti almeno un’altra serie alternando impennate e spennate.',
          'Controlla che i gruppi siano consistenti e che non ci siano contatti della freccia con rest o finestra.',
          'Se il risultato si ripete, conserva la regolazione e passa a verificare la qualità del gruppo.'
        ]);
        para('I centri sono relativamente vicini in orizzontale e verticale secondo la soglia descrittiva di 1,5 cm usata qui. Non è una tolleranza universale né una garanzia di accordatura perfetta.', 'diagnosis-good');
      } else {
        const stiff = (hand === 'right' && dx < 0) || (hand === 'left' && dx > 0);
        const side = dx < 0 ? 'sinistra' : 'destra';
        if (bow === 'longbow') {
          setNextAction('alert','↔',stiff ? 'Possibile indicazione di spine dinamico rigido' : 'Possibile indicazione di spine dinamico debole',
            `Le spennate sono più a ${side}. Con rilascio dalle dita è un indizio classico da confermare, non una diagnosi definitiva.`,
            stiff ? [
              'Controlla clearance, allineamento, integrità delle aste e ripetibilità del rilascio.',
              'Verifica lunghezza e selezione dello spine con una tabella del produttore.',
              'Solo se lo schema si ripete, valuta un peso punta leggermente maggiore o un’asta con spine dinamico più debole; modifica una cosa alla volta.'
            ] : [
              'Controlla clearance, allineamento, integrità delle aste e ripetibilità del rilascio.',
              'Verifica lunghezza e selezione dello spine con una tabella del produttore.',
              'Solo se lo schema si ripete, valuta un peso punta leggermente minore o un’asta con spine dinamico più rigido; modifica una cosa alla volta.'
            ]);
        } else if (stiff) {
          setNextAction('alert','←','Possibile spine dinamico rigido',`Le spennate sono più a sinistra. Questa è la lettura classica per un arciere destro; per un mancino, il lato si inverte.`,[
            'Prima controlla clearance, centratura della freccia, bottone e ripetibilità del rilascio.',
            'Verifica che lo spine della freccia sia adatto a lunghezza e potenza reali dell’arco.',
            (['medium','soft','hard','other'].includes(val('testPlunger')) && releaseMode !== 'shelf') ? 'Se il risultato si ripete e il setup lo consente, valuta una piccola riduzione della tensione del bottone oppure un peso punta leggermente maggiore; modifica una sola variabile.' : 'Se non usi un bottone, non applicare una correzione che non esiste: ricontrolla la tabella spine del produttore, lunghezza asta e massa totale anteriore.',
            'Dopo una sola modifica, ripeti il test. Non cambiare insieme bottone e punta.'
          ]);
        } else {
          setNextAction('alert','→','Possibile spine dinamico debole',`Le spennate sono più a destra. Questa è la lettura classica per un arciere destro; per un mancino, il lato si inverte.`,[
            'Prima controlla clearance, centratura della freccia, bottone e ripetibilità del rilascio.',
            'Verifica che lo spine della freccia sia adatto a lunghezza e potenza reali dell’arco.',
            (['medium','soft','hard','other'].includes(val('testPlunger')) && releaseMode !== 'shelf') ? 'Se il risultato si ripete e il setup lo consente, valuta un piccolo aumento della tensione del bottone oppure un peso punta leggermente minore; modifica una sola variabile.' : 'Se non usi un bottone, ricontrolla tabella spine, lunghezza asta e massa totale anteriore; non cercare di regolare un componente assente.',
            'Dopo una sola modifica, ripeti il test. Non cambiare insieme bottone e punta.'
          ]);
        }
        para(`<strong>Orizzontale:</strong> il centro delle spennate è ${fmt(Math.abs(dx))} cm più a ${side} del centro impennato. ${stiff ? 'La lettura classica con rilascio dalle dita suggerisce una possibile freccia dinamicamente rigida.' : 'La lettura classica con rilascio dalle dita suggerisce una possibile freccia dinamicamente debole.'}`, 'diagnosis-alert');
      }
      para('Prima di regolare, assicurati che il test sia ripetibile. Le impostazioni del bottone servono per affinare il tuning: non sostituiscono una scelta corretta dello spine e un controllo della clearance.', 'diagnosis-good');
    }
    if (bow === 'barebow') {
      const crawl = el('crawl').value.trim();
      para(`<strong>Nota per l’arco nudo:</strong> ${crawl ? `crawl annotato: ${safeText(crawl)}.` : 'non hai ancora annotato il crawl.'} Ripeti il confronto con lo stesso crawl, ancoraggio e posizione della mano sulla corda.`, 'diagnosis-alert');
    }
    para('<strong>Regola pratica:</strong> il metodo guida le verifiche; non dimostra da solo la causa. Cambia una variabile alla volta e annota il risultato.', 'diagnosis-good');
    if (qualityCount() <= 3) para('<strong>Affidabilità limitata:</strong> hai confermato poche condizioni del test. Prima di agire, verifica distanza/mira, crawl (se applicabile), componenti equivalenti, massa posteriore e condizioni meteo.', 'diagnosis-alert');
    addContextToDiagnosis();
  }
  function render() {
    renderTarget(); renderList(); renderMetrics();
  }
  function setActive(key) {
    state.active = key;
    const f = key === 'fletched';
    el('selectFletched').classList.toggle('active', f); el('selectFletched').setAttribute('aria-pressed', String(f));
    el('selectBare').classList.toggle('active', !f); el('selectBare').setAttribute('aria-pressed', String(!f));
    el('activeGroupLabel').textContent = `Gruppo selezionato: ${selectedName(key)}`;
  }
  svg.addEventListener('click', event => {
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const matrix = svg.getScreenCTM(); if (!matrix) return;
    const local = point.matrixTransform(matrix.inverse());
    const scale = cmPerPixel();
    const x = (local.x - CENTER) * scale;
    const y = (CENTER - local.y) * scale;
    if (Math.hypot(local.x - CENTER, local.y - CENTER) <= PLOT_RADIUS_PX) addPoint(state.active, x, y);
  });
  el('selectFletched').addEventListener('click', () => setActive('fletched'));
  el('selectBare').addEventListener('click', () => setActive('bare'));
  el('addCoord').addEventListener('click', () => {
    const x = Number(el('coordX').value), y = Number(el('coordY').value);
    if (el('coordX').value.trim() === '' || el('coordY').value.trim() === '') return announce('Inserisci sia X sia Y.');
    addPoint(state.active, x, y);
  });
  el('undoLast').addEventListener('click', () => { const arr = state.impacts[state.active]; if (arr.length) { arr.pop(); render(); } });
  el('clearActive').addEventListener('click', () => { state.impacts[state.active] = []; render(); });
  el('clearAll').addEventListener('click', () => { state.impacts.fletched = []; state.impacts.bare = []; render(); });
  el('loadExample').addEventListener('click', () => {
    state.impacts.fletched = [{id:state.nextId++,x:-1.2,y:0.4},{id:state.nextId++,x:0.7,y:0.8},{id:state.nextId++,x:0.3,y:-0.6},{id:state.nextId++,x:-0.2,y:-0.1}];
    state.impacts.bare = [{id:state.nextId++,x:4.8,y:4.2},{id:state.nextId++,x:5.6,y:3.5},{id:state.nextId++,x:4.1,y:4.9}];
    setActive('bare'); render();
  });
  const technicalInputIds = ['distance','releaseMode','testActualWeight','testRatedWeight','testRiser','testLimbs','testRiserWeight','testStabilizerSetup','testStabilizerMass','testDamperCount','testDamperMass','testNockHeight','testBrace','testPlunger','testSpine','testArrowModel','testArrowGpi','testArrowDiameter','testArrowLength','testPoint','testInsert','testFletching','testClearance'];
  const qualityIds = ['qSameDistance','qSameCrawl','qSameComponents','qMassBalanced','qCalmWeather','qClearance'];
  function val(id) { return el(id)?.value ?? ''; }
  function qualityCount() { return qualityIds.filter(id => el(id)?.checked).length; }
  function renderQuality() {
    const count = qualityCount(), meter = el('qualityMeter'); if (!meter) return;
    meter.className = `quality-meter ${count <= 2 ? 'quality-low' : count <= 4 ? 'quality-caution' : ''}`;
    const titles = count <= 2 ? 'Affidabilità del test: bassa' : count <= 4 ? 'Affidabilità del test: da migliorare' : 'Qualità del test: buona base di confronto';
    const summary = count <= 2 ? 'Conferme insufficienti: considera i numeri come descrittivi e non regolare ancora.' : count <= 4 ? 'Mancano alcune conferme. Prima di intervenire, controlla le voci lasciate vuote e ripeti la prova in condizioni stabili.' : 'Le principali condizioni sono confermate. Servono comunque gruppi ripetibili e una lettura coerente su più serie.';
    meter.replaceChildren(); const strong=document.createElement('strong'); strong.textContent=`${titles} · ${count}/6`; const span=document.createElement('span'); span.textContent=summary; meter.append(strong,span);
  }
  function updateTargetDistanceLabel() {
    const tag = el('targetScaleTag');
    const distance = Number(el('distance')?.value);
    if (tag) { const config = targetConfig(); tag.textContent = Number.isFinite(distance) && distance > 0 ? `Bersaglio ${config.label} · test a ${fmt(distance, 0)} m` : 'Bersaglio regolamentare'; }
  }
  function markAnalysisPending() {
    analysisPending = true;
    const status = el('analysisStatus');
    if (status) { status.textContent = 'Dati tecnici modificati: premi «Aggiorna analisi» per ricalcolare la lettura con questi valori.'; status.classList.add('pending'); }
  }
  function markAnalysisUpdated() {
    analysisPending = false;
    const status = el('analysisStatus');
    if (status) { status.textContent = 'Analisi aggiornata. Gli impatti e i centri dei gruppi continuano ad aggiornarsi automaticamente quando registri o rimuovi una freccia.'; status.classList.remove('pending'); }
  }
  qualityIds.forEach(id => el(id)?.addEventListener('change', () => { renderQuality(); markAnalysisPending(); }));
  technicalInputIds.forEach(id => {
    el(id)?.addEventListener('input', () => { if (id === 'distance') updateTargetDistanceLabel(); markAnalysisPending(); });
    el(id)?.addEventListener('change', () => { if (id === 'distance') updateTargetDistanceLabel(); markAnalysisPending(); });
  });
  let confirmedDistance = Number(el('distance')?.value || 18);
  updateTargetDistanceLabel();
  renderTarget();
  el('distance')?.addEventListener('change', async () => {
    const input = el('distance');
    const nextDistance = Number(input.value);
    if (!Number.isFinite(nextDistance) || nextDistance < 1 || nextDistance > 90) {
      input.value = String(confirmedDistance);
      announce('Inserisci una distanza compresa tra 1 e 90 metri.');
      return;
    }
    if (nextDistance === confirmedDistance) return;
    const hasImpacts = state.impacts.fletched.length || state.impacts.bare.length;
    if (hasImpacts) {
      const accepted = await window.GlassUI.confirm(`Hai cambiato la distanza da ${confirmedDistance} m a ${nextDistance} m. Per evitare di confrontare rosate tirate a distanze diverse, gli impatti attuali verranno azzerati. Vuoi iniziare una nuova sessione?`, {title:'Nuova sessione', ok:'Azzera e continua', destructive:true});
      if (!accepted) {
        input.value = String(confirmedDistance);
        updateTargetDistanceLabel();
        return;
      }
      state.impacts.fletched = [];
      state.impacts.bare = [];
      announce('Nuova sessione avviata. Gli impatti precedenti sono stati azzerati dopo conferma.');
    }
    confirmedDistance = nextDistance;
    updateTargetDistanceLabel();
    renderTarget();
    renderList();
    renderMetrics();
    markAnalysisPending();
  });
  el('recalculateAnalysis')?.addEventListener('click', async () => {
    const input = el('distance');
    const nextDistance = Number(input?.value);
    if (!Number.isFinite(nextDistance) || nextDistance < 1 || nextDistance > 90) {
      if (input) input.value = String(confirmedDistance);
      updateTargetDistanceLabel();
      announce('Inserisci una distanza compresa tra 1 e 90 metri.');
      return;
    }
    // Safety net: if the distance changed but the browser did not dispatch the
    // change handler before recalculation, ask before clearing the previous impacts.
    if (nextDistance !== confirmedDistance) {
      const hasImpacts = state.impacts.fletched.length || state.impacts.bare.length;
      if (hasImpacts) {
        const accepted = await window.GlassUI.confirm(`Hai cambiato la distanza da ${confirmedDistance} m a ${nextDistance} m. Gli impatti della sessione precedente verranno azzerati. Vuoi iniziare una nuova sessione?`, {title:'Nuova sessione', ok:'Azzera e continua', destructive:true});
        if (!accepted) {
          if (input) input.value = String(confirmedDistance);
          updateTargetDistanceLabel();
          return;
        }
        state.impacts.fletched = [];
        state.impacts.bare = [];
        announce('Nuova sessione avviata. Gli impatti precedenti sono stati azzerati dopo conferma.');
      }
      confirmedDistance = nextDistance;
      updateTargetDistanceLabel();
      renderList();
    }
    renderTarget();
    renderMetrics(true);
    markAnalysisUpdated();
  });
  // Report dedicato: ricalcola la lettura e la mostra in una finestra distinta.
  const reportDialog = el('reportDialog');
  function openTestReport() {
    const total = state.impacts.fletched.length + state.impacts.bare.length;
    if (!total) {
      announce('Registra prima almeno un impatto impennato o spennato sul bersaglio.');
      el('target')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    renderMetrics(true);
    const f = getStats('fletched'), b = getStats('bare');
    const dx = f && b ? b.x - f.x : NaN;
    const dy = f && b ? b.y - f.y : NaN;
    const separation = f && b ? Math.hypot(dx, dy) : NaN;
    el('reportSubtitle').textContent = `Test a ${fmt(Number(val('distance')),0)} m · ${el('bowType').selectedOptions[0]?.textContent || 'tipo di arco non specificato'} · ${new Date().toLocaleDateString('it-IT')}`;
    el('reportDx').textContent = Number.isFinite(dx) ? `${dx > 0 ? '+' : ''}${fmt(dx)} cm` : '—';
    el('reportDy').textContent = Number.isFinite(dy) ? `${dy > 0 ? '+' : ''}${fmt(dy)} cm` : '—';
    el('reportDistance').textContent = Number.isFinite(separation) ? `${fmt(separation)} cm` : '—';
    el('reportSample').textContent = `${state.impacts.fletched.length} / ${state.impacts.bare.length}`;
    const targetPreview = el('reportTarget');
    targetPreview.replaceChildren();
    const targetCopy = el('target').cloneNode(true);
    targetCopy.removeAttribute('id');
    targetCopy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    targetCopy.setAttribute('aria-label','Grafico degli impatti impennati e spennati registrati');
    targetPreview.append(targetCopy);
    const quality = el('qualityMeter')?.cloneNode(true);
    const qualityHost = el('reportQuality'); qualityHost.replaceChildren();
    if (quality) { quality.removeAttribute('id'); quality.querySelectorAll('[id]').forEach(node => node.removeAttribute('id')); qualityHost.append(quality); }
    // La conclusione personalizzata deve essere il messaggio principale anche nel report a video.
    const conclusion = personalizedConclusion();
    const recommendation = el('reportActionTitle')?.closest('.report-recommendation');
    if (recommendation) {
      recommendation.classList.remove('result-good','result-caution','result-neutral');
      recommendation.classList.add(conclusion.kind === 'good' ? 'result-good' : conclusion.kind === 'caution' ? 'result-caution' : 'result-neutral');
    }
    el('reportActionTitle').textContent = conclusion.title;
    el('reportActionSummary').textContent = conclusion.summary;
    el('reportActionSteps').replaceChildren(...conclusion.steps.map(step => { const li=document.createElement('li'); li.textContent=step; return li; }));
    const actionKicker = recommendation?.querySelector('.card-kicker');
    if (actionKicker) actionKicker.textContent = conclusion.kind === 'good' ? 'ESITO POSITIVO' : conclusion.kind === 'caution' ? 'ESITO DA CONFERMARE' : 'ESITO DELLA PROVA';
    const observations = el('reportObservations');
    observations.replaceChildren();
    const diagnosisTitle = document.createElement('h3'); diagnosisTitle.textContent = el('diagnosisTitle').textContent; observations.append(diagnosisTitle);
    const diagnosisCopy = el('diagnosisBody').cloneNode(true);
    diagnosisCopy.removeAttribute('id'); diagnosisCopy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    observations.append(diagnosisCopy);
    if (typeof reportDialog.showModal === 'function') reportDialog.showModal();
    else { reportDialog.setAttribute('open',''); reportDialog.scrollIntoView({behavior:'smooth',block:'start'}); }
  }
  el('recalculateAnalysis')?.addEventListener('click', openTestReport);
  function closeTestReport() {
    if (reportDialog?.open && typeof reportDialog.close === 'function') reportDialog.close();
    else reportDialog?.removeAttribute('open');
  }
  el('closeReport')?.addEventListener('click', closeTestReport);
  el('closeReportBottom')?.addEventListener('click', closeTestReport);
  reportDialog?.addEventListener('click', event => { if (event.target === reportDialog) closeTestReport(); });
  el('printReport')?.addEventListener('click', () => { el('exportPdf')?.click(); });

  function addContextToDiagnosis() {
    const body = el('diagnosisBody');
    const fields = [
      ['potenza effettiva', val('testActualWeight') ? `${val('testActualWeight')} lb` : 'non inserita'],
      ['potenza nominale', val('testRatedWeight') ? `${val('testRatedWeight')} lb` : 'non inserita'],
      ['riser/flettenti', [val('testRiser'),val('testLimbs')].filter(Boolean).join(' · ') || 'non specificati'],
      ['pesi aggiuntivi sul riser', val('testRiserWeight') !== '' ? `${val('testRiserWeight')} g` : 'non inseriti'],
      ['stabilizzatori', ({unknown:'non indicati',barebow:'peso sul riser · arco nudo',olympic:'centrale / laterali · olimpico',compound:'stabilizzazione compound',traditional:'tradizionale / personalizzata',none:'nessuno'}[val('testStabilizerSetup')] || 'non indicati')],
      ['massa stabilizzatori', val('testStabilizerMass') !== '' ? `${val('testStabilizerMass')} g` : 'non inserita'],
      ['smorzatori', val('testDamperCount') !== '' ? `${val('testDamperCount')} unità` : 'non indicati'],
      ['massa smorzatori', val('testDamperMass') !== '' ? `${val('testDamperMass')} g` : 'non inserita'],
      ['punto d’incocco', val('testNockHeight') ? `${val('testNockHeight')} mm` : 'non misurato'],
      ['asta/spine', [val('testArrowModel'),val('testSpine') ? `spine ${val('testSpine')}` : '',val('testArrowGpi') ? `${val('testArrowGpi')} GPI` : '',val('testArrowDiameter') ? `OD ${val('testArrowDiameter')} mm` : ''].filter(Boolean).join(' · ') || 'non specificati'],
      ['lunghezza asta', val('testArrowLength') ? `${val('testArrowLength')}″` : 'non inserita'],
      ['massa anteriore', (val('testPoint') || val('testInsert')) ? `${val('testPoint') || '0'} gr punta + ${val('testInsert') || '0'} gr inserto` : 'non inserita'],
      ['bottone/clearance', `${({unknown:'non indicato',none:'assente',medium:'presente · impostazione base',soft:'molla relativamente morbida',hard:'molla relativamente dura',other:'dato non noto'}[val('testPlunger')] || 'non indicato')} · clearance ${({unknown:'non verificata',checked:'controllata',suspect:'possibile interferenza'}[val('testClearance')] || 'non verificata')}`]
    ];
    const wrap=document.createElement('div'); wrap.className='setup-context-summary';
    const title=document.createElement('h4'); title.textContent='Dati dell’attrezzatura considerati'; wrap.append(title);
    const grid=document.createElement('div'); grid.className='setup-context-grid';
    fields.forEach(([label,value])=>{const item=document.createElement('div');item.className='setup-context-item';const b=document.createElement('strong');b.textContent=label;const s=document.createElement('span');s.textContent=value;item.append(b,s);grid.append(item);});
    const caution=document.createElement('p');caution.className='setup-context-caution';caution.textContent='I campi mancanti non vengono dedotti. La potenza nominale non sostituisce il peso misurato all’allungo; il numero spine va interpretato sulla scheda del modello esatto.';wrap.append(grid,caution);
    const extra=document.createElement('p'); extra.className='setup-context-caution';
    const front=(Number(val('testPoint'))||0)+(Number(val('testInsert'))||0);
    const frontKnown=val('testPoint')!=='' || val('testInsert')!=='';
    const notes=[];
    if(frontKnown) notes.push(`Massa anteriore dichiarata: ${fmt(front,0)} grani complessivi (punta + inserto). A parità degli altri parametri, aumentarla tende in genere a rendere lo spine dinamico più debole; l’entità dipende da asta, lunghezza e arco.`);
    if(!val('testActualWeight') && val('testRatedWeight')) notes.push('Hai inserito solo la potenza nominale: non usarla come se fosse la potenza effettiva all’allungo. Misura il setup reale con una bilancia per arco.');
    if(val('testRiserWeight')!=='' || val('testStabilizerMass')!=='' || val('testDamperMass')!=='' || (val('testStabilizerSetup') && val('testStabilizerSetup')!=='unknown')) notes.push('Pesi sul riser, stabilizzatori e smorzatori sono registrati come contesto: possono influire su equilibrio, vibrazioni e ripetibilità del gesto, ma non indicano da soli lo spine dinamico né prescrivono una correzione.');
    if(!val('testSpine') || !val('testArrowLength') || !frontKnown) notes.push('Mancano dati chiave per interpretare lo spine dinamico (spine, lunghezza o massa anteriore). Non modificare il bottone sulla base del solo lato d’impatto.');
    if(!el('qMassBalanced')?.checked) notes.push('La massa posteriore della spennata non risulta compensata/confermata: la differenza di massa rispetto alla freccia impennata può influenzare il confronto.');
    extra.textContent=notes.join(' ');
    if(notes.length){wrap.append(extra);}
    body.append(wrap);
  }
  function renderLiveConclusion() {
    const box=el('liveConclusion');
    if(!box) return;
    const c=personalizedConclusion();
    box.className=`live-conclusion conclusion-${c.kind}`;
    el('liveConclusionIcon').textContent=c.kind==='good'?'✓':c.kind==='caution'?'!':'↗';
    el('liveConclusionTitle').textContent=c.title;
    el('liveConclusionSummary').textContent=c.summary;
    const list=el('liveConclusionSteps'); list.replaceChildren();
    c.steps.forEach(step=>{const li=document.createElement('li');li.textContent=step;list.append(li);});
  }
  function personalizedConclusion() {
    const f = getStats('fletched'), b = getStats('bare');
    if (!f || !b) return {kind:'caution', title:'Test incompleto: servono entrambi i gruppi', summary:'Registra almeno un impatto impennato e uno spennato per confrontare i centri.', steps:['Completa entrambe le serie prima di valutare l’assetto.']};
    const dx=b.x-f.x, dy=b.y-f.y, d=Math.hypot(dx,dy);
    const nf=state.impacts.fletched.length, nb=state.impacts.bare.length, q=qualityCount();
    const enough=nf>=5 && nb>=5;
    const valid=el('qSameDistance')?.checked && el('qSameComponents')?.checked && el('qCalmWeather')?.checked && (el('bowType')?.value!=='barebow' || el('qSameCrawl')?.checked);
    const clock = (()=>{let deg=(Math.atan2(dx,dy)*180/Math.PI+360)%360; const names=['12','1','2','3','4','5','6','7','8','9','10','11']; return names[Math.round(deg/30)%12];})();
    if (d<=1.5) {
      const confirmed = enough && valid && q>=4;
      return {kind:'good',title:confirmed?'OTTIMO RISULTATO — spennata centrata':'SPENNATA POSITIVA — nessuna correzione suggerita',summary:`I centri delle spennate e delle impennate distano ${fmt(d)} cm: sono molto vicini. ${confirmed ? `Il campione (${nf} impennate, ${nb} spennate) e le conferme (${q}/6) offrono una buona base per questa sessione.` : `Il dato è favorevole, ma il campione (${nf} impennate, ${nb} spennate) o le conferme (${q}/6) sono ancora limitati: consideralo un risultato promettente da confermare.`}`,steps:['Non modificare bottone, punto d’incocco o peso punta sulla base di questo risultato.','Conserva questa configurazione come riferimento.','Ripeti una o due volée alternate nelle stesse condizioni; se i centri restano vicini, considera il test confermato.']};
    }
    const direction = ({'12':'in alto','1':'in alto a destra','2':'in alto a destra','3':'a destra','4':'in basso a destra','5':'in basso a destra','6':'in basso','7':'in basso a sinistra','8':'in basso a sinistra','9':'a sinistra','10':'in alto a sinistra','11':'in alto a sinistra'})[clock];
    if (!valid || !enough || q<4) return {kind:'caution',title:`Spennate spostate verso ore ${clock} (${direction}) — confermare il test`,summary:`Il centro delle spennate è a ${fmt(d)} cm dal centro delle impennate, ${direction} (X ${fmt(dx)} cm, Y ${fmt(dy)} cm). Con campione/conferme insufficienti non è prudente prescrivere una regolazione.`,steps:['Ripeti il test con almeno 5 frecce per gruppo e condizioni coerenti.','Controlla prima tecnica, crawl, clearance e integrità delle aste.','Se lo spostamento si ripete, interpreta verticale e orizzontale in base al tipo di arco e rilascio prima di cambiare un componente.']};
    if (Math.abs(dy)>1.5) return {kind:'caution',title:`Spennate ${dy>0?'alte':'basse'} — priorità al controllo verticale`,summary:`Il centro spennato è spostato ${direction}, con componente verticale di ${fmt(Math.abs(dy))} cm. Il risultato suggerisce di verificare prima punto d’incocco e ripetibilità, non di correggere subito il bottone.`,steps:['Verifica con una squadretta la quota del punto d’incocco e conferma crawl e ancoraggio.','Ripeti la prova prima di modificare il punto d’incocco; se lo schema persiste, cambia solo una variabile di poco.','Dopo aver stabilizzato il verticale, rivaluta l’eventuale scostamento orizzontale.']};
    const hand=el('hand')?.value||'right', stiff=(hand==='right'&&dx<0)||(hand==='left'&&dx>0);
    return {kind:'caution',title:`Spennate ${direction} (ore ${clock}) — verifica orizzontale`,summary:`I centri sono separati di ${fmt(d)} cm, soprattutto in orizzontale. Per rilascio con le dita può essere un indizio sul comportamento dinamico della freccia, ma non identifica da solo la causa.`,steps:['Verifica clearance, centratura, integrità delle aste e ripetibilità del rilascio.','Controlla spine, lunghezza asta, potenza effettiva e massa anteriore rispetto alla tabella del produttore.','Solo se il risultato si ripete, valuta una piccola regolazione compatibile con il setup; una variabile alla volta.']};
  }
  el('exportPdf')?.addEventListener('click', () => {
    const f = state.impacts.fletched, b = state.impacts.bare;
    if (!f.length && !b.length) return announce('Registra almeno un impatto prima di esportare il rapporto.');
    const stat = (key) => { const st=getStats(key); return st ? `Centro X ${fmt(st.x)} cm · Y ${fmt(st.y)} cm · dispersione RMS ${fmt(st.rms)} cm · ${st.n} frecce` : 'Nessun impatto registrato'; };
    const rows = (items, name) => items.map((p,i)=>`<tr><td>${name}</td><td>${i+1}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td><td>${impactScore(p.x,p.y)}</td></tr>`).join('');
    const targetSvg = el('target')?.outerHTML || '';
    const report = window.open('', '_blank');
    if (!report) return announce('Il browser ha bloccato la finestra del rapporto. Consenti i popup per esportare in PDF.');
    const esc = (v) => safeText(v ?? '—');
    report.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Archery Lab — Rapporto Spennata</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:11px/1.5 Arial,sans-serif;color:#17283e;margin:0;background:#fff}h1{font-size:27px;letter-spacing:-.7px;margin:0;color:#123b5c}h2{font-size:15px;color:#174d70;margin:19px 0 9px;padding-left:9px;border-left:3px solid #e8a34c}.sub{color:#60758a;margin:5px 0 14px;font-size:11px}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #e8a34c;padding:0 0 13px}.pill{background:#e5f2f7;border:1px solid #d5e6ed;border-radius:10px;padding:9px 12px;font-weight:bold;line-height:1.8}.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}.box{border:1px solid #d7e3eb;border-radius:10px;padding:11px;background:linear-gradient(135deg,#f8fbfd,#eef5f8)}.box strong{display:block;font-size:12px;margin-bottom:5px;color:#174d70}.target{width:360px;max-width:100%;display:block;margin:10px auto 14px;padding:12px;background:radial-gradient(circle at 50% 45%,#fff 0,#f3f7fa 72%);border:1px solid #dce6ee;border-radius:16px;box-shadow:0 8px 22px rgba(18,52,78,.08)}.target svg{width:100%;height:auto;max-height:360px;display:block;overflow:visible}.target svg *{vector-effect:non-scaling-stroke}.target .shot-dot.fletched{fill:#df963f;stroke:#fff;stroke-width:2}.target .shot-dot.bare{fill:#38a17c;stroke:#fff;stroke-width:2}.target .shot-label{font-size:8px;fill:#fff;font-weight:900;text-anchor:middle;dominant-baseline:central}.target .center-cross.fletched{stroke:#a76820;stroke-width:2.5;fill:none}.target .center-cross.bare{stroke:#1d7656;stroke-width:2.5;fill:none}.target .center-badge{font-size:7px;font-weight:900;text-anchor:middle}.legend{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:4px 0 8px;color:#536b80;font-size:10px;font-weight:bold}.legend span{display:inline-flex;align-items:center;gap:6px}.legend i{display:inline-block;width:10px;height:10px;border-radius:50%}.legend .amber{background:#df963f}.legend .mint{background:#38a17c}.legend .cross{width:12px;height:12px;border-radius:0;background:linear-gradient(90deg,transparent 44%,#49667d 44%,#49667d 56%,transparent 56%),linear-gradient(0deg,transparent 44%,#49667d 44%,#49667d 56%,transparent 56%}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.metric{border:1px solid #dce6ed;border-radius:9px;background:linear-gradient(145deg,#f0f7fa,#e7f0f5);padding:10px}.metric b{display:block;font-size:16px;color:#173f5f;margin-top:3px}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px}th{background:#173f5f;color:white;text-align:left}td,th{padding:6px 7px;border:1px solid #d8e2e9}tr:nth-child(even) td{background:#f3f7fa}.note{font-size:9px;color:#60758a;margin-top:14px;border-top:1px solid #dce6ed;padding-top:9px}.actions{margin:12px 0}.actions button{border:0;border-radius:8px;background:#173f5f;color:white;padding:10px 14px;font-weight:bold}.conclusion{border:2px solid #cbdde5;border-left:7px solid #d9a044;border-radius:12px;padding:14px 17px;margin:15px 0;background:#f6fafc;break-inside:avoid}.conclusion.good{border-color:#3d9b78;background:#eff9f4}.conclusion .eyebrow{font-size:9px;letter-spacing:1.5px;font-weight:800;color:#60758a}.conclusion h2{border:0;padding:0;margin:4px 0 7px;font-size:18px;color:#173f5f}.conclusion.good h2{color:#176b4d}.conclusion p{margin:5px 0 9px}.conclusion h3{font-size:12px;margin:8px 0 4px;color:#174d70}.conclusion ol{margin:4px 0 0;padding-left:20px}.conclusion li{margin:3px 0}.@media print{.actions{display:none}.target{break-inside:avoid;box-shadow:none}h2{break-after:avoid}.box,.metric{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body><div class="top"><div><h1>Archery Lab</h1><div class="sub">Rapporto sessione · Spennata Lab</div></div><div class="pill">Distanza: ${esc(el('distance').value)} m<br>Data: ${new Date().toLocaleDateString('it-IT')}</div></div>
      <h2>Configurazione e qualità del test</h2><div class="grid"><div class="box"><strong>Arco e tecnica</strong>${esc(el('bowType').selectedOptions[0]?.textContent)} · ${esc(el('hand').selectedOptions[0]?.textContent)} · rilascio: ${esc(val('releaseMode'))} · crawl: ${esc(val('crawl'))}</div><div class="box"><strong>Frecce e setup</strong>Modello: ${esc(val('testArrowModel'))} · spine: ${esc(val('testSpine'))} · potenza effettiva: ${esc(val('testActualWeight'))} lb · punta: ${esc(val('testPoint'))} gr</div></div>
      ${(()=>{const c=personalizedConclusion();return `<section class="conclusion ${c.kind}"><div class="eyebrow">ESITO DELLA PROVA</div><h2>${esc(c.title)}</h2><p>${esc(c.summary)}</p><h3>Cosa fare adesso</h3><ol>${c.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section>`})()}
      <h2>Risultati del confronto</h2><div class="metrics"><div class="metric">Scostamento X<b>${esc(el('deltaX').textContent)}</b></div><div class="metric">Scostamento Y<b>${esc(el('deltaY').textContent)}</b></div><div class="metric">Distanza centri<b>${esc(el('deltaTotal').textContent)}</b></div><div class="metric">Campione<b>${esc(el('sampleStatus').textContent)}</b></div></div><div class="grid"><div class="box"><strong>Centro impennate</strong>${esc(stat('fletched'))}</div><div class="box"><strong>Centro spennate</strong>${esc(stat('bare'))}</div></div>
      <h2>Riepilogo punteggi stimati</h2><div class="metrics"><div class="metric">Impennate<b>${state.impacts.fletched.reduce((sum,p)=>sum+impactScore(p.x,p.y),0)} pt</b></div><div class="metric">Spennate<b>${state.impacts.bare.reduce((sum,p)=>sum+impactScore(p.x,p.y),0)} pt</b></div><div class="metric">Totale sessione<b>${[...state.impacts.fletched,...state.impacts.bare].reduce((sum,p)=>sum+impactScore(p.x,p.y),0)} pt</b></div><div class="metric">Faccia<b>${esc(targetConfig().diameter)} cm</b></div></div><h2>Bersaglio e impatti</h2><div class="legend"><span><i class="dot amber"></i> Impennate</span><span><i class="dot mint"></i> Spennate</span><span><i class="cross"></i> Centro medio del gruppo</span></div><div class="target">${targetSvg}</div><h2>Registro impatti</h2><table><thead><tr><th>Gruppo</th><th>Freccia</th><th>X (cm)</th><th>Y (cm)</th><th>Punti stimati</th></tr></thead><tbody>${rows(f,'Impennata')}${rows(b,'Spennata')}</tbody></table><p class="note">Documento generato localmente da Archery Lab. Il punteggio è una stima basata sul bersaglio configurato e non sostituisce la valutazione ufficiale. Le coordinate sono espresse in centimetri; Y positivo indica l'alto. Per creare un PDF, scegli “Salva come PDF” nella finestra di stampa del browser.</p><div class="actions"><button onclick="window.print()">Stampa / Salva come PDF</button><p>Se la finestra di stampa non si apre automaticamente, premi il pulsante qui sopra. Nella finestra di stampa scegli “Salva come PDF”.</p></div></body></html>`);
    report.document.close();
    report.focus();
  });

  el('exportCsv').addEventListener('click', () => {
    const rows = [['gruppo','id_freccia','x_cm_destra_positiva','y_cm_alto_positivo','distanza_m','tipo_arco','mano','crawl','rilascio','potenza_effettiva_lb','potenza_nominale_lb','riser_modello','flettenti_modello','pesi_riser_g','tipo_stabilizzazione','massa_stabilizzatori_g','numero_smorzatori','massa_smorzatori_g','punto_incocco_mm','brace_height','bottone','modello_asta','spine','GPI','diametro_esterno_mm','lunghezza_asta_pollici','punta_grani','inserto_grani','punteggio_stimato','impennaggio','clearance','qualita_test_conferme']];
    ['fletched','bare'].forEach(key => state.impacts[key].forEach((p,i) => rows.push([key === 'fletched' ? 'impennata' : 'spennata', i+1, p.x, p.y, el('distance').value, el('bowType').value, el('hand').value, el('crawl').value, val('releaseMode'), val('testActualWeight'), val('testRatedWeight'), val('testRiser'), val('testLimbs'), val('testRiserWeight'), val('testStabilizerSetup'), val('testStabilizerMass'), val('testDamperCount'), val('testDamperMass'), val('testNockHeight'), val('testBrace'), val('testPlunger'), val('testArrowModel'), val('testSpine'), val('testArrowGpi'), val('testArrowDiameter'), val('testArrowLength'), val('testPoint'), val('testInsert'), impactScore(p.x,p.y), val('testFletching'), val('testClearance'), qualityCount() + '/6'])));
    if (rows.length === 1) return announce('Non ci sono impatti da esportare.');
    const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
    const a = document.createElement('a'); a.href = url; a.download = 'archery-lab-spennata.csv'; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  ['bowType','hand','crawl','releaseMode','testPlunger','testClearance','testStabilizerSetup'].forEach(id => el(id)?.addEventListener('change', markAnalysisPending));
  function importSavedEquipmentProfile() {
    const status = el('profileLinkStatus');
    try {
      const raw = localStorage.getItem('archeryLab.equipmentProfile.v1');
      if (!raw) {
        if (status) status.textContent = 'Nessun profilo salvato trovato. Puoi crearne uno nel Calcolatore; qui si confronteranno i gruppi della sessione corrente.';
        return;
      }
      const profile = JSON.parse(raw);
      const typeMap = {barebow:'barebow', olympic:'recurve', compound:'compound', longbow:'longbow', traditional:'longbow', horsebow:'longbow', other:'recurve'};
      if (profile.bowType && typeMap[profile.bowType] && Array.from(el('bowType').options).some(o=>o.value===typeMap[profile.bowType])) el('bowType').value=typeMap[profile.bowType];
      if (profile.bowHand && ['right','left'].includes(profile.bowHand)) el('hand').value=profile.bowHand;
      const model = profile.bowModel ? String(profile.bowModel).trim() : '';
      const shaft = profile.shaftModel ? String(profile.shaftModel).trim() : '';
      const spine = profile.spineValue ? String(profile.spineValue).trim() : '';
      const put=(id,value)=>{if(el(id) && value!==undefined && value!==null && String(value)!=='') el(id).value=String(value);};
      put('testActualWeight',profile.actualDrawWeight);
      put('testRatedWeight', profile.bowType==='compound' ? profile.traditionalRatedWeight : (profile.limbRatedWeight || profile.traditionalRatedWeight));
      put('testRiser', [model,profile.riserLength ? `${profile.riserLength}″` : ''].filter(Boolean).join(' '));
      put('testLimbs', [profile.limbModel,profile.limbLength ? `lunghezza ${profile.limbLength}` : ''].filter(Boolean).join(' · '));
      put('testBrace', profile.braceHeight ? `${profile.braceHeight}″` : '');
      // Bring stabilization/accessory masses over from the saved Calculator profile.
      put('testRiserWeight', profile.riserAddedWeight);
      put('testStabilizerMass', profile.stabilizerWeight);
      put('testDamperCount', profile.damperCount);
      put('testDamperMass', profile.damperWeight);
      const stabilizerMap = {
        'none':'none',
        'barebow-weight':'barebow',
        'olympic-center':'olympic',
        'olympic-full':'olympic',
        'compound-full':'compound',
        'traditional':'traditional',
        'custom':'unknown'
      };
      if (profile.stabilizerSetup && stabilizerMap[profile.stabilizerSetup]) put('testStabilizerSetup', stabilizerMap[profile.stabilizerSetup]);
      put('testSpine',spine); put('testArrowModel',shaft); put('testArrowLength',profile.arrowLength);
      put('testPoint',profile.pointWeight); put('testInsert',profile.insertWeight);
      put('testArrowGpi',profile.gpi);
      put('testArrowDiameter',profile.shaftDiameter ? (Number(profile.shaftDiameter)*25.4).toFixed(2) : '');
      if(profile.releaseType) put('releaseMode',profile.releaseType==='mechanical'?'mechanical':'fingers');
      if(profile.fletchType) put('testFletching', `${profile.fletchType}${profile.vaneCount ? ` · ${profile.vaneCount} pezzi` : ''}${profile.fletchingSetWeight ? ` · ${profile.fletchingSetWeight} ${profile.weightInputUnit === 'g' ? 'g' : 'gr'} impennaggio + Wrap (3 pezzi)` : ''}`);
      if (status) status.textContent = `Profilo precompilato dal Calcolatore${model ? `: ${model}` : ''}${shaft ? ` · freccia ${shaft}` : ''}${spine ? ` · spine ${spine}` : ''}. Verifica in particolare diametro ESTERNO, lunghezza effettiva, punto d’incocco e condizioni di prova. Se hai cambiato i dati tecnici, premi «Aggiorna analisi» per applicarli alla lettura.`;
    } catch (err) {
      if (status) status.textContent = 'Non è stato possibile leggere il profilo salvato. Puoi selezionare i dati manualmente.';
    }
  }
  // Manufacturer catalog. Only variant-specific published fields are auto-filled; unknowns remain manual.
  let equipmentCatalog = null;
  async function loadEquipmentCatalog() {
    const status = el('catalogStatus');
    try {
      const response = await fetch('catalogo-attrezzatura.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('catalogo non disponibile');
      equipmentCatalog = await response.json();
      const arrowSel=el('catalogArrowModel'), riserSel=el('catalogRiser'), dl=el('arrowCatalogList');
      equipmentCatalog.arrows.forEach(a=>{if(a.id==='custom') return; const o=document.createElement('option');o.value=a.id;o.textContent=`${a.brand} · ${a.model}`;arrowSel.append(o); if(dl){const d=document.createElement('option');d.value=`${a.brand} ${a.model}`;dl.append(d);}});
      equipmentCatalog.risers.forEach(r=>{if(r.id==='custom-riser') return; const o=document.createElement('option');o.value=r.id;o.textContent=`${r.brand} · ${r.model}`;riserSel.append(o);});
      const sourceBox=el('catalogSourceLinks');
      if(sourceBox && Array.isArray(equipmentCatalog.sources)){sourceBox.replaceChildren();equipmentCatalog.sources.forEach(s=>{const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${s.name} ↗`;sourceBox.append(a);});}
      status.textContent='Catalogo caricato: sono presenti soltanto alcuni modelli e varianti documentati. I dati automatici si applicano alla combinazione modello + spine selezionata.';
    } catch(err) {
      if(status) status.textContent='Catalogo non caricato. Puoi compilare i dati manualmente; controlla che catalogo-attrezzatura.json sia presente nella cartella spennata. Non verranno inventate specifiche.';
    }
  }
  function updateArrowSpineOptions() {
    const modelId=el('catalogArrowModel').value, spineSel=el('catalogArrowSpine'); spineSel.replaceChildren();
    const model=equipmentCatalog?.arrows?.find(a=>a.id===modelId);
    if(!model || !model.variants?.length){spineSel.disabled=true;spineSel.add(new Option('Nessuna variante in catalogo',''));return;}
    spineSel.disabled=false;spineSel.add(new Option('Seleziona spine…',''));
    model.variants.forEach(v=>spineSel.add(new Option(v.spine,v.spine)));
  }
  el('catalogArrowModel')?.addEventListener('change', updateArrowSpineOptions);
  el('applyArrowCatalog')?.addEventListener('click',()=>{
    const model=equipmentCatalog?.arrows?.find(a=>a.id===el('catalogArrowModel').value);
    const v=model?.variants?.find(v=>v.spine===el('catalogArrowSpine').value);
    const status=el('catalogStatus');
    if(!model){status.textContent='Seleziona un modello dal catalogo.';return;}
    if(!model.variants?.length){
      el('testArrowModel').value=`${model.brand} ${model.model}`;
      status.textContent=`${model.brand} ${model.model}: il modello è elencato ma non abbiamo ancora caricato varianti numeriche verificate. Inserisci spine, GPI, diametro esterno e lunghezza dalla scheda del produttore. ${model.source ? 'Fonte: '+model.source : ''}`;
      renderMetrics(); return;
    }
    if(!v){status.textContent='Seleziona una spine specifica prima di caricare i valori numerici.';return;}
    el('testArrowModel').value=`${model.brand} ${model.model}`; el('testSpine').value=v.spine;
    const gpi=Number(v.gpi); if(Number.isFinite(gpi)) { if(el('testArrowGpi')) el('testArrowGpi').value=String(gpi); }
    const outerMm=Number(v.outerDiameterMm), outerIn=Number(v.outerDiameterIn);
    if(el('testArrowDiameter')) el('testArrowDiameter').value=outerMm?String(outerMm):outerIn?String((outerIn*25.4).toFixed(2)):'';
    status.textContent=`Dati caricati da scheda produttore: ${model.brand} ${model.model}, spine ${v.spine}${gpi?`, ${gpi} GPI`:''}${outerMm?`, diametro esterno ${outerMm} mm`:outerIn?`, diametro esterno ${outerIn}″`:''}. Lunghezza asta e componenti non sono stati dedotti: inserisci i valori reali.`;
    renderMetrics();
  });
  el('applyRiserCatalog')?.addEventListener('click',()=>{
    const model=equipmentCatalog?.risers?.find(r=>r.id===el('catalogRiser').value); const status=el('catalogStatus');
    if(!model){status.textContent='Seleziona un riser dal catalogo.';return;}
    el('testRiser').value=`${model.brand} ${model.model}`;
    const typeMap={barebow:'barebow',olympic:'recurve',compound:'compound',longbow:'longbow',traditional:'longbow',other:'recurve'};
    if(model.bowType && typeMap[model.bowType] && Array.from(el('bowType').options).some(o=>o.value===typeMap[model.bowType])) el('bowType').value=typeMap[model.bowType];
    if(model.overallLengthsIn){el('testLimbs').value=`Flettenti corti/medi/lunghi: ${model.overallLengthsIn.short}/${model.overallLengthsIn.medium}/${model.overallLengthsIn.long}″`}
    status.textContent=`${model.brand} ${model.model}: ${model.lengthIn ? `riser ${model.lengthIn}″` : 'lunghezza da verificare'}${model.fitting ? ` · attacco ${model.fitting}`:''}${model.massG ? ` · massa dichiarata ${model.massG} g`:''}. ${model.note || ''} ${model.source ? 'Fonte: '+model.source : ''} Controlla sempre versione e manuale.`;
    renderMetrics();
  });
  loadEquipmentCatalog();
  importSavedEquipmentProfile();
  ['bowType','hand'].forEach(id=>el(id).addEventListener('change',()=>{const status=el('profileLinkStatus');if(status)status.textContent='Hai modificato tipo di arco o mano per questa sessione. Assicurati che corrispondano al setup reale.';}));
  const rosataButton = el('analyzeRosata');
  if (rosataButton) rosataButton.addEventListener('click', () => {
    const points = state.impacts.fletched.map(p => ({ x: Number(p.x), y: Number(p.y) }));
    if (!points.length) { announce('Inserisci almeno un impatto impennato prima di avviare Analisi della Rosata.'); return; }
    try {
      sessionStorage.setItem('archeryLabRosataImport', JSON.stringify({ points, distance: Number(el('distance')?.value || 18), importedAt: new Date().toISOString() }));
      window.location.href = '../rosata/index.html';
    } catch (err) { announce('Non è stato possibile trasferire gli impatti. Apri Analisi della Rosata e inseriscili manualmente.'); }
  });
  renderQuality(); render(); setActive('fletched');
})();
