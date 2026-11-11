"use strict";
/* ===== مشترك بين admin.html و teacher.html ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

/* ---------- الاتصال بالقاعدة ----------
   الافتراضي من config.js. ممكن قاعدة مختلفة لكل مندوب: "كود إعداد" = base64 لـ  url|anonKey
   يتخزن في selah-trial-cfg، أو يجي في رابط المدرس &p=...  */
const CFG_KEY = 'selah-trial-cfg';
function encodeCfg(url, key) { return btoa(url + '|' + key).replace(/=+$/, ''); }
function decodeCfg(s) { try { const [url, key] = atob(s.trim()).split('|'); if (/^https:\/\/.+/.test(url) && key) return { url, key }; } catch (e) { } return null; }
function getCfg(cfgKey = CFG_KEY) {
  const o = LS.get(cfgKey);
  if (o && o.url && o.key) return { ...o, custom: true };
  const c = window.SILAH_CONFIG || {};
  return { url: c.SUPABASE_URL, key: c.SUPABASE_ANON_KEY, custom: false };
}
function cfgReady(c) { return c.url && !/PASTE/.test(c.url) && c.key && !/PASTE/.test(c.key); }
function makeClient(persist, cfgKey = CFG_KEY) {
  const c = getCfg(cfgKey);
  if (!cfgReady(c)) return null;
  return supabase.createClient(c.url, c.key, { auth: { persistSession: persist, autoRefreshToken: persist, storageKey: 'selah-trial-auth' } });
}
function deviceId() {
  let d = LS.get('selah-trial-device');
  if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); LS.set('selah-trial-device', d); }
  return d;
}

/* ---------- حقول الملف الشخصي (SPEC بند 7) ---------- */
const GRADES = [
  ['p1', 'أولى ابتدائي'], ['p2', 'تانية ابتدائي'], ['p3', 'تالتة ابتدائي'], ['p4', 'رابعة ابتدائي'], ['p5', 'خامسة ابتدائي'], ['p6', 'سادسة ابتدائي'],
  ['m1', 'أولى إعدادي'], ['m2', 'تانية إعدادي'], ['m3', 'تالتة إعدادي']
];
const GRADE_VAL = ['لا أدرّسه', 'أدرّسه', 'بكتاب سلاح التلميذ'];
const FIELDS = [
  { k: 'name', l: 'الاسم', t: 'text' },
  { k: 'avatar', l: 'الصورة الشخصية', t: 'avatar' },
  { k: 'phone', l: 'رقم التليفون', t: 'tel' },
  { k: 'subject', l: 'التخصص', t: 'text', list: ['عربي', 'رياضيات', 'إنجليزي', 'علوم', 'دراسات', 'كل المواد (فصل)'] },
  { k: 'gov', l: 'المحافظة', t: 'text', list: ['البحيرة', 'الإسكندرية', 'كفر الشيخ', 'الغربية', 'المنوفية', 'القاهرة', 'الجيزة'] },
  { k: 'city', l: 'المركز / المنطقة', t: 'text' },
  { k: 'place', l: 'مكان الدرس', t: 'text', list: ['سنتر', 'بيت', 'مدرسة', 'أونلاين'] },
  { k: 'students', l: 'عدد الطلاب', t: 'number' },
  { k: 'grades', l: 'الصفوف اللي بتدرّسها', t: 'grades' }
];
const FIELD_LABEL = Object.fromEntries(FIELDS.map(f => [f.k, f.l]));
FIELD_LABEL.photos = 'صور إضافية';
const REQ_FIELDS = [...FIELDS.map(f => f.k), 'photos'];

function gradesText(g) {
  if (!g || typeof g !== 'object') return '—';
  const a = GRADES.filter(([k]) => g[k] > 0).map(([k, l]) => l + (g[k] == 2 ? ' 📗' : ''));
  return a.length ? a.join('، ') : 'ولا صف';
}
function fmtVal(k, v) {
  if (v === undefined || v === null || v === '') return '<span class="muted">—</span>';
  if (k === 'avatar') return (typeof v === 'string' && v.startsWith('data:')) ? `<img class="av" src="${v}" alt="">` : '🖼️ صورة';
  if (k === 'grades') return esc(gradesText(v));
  return esc(v);
}
// صفوف اتغيرت بين نسختين
function gradesDiff(o, n) {
  o = o || {}; n = n || {};
  return GRADES.filter(([k]) => (o[k] || 0) != (n[k] || 0)).map(([k, l]) => `${l}: ${GRADE_VAL[o[k] || 0]} ← ${GRADE_VAL[n[k] || 0]}`);
}

