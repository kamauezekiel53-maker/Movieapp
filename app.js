/*
  app.js - Neon Cyberpunk MovieExplorer
  - Replace CONFIG.TMDB_KEY with your TMDB API key.
  - Features: search (debounced), modes, genres, year slider, sorting, favorites (localStorage),
    modal with trailer, lazy images, infinite scroll toggle, pagination, caching (sessionStorage),
    offline detection, keyboard shortcuts, toasts and neon UI interactions.
*/

const CONFIG = {
  TMDB_KEY: "7cc9abef50e4c94689f48516718607be", // <<-- REPLACE THIS
  TMDB_BASE: "https://api.themoviedb.org/3",
  IMAGE_BASE: "https://image.tmdb.org/t/p",
  POSTER_SIZE: "w342",
  BACKDROP_SIZE: "w780",
  CACHE_TTL_MS: 1000 * 60 * 60 // 1 hour
};

/* ---------------------------
   Short helpers & DOM refs
   --------------------------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const refs = {
  searchInput: $("#searchInput"),
  clearSearch: $("#clearSearch"),
  modeSelect: $("#modeSelect"),
  themeToggle: $("#themeToggle"),
  favToggle: $("#favToggle"),
  genreSelect: $("#genreSelect"),
  yearRange: $("#yearRange"),
  yearOutput: $("#yearOutput"),
  sortSelect: $("#sortSelect"),
  applyFilters: $("#applyFilters"),
  clearFilters: $("#clearFilters"),
  grid: $("#grid"),
  status: $("#status"),
  infiniteToggle: $("#infiniteToggle"),
  loadMore: $("#loadMore"),
  clearCache: $("#clearCache"),
  pageInfo: $("#pageInfo"),
  firstBtn: $("#firstBtn"),
  prevBtn: $("#prevBtn"),
  nextBtn: $("#nextBtn"),
  lastBtn: $("#lastBtn"),
  favoritesPanel: $("#favoritesPanel"),
  favList: $("#favList"),
  closeFav: $("#closeFav"),
  clearFav: $("#clearFav"),
  modal: $("#modal"),
  modalBody: $("#modalBody"),
  closeModal: $("#closeModal"),
  toasts: $("#toasts"),
  offline: $("#offline"),
  overlay: $("#overlay")
};

/* ---------------------------
   App state
   --------------------------- */
const state = {
  page: 1,
  totalPages: 1,
  mode: "popular",
  query: "",
  genre: "",
  year: new Date().getFullYear(),
  sort: "popularity.desc",
  infinite: false,
  loading: false,
  favorites: {}, // keyed by id
  cacheIndex: new Map(),
  lazyObserver: null,
  infiniteObserver: null
};

/* ---------------------------
   LocalStorage keys
   --------------------------- */
const LS = {
  FAV: "neon_favorites_v1",
  THEME: "neon_theme_v1"
};

/* ---------------------------
   Toast helper
   --------------------------- */
function toast(msg, ms = 3600) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  refs.toasts.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(()=>t.remove(),300); }, ms);
}

/* ---------------------------
   Caching (sessionStorage)
   --------------------------- */
const cachePrefix = "neon_cache_v1:";

function cacheSet(key, value) {
  try {
    const payload = { ts: Date.now(), v: value };
    sessionStorage.setItem(cachePrefix + key, JSON.stringify(payload));
    state.cacheIndex.set(key, payload.ts);
  } catch (e) { /* ignore storage failures */ }
}
function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(cachePrefix + key);
    if (!raw) return null;
    const { ts, v } = JSON.parse(raw);
    if (Date.now() - ts > CONFIG.CACHE_TTL_MS) {
      sessionStorage.removeItem(cachePrefix + key);
      state.cacheIndex.delete(key);
      return null;
    }
    return v;
  } catch (e) { return null; }
}
function clearCache() {
  try {
    Object.keys(sessionStorage).forEach(k => { if (k.startsWith(cachePrefix)) sessionStorage.removeItem(k); });
    state.cacheIndex.clear();
    toast("Cache cleared");
  } catch (e) { console.warn(e); }
}

