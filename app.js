const API_BASE = 'https://movieapi.giftedtech.co.ke/api';
const resultsEl = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const qInput = document.getElementById('q');
const searchBtn = document.getElementById('searchBtn');
const popularBtn = document.getElementById('popularBtn');

const player = document.getElementById('player');
const playerSource = document.getElementById('playerSource');
const qualitySelect = document.getElementById('qualitySelect');
const subtitleSelect = document.getElementById('subtitleSelect');
const openSource = document.getElementById('openSource');
const downloadBtn = document.getElementById('downloadBtn');
const quickSources = document.getElementById('quickSources');
const quickSubs = document.getElementById('quickSubs');
const infoBox = document.getElementById('infoBox');

let currentMovie = null;
let currentSources = [];
let currentSubtitles = [];

/* =======================
      HELPERS
========================== */
function bytesTo(size){
  if(!size) return '—';
  const b = parseInt(size,10);
  if(isNaN(b)) return size;
  if(b < 1024) return b + ' B';
  if(b < 1024**2) return (b/1024).toFixed(1) + ' KB';
  if(b < 1024**3) return (b/1024**2).toFixed(2) + ' MB';
  return (b/1024**3).toFixed(2) + ' GB';
}

function el(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k==='class') e.className=v;
    else if(k==='html') e.innerHTML=v;
    else if(k==='text') e.textContent=v;
    else e.setAttribute(k,v);
  });
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if(!c) return;
    if(typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}

function setInfo(subject){
  currentMovie = subject;
  infoBox.innerHTML = '';
  const title = el('h3', {text: subject.title || 'Untitled'});
  const meta = el('p', {
    html: `<strong>Release:</strong> ${subject.releaseDate || 'unknown'} • 
           <strong>Duration:</strong> ${subject.duration? (subject.duration/60).toFixed(0)+' min' : '—' }`
  });
  const desc = el('p',{text: subject.description || subject.postTitle || 'No description available'});
  const cover = el('img', {
    src: subject.cover?.url || subject.thumbnail || '',
    style:'width:100%; max-height:260px; object-fit:cover; border-radius:8px; margin-top:10px;'
  });

  infoBox.appendChild(title);
  infoBox.appendChild(meta);
  infoBox.appendChild(desc);
  if(cover.src) infoBox.appendChild(cover);

  const subsHint = el('p',{html:`<strong>Available subtitles:</strong> ${subject.subtitles || 'None'}`});
  infoBox.appendChild(subsHint);
}

/* =======================
   RENDER RESULTS
========================== */
function renderResults(items){
  resultsEl.innerHTML = '';
  if(!items || items.length === 0){
    resultsCount.textContent = 'No results';
    resultsEl.appendChild(el('div',{text:'No movies found.'}));
    return;
  }

  resultsCount.textContent = `${items.length} results`;

  items.forEach(it=>{
    const card = el('div',{class:'card'});
    const img = el('img',{class:'poster', src: it.cover?.url || it.thumbnail || ''});
    const meta = el('div',{class:'meta'});
    const h = el('h3',{text: it.title});
    const g = el('p',{text: `${it.countryName || ''} • ${it.imdbRatingValue? ('★ ' + it.imdbRatingValue) : ''}`});
    const genres = el('p',{class:'small', text: (it.genre || '').slice(0,90)});
    
    meta.appendChild(h);
    meta.appendChild(g);
    meta.appendChild(genres);
    card.appendChild(img);
    card.appendChild(meta);

    card.addEventListener('click', ()=> selectMovie(it.subjectId));
    resultsEl.appendChild(card);
  });
}

/* =======================
      API CALLS
========================== */
async function apiSearch(query){
  if(!query) return null;
  const safeQ = encodeURIComponent(query.trim());
  const r = await fetch(`${API_BASE}/search/${safeQ}`);
  if(!r.ok) throw new Error('Search failed');
  return r.json();
}

async function apiInfo(id){
  const r = await fetch(`${API_BASE}/info/${id}`);
  if(!r.ok) throw new Error('Info failed');
  return r.json();
}