/* ---------- واجهة ---------- */
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function modal(html, onOpen) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box">${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
  document.body.appendChild(m); onOpen && onOpen(m.querySelector('.box'), () => m.remove());
  return m;
}
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('اتنسخ ✅'); }
  catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); toast('اتنسخ ✅'); }
}
function waPhone(p) { p = String(p || '').replace(/\D/g, ''); if (p.startsWith('01')) p = '2' + p; return p; }
function waLink(phone, text) { return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`; }
function downloadDataUrl(dataUrl, name) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function errMsg(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/Failed to fetch|NetworkError/i.test(m)) return 'مفيش نت أو القاعدة واقفة';
  return m;
}

/* ضغط صورة: يصغّر لحد ما الحجم ≤ maxBytes تقريبًا. يرجّع dataURL jpeg */
function compressImage(file, maxDim, maxBytes) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let dim = maxDim, out = '';
      for (let tries = 0; tries < 8; tries++) {
        const sc = Math.min(1, dim / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        for (let q = 0.8; q >= 0.4; q -= 0.1) { out = c.toDataURL('image/jpeg', q); if (out.length * 0.75 <= maxBytes) return res(out); }
        dim = Math.round(dim * 0.8);
      }
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('الصورة مش مقروءة')); };
    img.src = url;
  });
}

/* نموذج الملف الشخصي (للمدرس وللتعديل المباشر/عدّل-ووافق عند الإدارة)
   vals: القيم الحالية. opts: {only:[keys], req:Set(keys), pend:{k:v}} */
function profileForm(vals, opts = {}) {
  vals = vals || {};
  const keys = opts.only || FIELDS.map(f => f.k);
  return FIELDS.filter(f => keys.includes(f.k)).map(f => {
    const v = vals[f.k], req = opts.req && opts.req.has(f.k) ? ' req' : '';
    const pend = opts.pend && f.k in opts.pend ? `<div class="pend">⏳ تعديلك في انتظار المراجعة: ${f.k === 'grades' ? esc(gradesText(opts.pend[f.k])) : f.k === 'avatar' ? 'صورة جديدة' : esc(opts.pend[f.k])}</div>` : '';
    const reqTxt = req ? ' <span class="pill bad">مطلوب تحديثه</span>' : '';
    let inp;
    if (f.t === 'avatar') {
      inp = `<div style="display:flex;align-items:center;gap:10px"><span data-avprev>${v ? `<img class="av lg" src="${v}" alt="">` : '<span class="av lg">👤</span>'}</span>
        <label class="btn sm">📷 اختار صورة<input type="file" accept="image/*" data-av hidden></label></div>`;
    } else if (f.t === 'grades') {
      const g = v || {};
      inp = `<div class="grades" data-grades>${GRADES.map(([k, l]) => `<div class="grow-g"><b>${l}</b><div class="seg" data-g="${k}">${GRADE_VAL.map((t, i) => `<button type="button" data-v="${i}" class="${(g[k] || 0) == i ? 'on' : ''}">${t}</button>`).join('')}</div></div>`).join('')}</div>`;
    } else {
      const dl = f.list ? `<datalist id="dl-${f.k}">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : '';
      inp = `<input name="${f.k}" type="${f.t === 'number' ? 'number' : f.t === 'tel' ? 'tel' : 'text'}" ${f.t === 'number' ? 'inputmode="numeric" min="0"' : ''} value="${esc(v ?? '')}" ${f.list ? `list="dl-${f.k}"` : ''}>${dl}`;
    }
    return `<div class="field${req}" data-f="${f.k}"><label>${f.l}${reqTxt}</label>${inp}${pend}</div>`;
  }).join('');
}
// يربط أحداث النموذج (اختيار الصفوف + الصورة الشخصية). state.avatar يتحدث
function bindProfileForm(root, state) {
  root.addEventListener('click', e => {
    const b = e.target.closest('.seg button'); if (!b) return;
    $$('button', b.parentNode).forEach(x => x.classList.toggle('on', x === b));
  });
  const av = $('[data-av]', root);
  av && av.addEventListener('change', async () => {
    const f = av.files[0]; if (!f) return;
    try { state.avatar = await compressImage(f, 200, 25000); $('[data-avprev]', root).innerHTML = `<img class="av lg" src="${state.avatar}" alt="">`; }
    catch (e) { toast(errMsg(e)); }
  });
}
function readProfileForm(root, state) {
  const out = {};
  $$('input[name]', root).forEach(i => { const v = i.value.trim(); out[i.name] = i.type === 'number' ? (v === '' ? '' : +v) : v; });
  const g = $('[data-grades]', root);
  if (g) { out.grades = {}; $$('.seg', g).forEach(s => { const on = $('button.on', s); out.grades[s.dataset.g] = on ? +on.dataset.v : 0; }); }
  if (state && state.avatar) out.avatar = state.avatar;
  return out;
}
// يرجّع المفاتيح اللي اتغيرت فقط
function changedOnly(base, vals) {
  const o = {};
  for (const k in vals) {
    const a = base[k], b = vals[k];
    if (k === 'grades') { if (gradesDiff(a, b).length) o[k] = b; }
    else if (String(a ?? '') !== String(b ?? '')) o[k] = b;
  }
  return o;
}