/* ---------------------------
   TMDB wrapper
   --------------------------- */
async function tmdbFetch(path, params = {}) {
  if (!CONFIG.TMDB_KEY || CONFIG.TMDB_KEY === "YOUR_TMDB_API_KEY") {
    throw new Error("TMDB API key missing. Put your key in CONFIG.TMDB_KEY.");
  }
  const url = new URL(`${CONFIG.TMDB_BASE}${path}`);
  url.searchParams.set("api_key", CONFIG.TMDB_KEY);
  Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
  const ck = url.pathname + "?" + url.searchParams.toString();
  const cached = cacheGet(ck);
  if (cached) return cached;
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TMDB error ${res.status}: ${text}`);
  }
  const json = await res.json();
  cacheSet(ck, json);
  return json;
}

async function getGenres() { return tmdbFetch("/genre/movie/list", { language: "en-US" }); }
async function discover(page=1) {
  return tmdbFetch("/discover/movie", {
    language: "en-US",
    sort_by: state.sort,
    page,
    with_genres: state.genre || undefined,
    primary_release_year: state.year || undefined,
    include_adult: false
  });
}
async function searchMovies(query, page=1) {
  return tmdbFetch("/search/movie", { query, page, include_adult: false, language: "en-US" });
}
async function listMode(mode, page=1) {
  if (mode === "trending") return tmdbFetch("/trending/movie/week", { page });
  return tmdbFetch(`/movie/${mode}`, { language: "en-US", page });
}
async function getMovieDetails(id) {
  return tmdbFetch(`/movie/${id}`, { append_to_response: "credits,videos,images", language: "en-US" });
}

/* ---------------------------
   Utilities
   --------------------------- */
function posterUrl(path, size = CONFIG.POSTER_SIZE) {
  return path ? `${CONFIG.IMAGE_BASE}/${size}${path}` : "";
}
function formatNumber(n) { return n?.toString()?.replace(/\B(?=(\d{3})+(?!\d))/g, ",") ?? n; }

/* ---------------------------
   Lazy image loader
   --------------------------- */
function setupLazyObserver() {
  if ('IntersectionObserver' in window) {
    state.lazyObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const img = e.target;
        const src = img.dataset.src;
        if (src) img.src = src;
        img.classList.remove("loading");
        state.lazyObserver.unobserve(img);
      });
    }, { rootMargin: "200px 0px" });
  } else state.lazyObserver = null;
}

/* ---------------------------
   Build card DOM
   --------------------------- */
function buildCard(m) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = m.id;

  const img = document.createElement("img");
  img.className = "poster loading";
  img.alt = m.title || "Poster";
  img.dataset.src = posterUrl(m.poster_path) || "";
  img.onerror = () => { img.src = ""; img.alt = "No image"; img.style.background = "linear-gradient(90deg,#111,#333)"; };

  const body = document.createElement("div"); body.className = "card-body";
  const title = document.createElement("h3"); title.className = "title"; title.textContent = m.title;
  const meta = document.createElement("div"); meta.className = "meta"; meta.textContent = `${m.release_date ? m.release_date.slice(0,4) : "—"} • ⭐ ${m.vote_average ?? "N/A"}`;
  const overview = document.createElement("p"); overview.className = "overview"; overview.textContent = m.overview || "";

  const actions = document.createElement("div"); actions.className = "actions";
  const detailsBtn = document.createElement("button"); detailsBtn.className = "action-btn"; detailsBtn.textContent = "Details";
  const favBtn = document.createElement("button"); favBtn.className = "action-btn"; favBtn.textContent = state.favorites[m.id] ? "Unfav" : "Fav";
  const tmdbLink = document.createElement("a"); tmdbLink.className = "action-btn"; tmdbLink.textContent = "TMDB"; tmdbLink.href = `https://www.themoviedb.org/movie/${m.id}`; tmdbLink.target = "_blank";

  detailsBtn.addEventListener("click", (e) => { e.stopPropagation(); openDetails(m.id); });
  favBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleFav(m); favBtn.textContent = state.favorites[m.id] ? "Unfav" : "Fav"; });

  actions.append(detailsBtn, favBtn, tmdbLink);
  body.append(title, meta, overview, actions);
  card.append(img, body);

  card.addEventListener("click", (e) => {
    if (e.target.tagName.toLowerCase() === 'button' || e.target.tagName.toLowerCase() === 'a') return;
    openDetails(m.id);
  });

  if (state.lazyObserver) state.lazyObserver.observe(img);
  else img.src = img.dataset.src;

  return card;
}

