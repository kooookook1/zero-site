// Animation helpers and scroll reveal
// Splash "Zero" loader (first visit) and link copy buttons
(function(){
  const splash = document.getElementById('splash');
  if (splash) {
    const KEY = 'zero_splash_ts';
    const TTL_HOURS = 24;
    const force = new URL(location.href).searchParams.get('splash') === '1';
    let show = true;
    // Ensure splash starts hidden to avoid click interception on initial paint
    splash.classList.add('hidden');

    try {
      const last = parseInt(localStorage.getItem(KEY)||'0',10);
      const ageH = (Date.now() - last) / 36e5;
      show = force || !last || ageH > TTL_HOURS;
    } catch {}

    if (show) {
      document.documentElement.style.overflow = 'hidden';
      splash.classList.remove('hidden');
      let hidden = false;
      const minDisplay = 1800; // ms
      const t0 = performance.now();

      const hide = ()=>{
        if (hidden) return; hidden = true;
        splash.classList.add('hidden');
        document.documentElement.style.overflow = '';
        try { localStorage.setItem(KEY, String(Date.now())); } catch {}
        window.removeEventListener('keydown', onKey);
        splash.removeEventListener('click', skip);
      };
      const onKey = (e)=>{ if (e.key === 'Escape') hide(); };
      const skip = ()=> hide();
      window.addEventListener('keydown', onKey);
      splash.addEventListener('click', skip);

      const done = ()=>{
        const dt = performance.now() - t0;
        setTimeout(hide, Math.max(0, minDisplay - dt));
      };
      // allow CSS animations to start
      requestAnimationFrame(()=> setTimeout(done, 50));
    } else {
      splash.classList.add('hidden');
    }
  }

  // Open all details by default so nothing looks hidden
  document.querySelectorAll('details').forEach(d => d.open = true);

  // Add copy buttons next to http/https/onion links
  const linkSelector = 'a[href^="http"], a[href^="https"], a[href$=".onion"], a[href*=".onion/"]';
  const links = Array.from(document.querySelectorAll(linkSelector));
  links.forEach(a => {
    if (a.querySelector('img')) return; // skip image links

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.title = 'نسخ الرابط';
    btn.setAttribute('aria-label','نسخ الرابط');
    btn.textContent = 'نسخ';
    btn.addEventListener('click', async (e)=>{
      e.preventDefault();
      const url = a.href;
      try {
        await navigator.clipboard.writeText(url);
        btn.classList.add('success');
        btn.textContent = 'تم!';
        setTimeout(()=>{ btn.classList.remove('success'); btn.textContent = 'نسخ'; }, 1200);
      } catch(err) {
        btn.textContent = 'خطأ';
        setTimeout(()=>{ btn.textContent = 'نسخ'; }, 1200);
      }
    });
    a.insertAdjacentElement('afterend', btn);
  });
})();


// Top bar search + onion filter + progress
(function(){
  const input = document.getElementById('searchInput');
  const onionOnly = document.getElementById('onionOnly');
  const resetBtn = document.getElementById('resetSearch');
  const matchCount = document.getElementById('matchCount');
  const progressBar = document.getElementById('progressBar');
  if (!input || !onionOnly || !resetBtn) return;

  const items = Array.from(document.querySelectorAll('a'))
    .filter(a => !a.querySelector('img'))
    .map(a => ({ el: a, text: (a.textContent || '').toLowerCase(), href: (a.href || '').toLowerCase() }));

  function applyFilter(){
    const q = (input.value || '').toLowerCase().trim();
    const onion = onionOnly.checked;
    let visible = 0, total = 0;

    items.forEach(({el, text, href}) => {
      total++;
      const matchQuery = !q || text.includes(q) || href.includes(q);
      const matchOnion = !onion || href.includes('.onion');
      const show = matchQuery && matchOnion;
      // لا نخفي العنصر نهائياً، فقط نقلل الشفافية عند عدم التطابق حتى تبقى الروابط ظاهرة دائماً
      if (show) {
        el.classList.remove('dim');
        const li = el.closest('li'); if (li) li.classList.remove('dim');
        visible++;
      } else {
        el.classList.add('dim');
        const li = el.closest('li'); if (li) li.classList.add('dim');
      }
    });

    if (matchCount) matchCount.textContent = visible + ' / ' + total + ' نتيجة';
    const ratio = total ? Math.min(100, Math.round((visible/total)*100)) : 0;
    if (progressBar) progressBar.style.width = ratio + '%';
  }

  input.addEventListener('input', applyFilter);
  onionOnly.addEventListener('change', applyFilter);
  resetBtn.addEventListener('click', ()=>{ input.value=''; onionOnly.checked=false; applyFilter(); });
  applyFilter();
})();

