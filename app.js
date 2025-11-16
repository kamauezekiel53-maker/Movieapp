// app.js - Movie Hub (pure JS, uses TMDb v3)
// Replace API_KEY if you want; provided key is used here.
const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const API_BASE = 'https://api.themoviedb.org/3';

const moviesGrid = document.getElementById('moviesGrid');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('searchInput');
const suggestionsBox = document.getElementById('suggestions');
const sectionButtons = document.querySelectorAll('.sec-btn');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const themeToggle = document.getElementById('themeToggle');
const colorTheme = document.getElementById('colorTheme');

const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalPoster = document.getElementById('modalPoster');
const modalTitle = document.getElementById('modalTitle');
const modalOverview = document.getElementById('modalOverview');
const modalSub = document.getElementById('modalSub');
const modalCast = document.getElementById('modalCast');
const modalVideos = document.getElementById('modalVideos');

let state = {
  section: 'popular',
  page: 1,
  total_pages: 1,
  query: '',
  debounceTimer: null,
  suggestionsTimer: null
};

// helpers
function qs(url) {
  const u = new URL(url);
  u.searchParams.set('api_key', API_KEY);
  return fetch(u).then(r => {
    if (!r.ok) throw new Error('Network error');
    return r.json();
  });
}

function showLoader() { loader.classList.remove('hidden'); loader.setAttribute('aria-hidden','false'); }
function hideLoader() { loader.classList.add('hidden'); loader.setAttribute('aria-hidden','true'); }

function clearGrid() { moviesGrid.innerHTML = ''; }

// build endpoint mapping for sections
function endpointForSection(section, page=1){
  if(section === 'trending') return `${API_BASE}/trending/movie/week?page=${page}`;
  if(section === 'now_playing') return `${API_BASE}/movie/now_playing?page=${page}`;
  if(section === 'top_rated') return `${API_BASE}/movie/top_rated?page=${page}`;
  // default popular
  return `${API_BASE}/movie/popular?page=${page}`;
}

// render movies
function renderMovies(list){
  clearGrid();
  if(!list || list.length === 0){
    moviesGrid.innerHTML = `<p class="muted" style="color:var(--muted)">No results found.</p>`;
    return;
  }
  list.forEach(m => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = m.id;
    const poster = m.poster_path ? `${IMG_BASE}${m.poster_path}` : '';
    card.innerHTML = `
      <div class="poster">
        ${ poster ? `<img loading="lazy" src="${poster}" alt="${escapeHtml(m.title)} poster">` :
          `<div style="padding:18px;color:var(--muted)">No Image</div>` }
      </div>
      <div class="card-body">
        <div class="title-row">
          <h3>${escapeHtml(m.title)}</h3>
          <span class="badge">⭐ ${m.vote_average ? m.vote_average.toFixed(1) : '—'}</span>
        </div>
        <div style="font-size:13px;color:var(--muted)">${m.release_date ? m.release_date.slice(0,4) : '—'}</div>
      </div>
    `;
    moviesGrid.appendChild(card);
  });
}