/* ---------------------------
   Render movie list
   --------------------------- */
function renderMovies(list, { append=false } = {}) {
  refs.grid.setAttribute("aria-busy", "true");
  if (!append) refs.grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  list.forEach(m => frag.appendChild(buildCard(m)));
  refs.grid.appendChild(frag);
  refs.grid.setAttribute("aria-busy", "false");
  refs.pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
}

/* ---------------------------
   Favorites
   --------------------------- */
function loadFavorites() {
  try {
    const raw = localStorage.getItem(LS.FAV);
    state.favorites = raw ? JSON.parse(raw) : {};
  } catch (e) { state.favorites = {}; }
}
function saveFavorites() { localStorage.setItem(LS.FAV, JSON.stringify(state.favorites)); }
function toggleFav(movie) {
  if (state.favorites[movie.id]) {
    delete state.favorites[movie.id];
    toast(`Removed "${movie.title}" from favorites`);
  } else {
    state.favorites[movie.id] = movie;
    toast(`Added "${movie.title}" to favorites`);
  }
  saveFavorites();
  renderFavoritesList();
}
function renderFavoritesList() {
  refs.favList.innerHTML = "";
  const movies = Object.values(state.favorites);
  if (!movies.length) { refs.favList.innerHTML = `<div class="muted">No favorites yet.</div>`; return; }
  movies.forEach(m => {
    const it = document.createElement("div"); it.className = "fav-item";
    const img = document.createElement("img"); img.src = posterUrl(m.poster_path, "w154"); img.alt = m.title;
    const meta = document.createElement("div"); meta.style.flex = "1";
    const h = document.createElement("div"); h.textContent = m.title;
    const s = document.createElement("div"); s.className = "meta"; s.textContent = `${m.release_date ? m.release_date.slice(0,4) : "—"} • ⭐ ${m.vote_average ?? "N/A"}`;
    const actions = document.createElement("div");
    const openBtn = document.createElement("button"); openBtn.className = "glass-btn"; openBtn.textContent = "Open"; openBtn.onclick = () => openDetails(m.id);
    const remBtn = document.createElement("button"); remBtn.className = "glass-btn"; remBtn.textContent = "Remove"; remBtn.onclick = () => { delete state.favorites[m.id]; saveFavorites(); renderFavoritesList(); renderGridCurrent(); };
    actions.append(openBtn, remBtn);
    meta.append(h, s, actions);
    it.append(img, meta);
    refs.favList.appendChild(it);
  });
}

/* ---------------------------
   Details modal
   --------------------------- */