(function(){
  // Exclude <details>/<summary> from reveal to avoid hiding headers/sections
  const revealEls = Array.from(document.querySelectorAll('.container, .sect1, img, table, ul, ol, li, blockquote, hr, h1, h2, h3, h4, h5, h6, p'));
  revealEls.forEach(el => el.classList.add('reveal'));
  if (!('IntersectionObserver' in window)) {
    // Fallback: show everything immediately on old browsers
    revealEls.forEach(el => el.classList.add('show'));
  } else {
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('show'); io.unobserve(e.target); } });
    }, {threshold: 0.01, rootMargin: '0px 0px -10% 0px'});
    revealEls.forEach(el => io.observe(el));
  }
  // Back to top button
  const btn = document.createElement('button');
  btn.id = 'backToTop';
  btn.innerHTML = '<svg viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'18 15 12 9 6 15\'></polyline></svg> Top';
  btn.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  document.body.appendChild(btn);
  const toggleBtn = ()=>{ if(window.scrollY>200) btn.classList.add('show'); else btn.classList.remove('show'); };
  window.addEventListener('scroll', toggleBtn, {passive:true});
  toggleBtn();
})();

// Chat client (WebSocket)
(function(){
  const btn = document.getElementById('chatBtn');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const log = document.getElementById('chatLog');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const nickInput = document.getElementById('chatNick');
  if(!btn || !panel || !log || !form || !input) return;

  // Auto direction for Arabic/English mixing
  if (nickInput) nickInput.setAttribute('dir', 'auto');
  if (input) input.setAttribute('dir', 'auto');

  // AIOHTTP server exposes /ws, /upload on port 12001. If running on work-1, switch host prefix to work-2
  const baseHost = location.host;
  let apiHost = baseHost;
  const params = new URLSearchParams(location.search);
  const paramApi = params.get('api') || params.get('apiHost') || '';
  const lsApi = localStorage.getItem('API_HOST') || localStorage.getItem('api_host') || '';
  const isGithubPages = baseHost.endsWith('github.io') || baseHost.includes('github.io');
  if (paramApi) {
    apiHost = paramApi; localStorage.setItem('API_HOST', apiHost);
    if (location.search) history.replaceState({}, '', location.origin + location.pathname + location.hash);
  } else if (lsApi) {
    apiHost = lsApi;
  } else if (baseHost.startsWith('work-1-')) {
    apiHost = baseHost.replace('work-1-', 'work-2-');
  } else if (baseHost.includes(':12000')) {
    apiHost = baseHost.replace(':12000', ':12001');
  }
  const CHAT_ENABLED = !(isGithubPages && !paramApi && !lsApi);
  const scheme = (location.protocol === 'https:' ? 'https://' : 'http://');
  const wsScheme = (location.protocol === 'https:' ? 'wss://' : 'ws://');
  const API_BASE = scheme + apiHost;
  const WS_ORIGIN = wsScheme + apiHost + '/ws';
  let ws;
  let opened = false;

  function ui(open){
    opened = !!open;
    panel.classList.toggle('open', opened);
  }

  function append(msg){
    if(!msg) return;
    const div = document.createElement('div');
    div.className = 'msg' + (msg.type === 'system' ? ' system' : '');
    div.setAttribute('dir','auto');
    const time = new Date(msg.ts||Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if(msg.type === 'chat'){
      div.innerHTML = `<span class=\"nick\">[${time}] ${escapeHtml(msg.nick||'Guest')}:<\/span> ${linkify(escapeHtml(msg.text||''))}`;
    } else if (msg.type === 'system') {
      div.textContent = msg.text;
    } else if (msg.type === 'file') {
      const f = msg.file || {}; const name = escapeHtml(f.name||'file');
      const url = escapeHtml(f.url||'#'); const mime = (f.mime||'').toLowerCase();
      if (mime.startsWith('image/')) {
        div.innerHTML = `<span class=\"nick\">[${time}] ${escapeHtml(msg.nick||'Guest')}:<\/span><div class=\"file\"><img class=\"thumb\" src=\"${url}\" alt=\"${name}\"/><a href=\"${url}\" target=\"_blank\" rel=\"noopener\">${name}<\/a><\/div>`;
      } else {
        div.innerHTML = `<span class=\"nick\">[${time}] ${escapeHtml(msg.nick||'Guest')}:<\/span><div class=\"file\"><a href=\"${url}\" target=\"_blank\" rel=\"noopener\">${name}<\/a><\/div>`;
      }
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function linkify(text){
    return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1<\/a>');
  }
  function escapeHtml(s){
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  function connect(){
    ws = new WebSocket(WS_ORIGIN);
    ws.onopen = ()=>{
      const nick = (nickInput.value || localStorage.getItem('chat_nick') || '').trim();
      if(nick) localStorage.setItem('chat_nick', nick);
      ws.send(JSON.stringify({type:'hello', nick: nick || undefined}));
    };
    ws.onmessage = (ev)=>{
      try {
        const data = JSON.parse(ev.data);
        if(data.type === 'history' && Array.isArray(data.items)){
          data.items.forEach(append);
        } else {
          append(data);
          if(!opened && data.type !== 'history'){ setBadge(unread+1); }
        }
      } catch {}
    };
    ws.onclose = ()=>{
      // try reconnect after a while if panel open
      if(opened) setTimeout(connect, 1500);
    };
  }

  // Unread badge (moved to module scope)
  const badge = document.getElementById('chatBadge');
  let unread = 0;
  function setBadge(n){
    unread = n;
    if (!badge) return;
    if (opened || unread<=0){ badge.style.display='none'; }
    else { badge.style.display='inline-block'; badge.textContent = String(unread); }
  }

  btn.addEventListener('click', ()=>{
    ui(!opened);
    if(opened){ if(!ws || ws.readyState>1) connect(); input.focus(); setBadge(0); }
  });
  closeBtn && closeBtn.addEventListener('click', ()=> ui(false));

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const text = input.value.trim(); if(!text || !ws || ws.readyState!==1) return;
    const nick = (nickInput.value || localStorage.getItem('chat_nick') || '').trim();
    if(nick) localStorage.setItem('chat_nick', nick);
    ws.send(JSON.stringify({type:'chat', nick: nick || undefined, text}));
    input.value = '';
  });

  // File upload
  const pickBtn = document.getElementById('pickFile');
  const fileInput = document.getElementById('chatFile');
  pickBtn && pickBtn.addEventListener('click', ()=> fileInput && fileInput.click());
  if (fileInput) {
    fileInput.addEventListener('change', async ()=>{
      if (!fileInput.files || !fileInput.files[0]) return;
      const f = fileInput.files[0];
      const prog = document.getElementById('uploadProgress');
      if (prog) { prog.style.display = 'block'; prog.textContent = `⬆️ ${f.name} — 0%`; }
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API_BASE + '/upload');
        xhr.upload.onprogress = (e)=>{
          if (!prog) return; if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            prog.textContent = `⬆️ ${f.name} — ${pct}%`;
          }
        };
        const p = new Promise((resolve, reject)=>{
          xhr.onreadystatechange = ()=>{
            if(xhr.readyState === 4){
              if(xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
              else reject(new Error('upload failed: '+xhr.status));
            }
          };
          xhr.onerror = ()=> reject(new Error('network error'));
          const fd = new FormData(); fd.append('file', f); xhr.send(fd);
        });
        const raw = await p; const data = JSON.parse(raw);
        if (data && data.ok && ws && ws.readyState===1) {
          const nick = (nickInput.value || localStorage.getItem('chat_nick') || '').trim();
          if(nick) localStorage.setItem('chat_nick', nick);
          ws.send(JSON.stringify({type:'file', nick: nick || undefined, file: {url: data.url, name: data.name, size: data.size, mime: data.mime}}));
        }
      } catch (e) {
        console.error('upload failed', e);
        if (prog) prog.textContent = 'فشل الرفع';
      } finally {
        fileInput.value = '';
        if (prog) setTimeout(()=>{ prog.style.display='none'; }, 1200);
      }
    });
  }
})();

