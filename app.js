'use strict';
(() => {
  const STORAGE_KEY = 'meguru.choices.v1';
  const defaults = ['ラーメン', 'お寿司', 'カレー', 'パスタ', 'ハンバーガー'];
  const colors = ['#4389ed', '#7464d4', '#d57993', '#d9a351', '#42a9a3', '#6281b9', '#ab71c3', '#b98564'];
  const $ = id => document.getElementById(id);
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  let choices = defaults.slice();
  let spinning = false;
  let rotation = 0;
  let storageAvailable = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length <= 50 && parsed.every(v => typeof v === 'string' && v.length <= 40 && v.trim())) choices = parsed;
    }
  } catch { storageAvailable = false; }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choices)); storageAvailable = true; }
    catch { storageAvailable = false; }
    $('saved').textContent = storageAvailable ? '✓ 自動保存' : '保存できません';
    if (!storageAvailable) $('message').textContent = 'ブラウザの保存領域が使えません。この画面では引き続き利用できます。';
  }
  function resetResult() {
    $('result').textContent = choices.length ? '運命のひとまわし' : '候補を追加してください';
    $('result-label').textContent = '今日の選択は？';
    document.querySelector('.result').classList.remove('winner');
  }
  function draw() {
    const size = canvas.width;
    const center = size / 2;
    ctx.clearRect(0, 0, size, size);
    if (!choices.length) {
      ctx.fillStyle = '#1c2c43'; ctx.beginPath(); ctx.arc(center, center, center, 0, Math.PI * 2); ctx.fill();
    }
    choices.forEach((label, index) => {
      const arc = Math.PI * 2 / choices.length;
      const start = -Math.PI / 2 + index * arc;
      ctx.beginPath(); ctx.moveTo(center, center); ctx.arc(center, center, center - 2, start, start + arc); ctx.closePath();
      ctx.fillStyle = colors[index % colors.length]; ctx.fill(); ctx.strokeStyle = '#10203955'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.translate(center, center); ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.font = `600 ${choices.length > 15 ? 18 : choices.length > 8 ? 24 : 30}px -apple-system, sans-serif`;
      let text = label;
      while (ctx.measureText(text).width > center * .64 && text.length > 1) text = text.slice(0, -1);
      if (text !== label) text = text.slice(0, -1) + '…';
      ctx.fillText(text, center - 34, 0); ctx.restore();
    });
    canvas.setAttribute('aria-label', `ルーレットの候補：${choices.join('、') || 'なし'}`);
    $('choice-count').textContent = `${String(choices.length).padStart(2, '0')} OPTIONS`;
    $('spin').disabled = spinning || !choices.length;
    $('add').disabled = spinning || choices.length >= 50;
  }
  function render() {
    $('choices').replaceChildren();
    choices.forEach((label, index) => {
      const row = document.createElement('div'); row.className = 'choice-row';
      const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = colors[index % colors.length]; swatch.setAttribute('aria-hidden', 'true');
      const input = document.createElement('input'); input.value = label; input.maxLength = 40; input.setAttribute('aria-label', `候補 ${index + 1}`);
      input.addEventListener('change', () => {
        const value = input.value.trim();
        if (!value) { input.value = choices[index]; $('message').textContent = '候補名を入力してください。削除は × を押してください。'; return; }
        choices[index] = value; input.value = value; persist(); resetResult(); draw();
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete'; remove.textContent = '×'; remove.setAttribute('aria-label', `${label}を削除`);
      remove.addEventListener('click', () => { choices.splice(index, 1); persist(); resetResult(); render(); const inputs = $('choices').querySelectorAll('input'); (inputs[Math.min(index, inputs.length - 1)] || $('new-choice')).focus(); });
      row.append(swatch, input, remove); $('choices').append(row);
    });
    draw();
  }
  $('add-form').addEventListener('submit', event => {
    event.preventDefault();
    if (spinning || choices.length >= 50) return;
    const value = $('new-choice').value.trim();
    if (!value) { $('message').textContent = '追加する候補を入力してください。'; $('new-choice').focus(); return; }
    choices.push(value); $('new-choice').value = ''; $('message').textContent = ''; persist(); resetResult(); render(); $('new-choice').focus();
  });
  $('spin').addEventListener('click', () => {
    if (spinning || !choices.length) return;
    spinning = true;
    document.querySelectorAll('#choices input, #choices button, #new-choice, #add').forEach(el => { el.disabled = true; });
    $('spin').disabled = true; $('spin').textContent = 'まわっています…';
    $('result-label').textContent = 'どれになるかな…'; $('result').textContent = '選んでいます'; document.querySelector('.result').classList.remove('winner');
    // Each spin samples independently, so consecutive identical winners are allowed.
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const fraction = random[0] / 4294967296;
    const target = Math.floor(fraction * choices.length);
    const segment = 360 / choices.length;
    const desired = (360 - (target + .5) * segment) % 360;
    const from = rotation;
    const distance = 360 * 6 + (desired - from % 360 + 360) % 360;
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 4800;
    let start;
    function frame(now) {
      if (start === undefined) start = now;
      const progress = Math.min((now - start) / duration, 1);
      rotation = from + distance * (1 - Math.pow(1 - progress, 4));
      canvas.style.transform = `rotate(${rotation}deg)`;
      if (progress < 1) { requestAnimationFrame(frame); return; }
      rotation = desired; canvas.style.transform = `rotate(${rotation}deg)`;
      spinning = false;
      $('result-label').textContent = '今回の結果'; $('result').textContent = choices[target]; document.querySelector('.result').classList.add('winner');
      $('spin').innerHTML = '<span aria-hidden="true">↻</span> もう一度まわす';
      document.querySelectorAll('#choices input, #choices button, #new-choice').forEach(el => { el.disabled = false; });
      draw();
    }
    requestAnimationFrame(frame);
  });
  render(); resetResult();
  if (!storageAvailable) { $('saved').textContent = '保存できません'; $('message').textContent = '保存データを読み込めませんでした。候補の変更時に保存を再試行します。'; }
})();