async function openDetails(id) {
  try {
    showOverlay("Loading details…");
    refs.modal.setAttribute("aria-hidden", "false");
    refs.modal.style.display = "flex";
    refs.modalBody.innerHTML = "";
    const d = await getMovieDetails(id);
    hideOverlay();

    const poster = posterUrl(d.poster_path, CONFIG.BACKDROP_SIZE);
    const container = document.createElement("div");
    container.style.display = "grid";
    container.style.gridTemplateColumns = "260px 1fr";
    container.style.gap = "14px";
    container.innerHTML = `
      <div>
        ${poster ? `<img src="${poster}" alt="${d.title}" style="width:100%;border-radius:10px;" />` : ""}
      </div>
      <div>
        <h2 id="modalTitle">${d.title} <span style="font-weight:600;color:var(--muted);font-size:14px">(${d.release_date?.slice(0,4) || "—"})</span></h2>
        <p class="meta">${d.tagline || ""}</p>
        <p style="margin-top:8px;color:#cfeff8">${d.overview || ""}</p>
        <div style="margin-top:12px;color:var(--muted)">
          <div>Runtime: ${d.runtime ?? "—"} min</div>
          <div>Genres: ${(d.genres||[]).map(g=>g.name).join(", ") || "—"}</div>
          <div>Revenue: ${d.revenue ? "$" + formatNumber(d.revenue) : "—"}</div>
        </div>
      </div>
    `;

    // cast
    if (d.credits && d.credits.cast && d.credits.cast.length) {
      const castTitle = document.createElement("h3"); castTitle.textContent = "Top cast"; castTitle.style.marginTop = "12px";
      const castContainer = document.createElement("div"); castContainer.style.display = "flex"; castContainer.style.gap = "10px"; castContainer.style.overflow = "auto";
      d.credits.cast.slice(0,12).forEach(c => {
        const cd = document.createElement("div"); cd.style.minWidth = "120px"; cd.innerHTML = `<strong>${c.name}</strong><div class="meta">${c.character}</div>`;
        castContainer.appendChild(cd);
      });
      container.appendChild(document.createElement("div")); // spacer row
      container.appendChild(castTitle);
      container.appendChild(castContainer);
    }

    // trailer
    let trailerLink = null;
    if (d.videos && d.videos.results && d.videos.results.length) {
      const vids = d.videos.results.filter(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
      if (vids.length) {
        trailerLink = `https://www.youtube.com/watch?v=${vids[0].key}`;
        const tr = document.createElement("div");
        tr.style.marginTop = "12px";
        tr.innerHTML = `<a class="glass-btn" href="${trailerLink}" target="_blank" rel="noreferrer">Watch Trailer on YouTube</a>`;
        container.appendChild(tr);
      }
    }

    // favorite action
    const favAction = document.createElement("div");
    favAction.style.marginTop = "12px";
    const favBtn = document.createElement("button"); favBtn.className = "neon-btn"; favBtn.textContent = state.favorites[d.id] ? "Remove Favorite" : "Add Favorite";
    favBtn.onclick = () => { toggleFav(d); favBtn.textContent = state.favorites[d.id] ? "Remove Favorite" : "Add Favorite"; renderFavoritesList(); };
    favAction.appendChild(favBtn);
    container.appendChild(favAction);

    refs.modalBody.appendChild(container);
    refs.modalBody.focus();

    refs.closeModal.onclick = closeModal;
    refs.modal.onclick = (e) => { if (e.target === refs.modal) closeModal(); };

  } catch (e) {
    hideOverlay();
    console.error(e);
    toast("Failed to load details: " + e.message);
    refs.modal.setAttribute("aria-hidden", "true");
    refs.modal.style.display = "none";
  }
}

function closeModal() {
  refs.modal.setAttribute("aria-hidden", "true");
  refs.modal.style.display = "none";
}

/* ---------------------------
   Fetch & render flow
   --------------------------- */
async function loadAndRender({ reset=true } = {}) {
  try {
    state.loading = true;
    showOverlay("Loading movies…");
    refs.status.textContent = "Loading…";

    let resp;
    const q = state.query?.trim();
    if (q) resp = await searchMovies(q, state.page);
    else {
      if (state.mode === "discover" || state.genre || state.year || state.sort !== "popularity.desc") resp = await discover(state.page);
      else resp = await listMode(state.mode, state.page);
    }

    const list = resp.results || [];
    state.totalPages = resp.total_pages || 1;

    renderMovies(list, { append: !reset });
    refs.status.textContent = `${list.length} loaded (page ${state.page})`;
    refs.pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;

    state.loading = false;
    hideOverlay();

    // prefetch next page
    prefetchNext();

  } catch (e) {
    state.loading = false;
    hideOverlay();
    console.error("loadAndRender", e);
    toast("Failed to load movies: " + e.message);
    refs.status.textContent = "Failed to load results.";
  }
}

/* pagination helpers */
function gotoPage(n) {
  if (n < 1) n = 1;
  if (n > state.totalPages) n = state.totalPages;
  state.page = n;
  loadAndRender({ reset: true });
}
refs.firstBtn.onclick = () => gotoPage(1);
refs.prevBtn.onclick = () => gotoPage(state.page - 1);
refs.nextBtn.onclick = () => gotoPage(state.page + 1);
refs.lastBtn.onclick = () => gotoPage(state.totalPages);
refs.loadMore.onclick = () => {
  if (state.page < state.totalPages) {
    state.page += 1;
    loadAndRender({ reset: false });
  }
};

/* infinite scroll */
function setupInfinite() {
  if (state.infiniteObserver) state.infiniteObserver.disconnect();
  if (!state.infinite) return;
  const sentinel = document.createElement("div");
  sentinel.id = "infinite-sentinel";
  document.body.appendChild(sentinel);
  if ('IntersectionObserver' in window) {
    state.infiniteObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !state.loading && state.page < state.totalPages) {
          state.page += 1;
          loadAndRender({ reset: false });
        }
      });
    }, { rootMargin: "400px" });
    state.infiniteObserver.observe(sentinel);
  }
}

