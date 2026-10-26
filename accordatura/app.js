(() => {
  'use strict';
  const bow = document.getElementById('tuningBow');
  const stage = document.getElementById('tuningStage');
  const guidance = document.getElementById('tuningGuidance');
  const horizontal = document.getElementById('horizontalGuidance');
  const scope = document.getElementById('tuningChecks');
  const boxes = [...scope.querySelectorAll('input[type="checkbox"]')];
  const map = {
    baseline: 'Prima stabilisci una base ripetibile: sicurezza, allineamento, attrezzatura integra e dati registrati.',
    vertical: 'Confronta i centri dei gruppi e misura il punto d’incocco. La posizione verticale è un indizio: verifica anche rilascio e clearance.',
    horizontal: 'Solo dopo un verticale ragionevole, interpreta lo scostamento orizzontale insieme a spine, centratura, bottone, mano dominante e qualità del rilascio.',
    final: 'Ripeti il test dopo la modifica, annota i valori e cambia un solo parametro per volta.'
  };
  function update() {
    const b = bow.value;
    guidance.textContent = map[stage.value];
    horizontal.textContent = b === 'compound'
      ? 'Compound con sgancio meccanico: non applicare automaticamente la regola classica rigido/debole per rilascio dalle dita. Controlla sincronizzazione, cam, rest, clearance e la procedura del produttore.'
      : b === 'other'
        ? 'Sistema non specificato: descrivi prima tipo di rilascio, geometria e componenti. Non interpretare la direzione orizzontale usando regole non confermate.'
        : 'Per questo setup a dita, lo scostamento orizzontale è un indizio da leggere insieme a spine dinamico, mano, bottone, centratura, grip, rilascio e clearance.';
    try { localStorage.setItem('archeryLab.tuning.selects', JSON.stringify({ bow: b, stage: stage.value })); } catch (_) {}
  }
  function progress() {
    const done = boxes.filter(b => b.checked).length;
    document.getElementById('tuningProgressLabel').textContent = `${done} di ${boxes.length} controlli`;
    document.getElementById('tuningProgressBar').style.width = `${(done / boxes.length) * 100}%`;
  }
  try {
    const saved = JSON.parse(localStorage.getItem('archeryLab.tuning.selects') || 'null');
    if (saved) { if (saved.bow) bow.value = saved.bow; if (saved.stage) stage.value = saved.stage; }
  } catch (_) {}
  bow.addEventListener('change', update);
  stage.addEventListener('change', update);
  scope.addEventListener('change', progress);
  document.getElementById('resetTuningChecks').addEventListener('click', async () => {
    if (!boxes.some(b => b.checked)) return;
    const ok = await window.GlassUI.confirm('Tutte le spunte delle cinque fasi verranno rimosse.', { title: 'Azzerare le checklist?', ok: 'Azzera', destructive: true });
    if (!ok) return;
    scope.dispatchEvent(new Event('al:reset'));
    progress();
  });
  update();
  progress();
})();