async function apiSources(id, season, episode){
  let url = `${API_BASE}/sources/${id}`;
  if(season) url += `?season=${season}`;
  if(episode) url += `${season?'&':'?'}episode=${episode}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error('Sources failed');
  return r.json();
}

/* =======================
   SEARCH EVENTS
========================== */
searchBtn.addEventListener('click', async ()=>{
  const q = qInput.value.trim();
  if(!q){ alert('Type a movie title'); return; }

  resultsEl.innerHTML = '<div>Loading...</div>';
  try{
    const data = await apiSearch(q);
    renderResults(data?.results?.items || []);
  }catch{
    resultsEl.innerHTML = '<div>Error</div>';
  }
});

popularBtn.addEventListener('click', async ()=>{
  const keys = ['trending','popular','top'];
  resultsEl.innerHTML = '<div>Loading...</div>';

  for(const k of keys){
    try{
      const data = await apiSearch(k);
      const items = data?.results?.items || [];
      if(items.length){ renderResults(items); return; }
    }catch{}
  }

  resultsEl.innerHTML = '<div>No trending movies found.</div>';
});

/* =======================
   MOVIE SELECTION / PLAYBACK
========================== */
async function selectMovie(movieId){
  infoBox.innerHTML = '<h3>Loading...</h3>';
  currentSources = [];
  currentSubtitles = [];
  qualitySelect.innerHTML = '<option value="">Select quality</option>';
  subtitleSelect.innerHTML = '<option value="">Subtitles (none)</option>';
  quickSources.innerHTML = '';
  quickSubs.innerHTML = '';
  downloadBtn.removeAttribute('href');

  try{
    const info = await apiInfo(movieId);
    const subject = info?.results?.subject || info?.results;
    setInfo(subject);

    const srcResp = await apiSources(movieId);
    currentSources = Array.isArray(srcResp?.results) ? srcResp.results : [];
    currentSubtitles = srcResp?.subtitles || subject?.subtitlesList || [];

    quickSources.innerHTML = '';
    currentSources.forEach((s,i)=>{
      const btn = el('div',{class:'src', text: s.quality || s.resolution || 'auto'});
      btn.addEventListener('click', ()=> playSourceByIndex(i));
      quickSources.appendChild(btn);
    });

    quickSubs.innerHTML = '';
    if(Array.isArray(currentSubtitles)){
      currentSubtitles.forEach(sub=>{
        const div = el('div',{class:'sub', text: sub.label || sub.lanName || sub});
        div.addEventListener('click', ()=> setSubtitle(sub));
        quickSubs.appendChild(div);

        const opt = el('option',{value: sub.url || '', text: sub.label || sub.lanName || sub});
        subtitleSelect.appendChild(opt);
      });
    }

    currentSources.forEach(s=>{
      const stream = s.stream_url || s.download_url || s.url;
      const text = `${s.quality || s.resolution} • ${bytesTo(s.size)}`;
      const opt = el('option',{value:stream, text});
      qualitySelect.appendChild(opt);
    });

    const sorted = currentSources.slice().sort((a,b)=>{
      return (parseInt(b.quality)||0) - (parseInt(a.quality)||0);
    });

    const best = sorted[0];
    if(best){
      const url = best.stream_url || best.download_url || best.url;
      setPlayerSource(url);
      downloadBtn.href = url;
      openSource.href = url;
    }

    qualitySelect.onchange = ()=> setPlayerSource(qualitySelect.value);
    subtitleSelect.onchange = ()=>{
      if(!subtitleSelect.value) removeTracks();
      else addTrack(subtitleSelect.value, subtitleSelect.selectedOptions[0].text);
    };

  }catch(e){
    infoBox.innerHTML = '<h3>Error loading movie</h3>';
  }
}

function playSourceByIndex(i){
  const s = currentSources[i];
  const url = s.stream_url || s.download_url || s.url;
  setPlayerSource(url);
  qualitySelect.value = url;
  downloadBtn.href = url;

  Array.from(quickSources.children).forEach((c, idx)=> c.classList.toggle('active', idx===i));
}

/* =======================
      PLAYER CONTROL
========================== */
function setPlayerSource(url){
  player.pause();
  removeTracks();
  playerSource.src = url;
  player.load();
  player.play().catch(()=>{});
  openSource.href = url;
  downloadBtn.href = url;
}

function addTrack(url, label){
  removeTracks();
  if(!url) return;
  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = label;
  track.src = url;
  track.default = true;
  player.appendChild(track);

  setTimeout(()=> {
    try { track.mode = 'showing'; } catch(e){}
  }, 300);
}

function removeTracks(){
  player.querySelectorAll('track').forEach(t=>t.remove());
}

function setSubtitle(sub){
  const url = sub.url || '';
  const name = sub.label || sub.lanName || sub;

  const active = Array.from(player.querySelectorAll('track')).some(t => t.src === url);

  if(active) removeTracks();
  else addTrack(url, name);

  Array.from(quickSubs.children).forEach(c=> c.classList.toggle('active', c.textContent === name));
}

/* =======================
    PICTURE-IN-PICTURE
========================== */
document.getElementById('togglePip').addEventListener('click', async ()=>{
  try{
    if(document.pictureInPictureElement){
      await document.exitPictureInPicture();
    } else {
      await player.requestPictureInPicture();
    }
  }catch{}
});

/* =======================
    DEFAULT LOAD
========================== */
(async function init(){
  try{
    const data = await apiSearch('popular');
    renderResults(data?.results?.items || []);
  }catch{
    resultsEl.innerHTML = '<div>Start by searching a movie</div>';
  }
})();

qInput.addEventListener('keydown', e=>{
  if(e.key==='Enter') searchBtn.click();
});