function prefetchNext() {
  if (state.page < state.totalPages) {
    const next = state.page + 1;
    const q = state.query?.trim();
    if (q) searchMovies(q, next).catch(()=>{});
    else if (state.mode === "discover" || state.genre || state.year || state.sort !== "popularity.desc") discover(next).catch(()=>{});
    else listMode(state.mode, next).catch(()=>{});
  }
}

/* ---------------------------
   UI wiring
   --------------------------- */
function wireEvents() {
  // theme
  refs.themeToggle.addEventListener("click", toggleTheme);

  // search debounced
  let timer = null;
  refs.searchInput.addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.query = refs.searchInput.value.trim();
      state.page = 1;
      loadAndRender({ reset: true });
    }, 420);
  });
  refs.clearSearch.addEventListener("click", () => {
    refs.searchInput.value = ""; state.query = ""; state.page = 1; loadAndRender({ reset: true });
  });

  // mode
  refs.modeSelect.addEventListener("change", (e) => {
    state.mode = e.target.value;
    state.page = 1;
    loadAndRender({ reset: true });
  });

  // year slider
  refs.yearRange.addEventListener("input", (e) => refs.yearOutput.textContent = e.target.value);
  refs.yearRange.addEventListener("change", (e) => { state.year = e.target.value; });

  // filters
  refs.applyFilters.addEventListener("click", () => { state.genre = refs.genreSelect.value; state.sort = refs.sortSelect.value; state.page = 1; state.mode = "discover"; loadAndRender({ reset: true }); });
  refs.clearFilters.addEventListener("click", () => { refs.genreSelect.value = ""; refs.yearRange.value = new Date().getFullYear(); refs.yearOutput.textContent = refs.yearRange.value; refs.sortSelect.value = "popularity.desc"; state.genre = ""; state.year = refs.yearRange.value; state.sort = "popularity.desc"; state.page = 1; loadAndRender({ reset: true }); });

  // infinite toggle
  refs.infiniteToggle.addEventListener("change", (e) => {
    state.infinite = e.target.checked;
    if (state.infinite) {
      setupInfinite();
      document.querySelector(".pagination").style.display = "none";
    } else {
      if (state.infiniteObserver) state.infiniteObserver.disconnect();
      document.querySelector(".pagination").style.display = "";
    }
  });

  // clear cache
  refs.clearCache.addEventListener("click", clearCache);

  // favorites panel
  refs.favToggle.addEventListener("click", () => {
    refs.favoritesPanel.setAttribute("aria-hidden", "false");
    refs.favoritesPanel.style.transform = "translateX(0)";
    renderFavoritesList();
  });
  refs.closeFav.addEventListener("click", () => {
    refs.favoritesPanel.setAttribute("aria-hidden", "true");
    refs.favoritesPanel.style.transform = "translateX(110%)";
  });
  refs.clearFav.addEventListener("click", () => {
    if (confirm("Clear favorites?")) { state.favorites = {}; saveFavorites(); renderFavoritesList(); loadAndRender({ reset:true }); }
  });

  // modal close
  refs.closeModal.addEventListener("click", closeModal);

  // keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "/") { e.preventDefault(); refs.searchInput.focus(); refs.searchInput.select(); }
    if (e.key === "f") { refs.favToggle.click(); }
    if (e.key === "t") { refs.themeToggle.click(); }
    if (e.key === "?") { alert("Shortcuts:\n/ focus search\nf open favorites\nt toggle theme\nClick a card for details."); }
  });

  // network
  window.addEventListener("online", () => { refs.offline.classList.add("hidden"); toast("You are online"); });
  window.addEventListener("offline", () => { refs.offline.classList.remove("hidden"); toast("Offline — using cache if available"); });

  // pagination controls wired above in gotoPage functions
}