// escape for safety in templates
function escapeHtml(s=''){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// load section
async function loadSection(section=state.section, page=state.page){
  try {
    showLoader();
    const url = endpointForSection(section, page);
    const data = await qs(url);
    renderMovies(data.results);
    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Page ${state.page} of ${state.total_pages}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.total_pages;
  } catch (err) {
    console.error(err);
    moviesGrid.innerHTML = `<p style="color:var(--muted)">Failed to load movies.</p>`;
  } finally { hideLoader(); }
}

// search
async function doSearch(query, page=1){
  if(!query) return;
  try {
    showLoader();
    const url = `${API_BASE}/search/movie?query=${encodeURIComponent(query)}&page=${page}`;
    const data = await qs(url);
    renderMovies(data.results);
    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Search: "${query}" — Page ${state.page} of ${state.total_pages}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.total_pages;
  } catch (err) {
    console.error(err);
    moviesGrid.innerHTML = `<p style="color:var(--muted)">Search failed.</p>`;
  } finally { hideLoader(); }
}

// debounced search suggestions
function suggest(query){
  if(!query) { suggestionsBox.classList.add('hidden'); suggestionsBox.innerHTML = ''; return; }
  clearTimeout(state.suggestionsTimer);
  state.suggestionsTimer = setTimeout(async () => {
    try {
      const data = await qs(`${API_BASE}/search/movie?query=${encodeURIComponent(query)}&page=1`);
      const items = data.results?.slice(0,6) || [];
      if(items.length === 0){ suggestionsBox.classList.add('hidden'); return; }
      suggestionsBox.innerHTML = items.map(it => `
        <div class="item" data-id="${it.id}" data-title="${escapeHtml(it.title)}">
          <img src="${it.poster_path ? IMG_BASE+it.poster_path : ''}" alt="" style="width:36px;height:54px;object-fit:cover;border-radius:6px;margin-right:8px;">
          <div>
            <div style="font-weight:600">${escapeHtml(it.title)}</div>
            <div style="font-size:12px;color:var(--muted)">${it.release_date ? it.release_date.slice(0,4) : ''}</div>
          </div>
        </div>
      `).join('');
      suggestionsBox.classList.remove('hidden');
    } catch (err) {
      suggestionsBox.classList.add('hidden');
    }
  }, 220);
}

// modal details
async function openModal(movieId){
  try {
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    modalPoster.src = ''; modalTitle.textContent = 'Loading...'; modalOverview.textContent = '';
    modalCast.innerHTML = ''; modalVideos.innerHTML = '';

    const data = await qs(`${API_BASE}/movie/${movieId}?append_to_response=videos,credits,images`);
    modalPoster.src = data.poster_path ? IMG_BASE + data.poster_path : '';
    modalTitle.textContent = data.title || 'Untitled';
    modalSub.textContent = `${data.release_date ?? ''} • ${data.runtime ? data.runtime + ' min' : ''}`;
    modalOverview.textContent = data.overview || 'No description available.';

    // cast
    const cast = (data.credits && data.credits.cast) ? data.credits.cast.slice(0,8) : [];
    modalCast.innerHTML = cast.map(c => `
      <div class="cast-card">
        <img src="${c.profile_path ? IMG_BASE + c.profile_path : ''}" alt="${escapeHtml(c.name)}"/>
        <div style="font-weight:600">${escapeHtml(c.name)}</div>
        <div style="font-size:12px;color:var(--muted)">${escapeHtml(c.character || '')}</div>
      </div>
    `).join('');

    // videos (trailers)
    const vids = (data.videos && data.videos.results) ? data.videos.results.filter(v => v.site === 'YouTube') : [];
    modalVideos.innerHTML = vids.slice(0,3).map(v => {
      const kid = v.key;
      return `<div class="video-card"><iframe src="https://www.youtube.com/embed/${kid}" allowfullscreen loading="lazy" title="${escapeHtml(v.name)}"></iframe></div>`;
    }).join('') || `<div style="color:var(--muted); margin-top:6px;">No trailers available.</div>`;

  } catch (err) {
    console.error(err);
    modalOverview.textContent = 'Failed to load details.';
  }
}

function closeModal(){
  modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  modalPoster.src = '';
}

// events
moviesGrid.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if(!card) return;
  const id = card.dataset.id;
  if(id) openModal(id);
});

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });

// pagination
nextBtn.addEventListener('click', () => {
  if(state.page >= state.total_pages) return;
  state.page++;
  if(state.query) doSearch(state.query, state.page);
  else loadSection(state.section, state.page);
});
prevBtn.addEventListener('click', () => {
  if(state.page <= 1) return;
  state.page--;
  if(state.query) doSearch(state.query, state.page);
  else loadSection(state.section, state.page);
});

// section buttons
sectionButtons.forEach(b => b.addEventListener('click', ev => {
  sectionButtons.forEach(x=>x.classList.remove('active'));
  ev.currentTarget.classList.add('active');
  const sec = ev.currentTarget.dataset.sec;
  state.section = sec; state.page = 1; state.query = '';
  searchInput.value = '';
  suggestionsBox.classList.add('hidden');
  loadSection(sec, 1);
}));

// search input with debounce
searchInput.addEventListener('input', (e) => {
  const v = e.target.value.trim();
  state.query = v;
  if(v.length === 0){
    suggestionsBox.classList.add('hidden');
    // return to section
    state.page = 1;
    loadSection(state.section, 1);
    return;
  }
  // show suggestions
  suggest(v);

  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => {
    state.page = 1;
    doSearch(v, 1);
  }, 450);
});

// suggestion click (event delegation)
suggestionsBox.addEventListener('click', e => {
  const item = e.target.closest('.item');
  if(!item) return;
  const id = item.dataset.id;
  if(id) openModal(id);
  suggestionsBox.classList.add('hidden');
});

// pressing enter while suggestions visible should not double-run
searchInput.addEventListener('keydown', e => {
  if(e.key === 'Enter'){ e.preventDefault(); /* already handled by debounce search */ suggestionsBox.classList.add('hidden'); }
});

// theme toggle / color theme
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
});
colorTheme.addEventListener('change', (e) => {
  document.body.classList.remove('theme-sunset','theme-ocean','theme-neo');
  const v = e.target.value;
  if(v === 'sunset') document.body.classList.add('theme-sunset');
  if(v === 'ocean') document.body.classList.add('theme-ocean');
  if(v === 'neo') document.body.classList.add('theme-neo');
});

// init
loadSection('popular', 1);

// Utility: graceful image fallback (optional)
document.addEventListener('error', function (ev) {
  if(ev.target.tagName === 'IMG' && ev.target.src.includes(IMG_BASE)){
    ev.target.src = ''; // remove broken src (CSS shows empty state)
    ev.target.style.objectFit = 'contain';
  }
}, true);