/* ---------------------------
   Render favorites & grid
   --------------------------- */
function renderGridCurrent() {
  // re-render current page from cache if possible
  state.page = Math.max(1, Math.min(state.page, state.totalPages));
  loadAndRender({ reset:true });
}

/* ---------------------------
   Startup
   --------------------------- */
async function init() {
  try {
    // restore theme
    const savedTheme = localStorage.getItem(LS.THEME) || "neon";
    document.body.className = savedTheme === "neon" ? "theme-neon" : "theme-neon";

    // set defaults
    refs.yearRange.value = state.year;
    refs.yearOutput.textContent = state.year;
    refs.sortSelect.value = state.sort;

    setupLazyObserver();
    wireEvents();

    // load favorites
    loadFavorites();
    renderFavoritesList();

    // populate genres
    try {
      const g = await getGenres();
      (g.genres || []).forEach(gen => {
        const opt = document.createElement("option"); opt.value = gen.id; opt.textContent = gen.name;
        refs.genreSelect.appendChild(opt);
      });
    } catch (e) { console.warn("Failed to load genres", e); }

    // initial load
    await loadAndRender({ reset:true });

    // show toast
    toast("Welcome to Neon MovieExplorer!");
  } catch (e) {
    console.error("init failed", e);
    toast("Initialization error: " + e.message, 6000);
  }
}

/* ---------------------------
   Overlay helpers
   --------------------------- */
function showOverlay(msg="") { refs.overlay.classList.remove("hidden"); refs.overlay.setAttribute("aria-hidden","false"); refs.status.textContent = msg || "Loading…"; }
function hideOverlay() { refs.overlay.classList.add("hidden"); refs.overlay.setAttribute("aria-hidden","true"); refs.status.textContent = "Ready."; }

/* ---------------------------
   Favorites persistence
   --------------------------- */
function saveFavorites() { localStorage.setItem(LS.FAV, JSON.stringify(state.favorites)); }
function loadFavorites() { try { state.favorites = JSON.parse(localStorage.getItem(LS.FAV) || "{}"); } catch(e) { state.favorites = {}; } }

/* ---------------------------
   Theme toggle
   --------------------------- */
function toggleTheme() {
  // merely visual — we have only neon theme currently; keep toggle for possible extension
  const cur = localStorage.getItem(LS.THEME) || "neon";
  const next = cur === "neon" ? "neon" : "neon";
  localStorage.setItem(LS.THEME, next);
  document.body.className = "theme-neon";
  toast("Theme toggled");
}
refs.themeToggle.addEventListener("click", toggleTheme);

/* ---------------------------
   Helpers: search/discover wrappers
   --------------------------- */
async function searchMovies(q, page=1) { return searchMovies_api(q, page); }
async function searchMovies_api(q, page=1) { return tmdbFetch("/search/movie", { query:q, page, include_adult:false, language:"en-US" }); }

/* ---------------------------
   Start the app
   --------------------------- */
init();