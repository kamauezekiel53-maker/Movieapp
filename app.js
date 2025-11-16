/**
 * app.js
 * MovieExplorer — Long, feature-rich single-page app in plain JavaScript.
 *
 * Features:
 * - TMDB integration (popular / top rated / now playing / upcoming / trending)
 * - Search with debounce
 * - Genre filter & year slider & sorting
 * - Favorites (localStorage) with drawer
 * - Movie details modal (with credits & trailer where available)
 * - Lazy image loading with IntersectionObserver
 * - Infinite scroll or manual pagination
 * - Caching (sessionStorage) and offline detection
 * - Keyboard shortcuts: / to focus search, f favorites, t toggle theme, ? help
 * - Toast notifications, loading overlay, error handling
 * - Accessible ARIA attributes and focus management
 *
 * Replace YOUR_TMDB_API_KEY with your TMDB API key
 */

/* =========================
   Configuration & Helpers
   ========================= */
const CONFIG = {
  TMDB_KEY: "YOUR_TMDB_API_KEY", // <-- REPLACE with your TMDB key
  TMDB_BASE: "https://api.themoviedb.org/3",
  IMAGE_BASE: "https://image.tmdb.org/t/p",
  DEFAULT_POSTER_SIZE: "w342",
  DEFAULT_BACKDROP_SIZE: "w780",
  CACHE_TTL_MS: 1000 * 60 * 60, // 1 hour cache TTL
  MAX_CACHE_ITEMS: 120
};

if (!CONFIG.TMDB_KEY || CONFIG.TMDB_KEY === "YOUR_TMDB_API_KEY") {
  console.warn("TMDB API key not provided. Replace CONFIG.TMDB_KEY in app.js with your TMDB key.");
}

/* DOM refs */
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const refs = {
  search: $("#search"),
  mode: $("#mode"),
  genre: $("#genre"),
  year: $("#year"),
  yearOut: $("#yearOut"),
  sort: $("#sort"),
  applyFilters: $("#applyFilters"),
  clearFilters: $("#clearFilters"),
  grid: $("#grid"),
  overlay: $("#overlay"),
  toasts: $("#toasts"),
  modal: $("#modal"),
  modalBody: $("#modalBody"),
  closeModal: $("#closeModal"),
  favorites: $("#favorites"),
  favoritesToggle: $("#favoritesToggle"),
  favoritesList: $("#favList"),
  closeFav: $("#closeFav"),
  clearFav: $("#clearFav"),
  loadMore: $("#loadMore"),
  pageInfo: $("#pageInfo"),
  prevPage: $("#prevPage"),
  nextPage: $("#nextPage"),
  firstPage: $("#firstPage"),
  lastPage: $("#lastPage"),
  infiniteToggle: $("#infiniteToggle"),
  pagination: $("#pagination"),
  status: $("#status"),
  clearCache: $("#clearCache"),
  themeToggle: $("#themeToggle"),
  offlineBanner: $("#offline"),
  brand: $("#brand"),
};

/* state */
const state = {
  page: 1,
  totalPages: 1,
  perPage: 20,
  mode: "popular",
  query: "",
  genre: "",
  year: new Date().getFullYear(),
  sort: "popularity.desc",
  loading: false,
  infinite: false,
  favorites: {}, // {id: movie}
  cacheMap: new Map(),
  lazyObserver: null,
  fetchingIds: new Set(),
};

/* -------------------------
   Basic utilities
   ------------------------- */
const $overlay = refs.overlay;
function showOverlay(msg = "") {
  refs.status.textContent = msg || "Loading…";
  $overlay.classList.remove("hidden");
}
function hideOverlay() {
  refs.status.textContent = "Ready.";
  $overlay.classList.add("hidden");
}
function toast(text, opts = {}) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  refs.toasts.appendChild(t);
  const ms = opts.time ?? 4200;
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/* -------------------------
   Storage helpers: favorites & cache
   ------------------------- */
const favKey = "movieexplorer:favorites:v1";
function loadFavorites() {
  try {
    const raw = localStorage.getItem(favKey);
    state.favorites = raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Failed to parse favorites:", e);
    state.favorites = {};
  }
}
function saveFavorites() {
  try {
    localStorage.setItem(favKey, JSON.stringify(state.favorites));
  } catch (e) {
    console.error("Failed to save favorites:", e);
  }
}
function addFavorite(movie) {
  state.favorites[movie.id] = movie;
  saveFavorites();
  renderFavorites();
  toast(`Added "${movie.title}" to favorites`);
}
function removeFavorite(id) {
  const title = state.favorites[id]?.title || "movie";
  delete state.favorites[id];
  saveFavorites();
  renderFavorites();
  toast(`Removed "${title}" from favorites`);
}

/* Simple in-memory + sessionStorage cache */
const cachePrefix = "movieexplorer:cache:v1:";
function cacheSet(key, value) {
  try {
    const payload = { ts: Date.now(), value };
    sessionStorage.setItem(cachePrefix + key, JSON.stringify(payload));
    // track keys and enforce max
    state.cacheMap.set(key, payload.ts);
    if (state.cacheMap.size > CONFIG.MAX_CACHE_ITEMS) {
      // remove oldest
      const oldest = Array.from(state.cacheMap.entries()).sort((a,b)=>a[1]-b[1])[0];
      if (oldest) {
        sessionStorage.removeItem(cachePrefix + oldest[0]);
        state.cacheMap.delete(oldest[0]);
      }
    }
  } catch (e) {
    // session storage might be not available
    console.warn("cacheSet failed", e);
  }
}
function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(cachePrefix + key);
    if (!raw) return null;
    const { ts, value } = JSON.parse(raw);
    if (Date.now() - ts > CONFIG.CACHE_TTL_MS) {
      sessionStorage.removeItem(cachePrefix + key);
      state.cacheMap.delete(key);
      return null;
    }
    state.cacheMap.set(key, ts);
    return value;
  } catch (e) {
    return null;
  }
}
function clearCache() {
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith(cachePrefix)) sessionStorage.removeItem(k);
    });
    state.cacheMap.clear();
    toast("Cache cleared");
  } catch (e) {
    console.warn("clearCache failed", e);
  }
}

/* -------------------------
   Network helpers & TMDB wrapper
   ------------------------- */
async function tmdbFetch(path, params = {}) {
  const url = new URL(`${CONFIG.TMDB_BASE}${path}`);
  url.searchParams.set("api_key", CONFIG.TMDB_KEY);
  Object.entries(params).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const cacheKey = url.pathname + "?" + url.searchParams.toString();
  // check cache
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TMDB ${res.status}: ${text}`);
  }
  const j = await res.json();
  cacheSet(cacheKey, j);
  return j;
}

/* High-level endpoints */
async function getGenres() {
  return tmdbFetch("/genre/movie/list", { language: "en-US" });
}
async function discoverMovies(page = 1, extra = {}) {
  // uses /discover/movie for filtered searches (allows year, genre, sort)
  const params = {
    language: "en-US",
    sort_by: state.sort,
    page,
    include_adult: false,
    with_genres: state.genre || undefined,
    primary_release_year: state.year ? state.year : undefined,
    ...extra
  };
  return tmdbFetch("/discover/movie", params);
}
async function searchMovies(query, page = 1) {
  return tmdbFetch("/search/movie", { query, page, include_adult: false, language: "en-US" });
}
async function tmdbList(type, page = 1) {
  if (type === "trending") {
    return tmdbFetch("/trending/movie/week", { page });
  }
  return tmdbFetch(`/movie/${type}`, { language: "en-US", page });
}
async function getMovieDetails(id) {
  return tmdbFetch(`/movie/${id}`, { append_to_response: "credits,videos,images" });
}

/* -------------------------
   Rendering helpers
   ------------------------- */
function posterUrl(path, size = CONFIG.DEFAULT_POSTER_SIZE) {
  return path ? `${CONFIG.IMAGE_BASE}/${size}${path}` : "";
}

/* IntersectionObserver for lazy images */
function setupLazyLoader() {
  if ('IntersectionObserver' in window) {
    state.lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const src = img.dataset.src;
        if (src) img.src = src;
        img.classList.remove("loading");
        state.lazyObserver.unobserve(img);
      });
    }, { rootMargin: '200px 0px' });
  } else {
    state.lazyObserver = null;
  }
}

/* Build a card DOM node for a movie object */
function buildCard(movie) {
  const card = document.createElement("article");
  card.className = "card";
  card.setAttribute("role", "article");
  card.dataset.id = movie.id;

  const poster = document.createElement("img");
  poster.alt = movie.title || "Poster";
  poster.className = "poster loading";
  poster.width = 342;
  // lazy load via data-src
  poster.dataset.src = posterUrl(movie.poster_path) || "";
  poster.onerror = () => { poster.src = ""; poster.alt = "No image"; poster.style.background = "linear-gradient(90deg,#111,#333)"; };
  if (state.lazyObserver) state.lazyObserver.observe(poster);
  else poster.src = poster.dataset.src;

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "title";
  title.textContent = movie.title;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${movie.release_date ? movie.release_date.slice(0,4) : "—"} • ${movie.vote_average ?? "N/A"}`;

  const overview = document.createElement("p");
  overview.className = "overview";
  overview.textContent = movie.overview || "";

  const actions = document.createElement("div");
  actions.className = "actions";

  const detailsBtn = document.createElement("button");
  detailsBtn.className = "btn small";
  detailsBtn.textContent = "Details";
  detailsBtn.addEventListener("click", () => openDetails(movie.id, card));

  const favBtn = document.createElement("button");
  favBtn.className = "btn small";
  favBtn.textContent = state.favorites[movie.id] ? "Unfavorite" : "Favorite";
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.favorites[movie.id]) removeFavorite(movie.id);
    else addFavorite(movie);
    favBtn.textContent = state.favorites[movie.id] ? "Unfavorite" : "Favorite";
  });

  const tmdbLink = document.createElement("a");
  tmdbLink.href = `https://www.themoviedb.org/movie/${movie.id}`;
  tmdbLink.target = "_blank";
  tmdbLink.rel = "noreferrer noopener";
  tmdbLink.className = "btn small";
  tmdbLink.textContent = "TMDB";

  actions.append(detailsBtn, favBtn, tmdbLink);

  body.append(title, meta, overview, actions);
  card.append(poster, body);

  // click card to open details
  card.addEventListener("click", (e) => {
    // prevent triggering when clicking a button or link inside
    if (e.target.tagName.toLowerCase() === "button" || e.target.tagName.toLowerCase() === "a") return;
    openDetails(movie.id, card);
  });

  return card;
}

/* Render a list of movies into the grid */
function renderMovies(list, { append = false } = {}) {
  refs.grid.setAttribute("aria-busy", "true");
  if (!append) refs.grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  list.forEach(movie => {
    frag.appendChild(buildCard(movie));
  });
  refs.grid.appendChild(frag);
  refs.grid.setAttribute("aria-busy", "false");

  // attach lazy observer to images already in DOM if any
  if (state.lazyObserver) {
    $$("img.poster.loading").forEach(img => state.lazyObserver.observe(img));
  }

  // update pagination info
  refs.pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
}

/* -------------------------
   Favorites UI rendering
   ------------------------- */
function renderFavorites() {
  const container = refs.favoritesList;
  container.innerHTML = "";
  const movies = Object.values(state.favorites || {});
  if (!movies.length) {
    container.innerHTML = `<div class="muted">No favorites yet — click "Favorite" on any movie.</div>`;
    return;
  }
  movies.forEach(m => {
    const item = document.createElement("div");
    item.className = "fav-item";
    const img = document.createElement("img");
    img.src = posterUrl(m.poster_path, "w154") || "";
    img.alt = m.title;
    const meta = document.createElement("div");
    meta.style.flex = "1";
    const h = document.createElement("div");
    h.textContent = m.title;
    const s = document.createElement("div");
    s.className = "meta";
    s.textContent = `${m.release_date ? m.release_date.slice(0,4) : "—"} • ${m.vote_average ?? "N/A"}`;
    const actions = document.createElement("div");
    actions.style.marginTop = "6px";
    const openBtn = document.createElement("button");
    openBtn.className = "btn small";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => openDetails(m.id));
    const rem = document.createElement("button");
    rem.className = "btn small muted";
    rem.textContent = "Remove";
    rem.addEventListener("click", () => removeFavorite(m.id));
    actions.appendChild(openBtn);
    actions.appendChild(rem);
    meta.append(h, s, actions);
    item.append(img, meta);
    container.appendChild(item);
  });
}

/* -------------------------
   Details modal & trailer embed
   ------------------------- */
async function openDetails(id, sourceCard) {
  if (!id) return;
  try {
    // focus trap: remember active element to restore later
    const prevActive = document.activeElement;
    showOverlay("Loading details…");
    refs.modal.setAttribute("aria-hidden", "false");
    refs.modal.style.display = "flex";
    refs.modalBody.innerHTML = ""; // clear
    const data = await getMovieDetails(id);
    hideOverlay();

    // Build details
    const container = document.createElement("div");
    container.className = "details";
    const row = document.createElement("div");
    row.style.display = "flex"; row.style.gap = "14px"; row.style.alignItems = "flex-start";

    const poster = document.createElement("img");
    poster.src = posterUrl(data.poster_path, CONFIG.DEFAULT_BACKDROP_SIZE) || "";
    poster.alt = data.title;
    poster.style.width = "260px";
    poster.style.borderRadius = "8px";
    poster.onerror = () => poster.style.display = "none";

    const meta = document.createElement("div");
    meta.style.flex = "1";

    const title = document.createElement("h2");
    title.textContent = `${data.title} (${data.release_date ? data.release_date.slice(0,4) : "—"})`;

    const tagline = document.createElement("div");
    tagline.className = "meta";
    tagline.style.marginBottom = "8px";
    tagline.textContent = data.tagline || "";

    const overview = document.createElement("p");
    overview.textContent = data.overview || "";

    const infoList = document.createElement("ul");
    infoList.className = "meta";
    infoList.style.display = "flex";
    infoList.style.gap = "12px";
    infoList.style.listStyle = "none";
    infoList.style.padding = "0";
    infoList.innerHTML = `
      <li>Runtime: ${data.runtime ?? "—"} min</li>
      <li>Genres: ${(data.genres||[]).map(g=>g.name).join(", ") || "—"}</li>
      <li>Budget: ${data.budget ? "$" + numberWithCommas(data.budget) : "—"}</li>
      <li>Revenue: ${data.revenue ? "$" + numberWithCommas(data.revenue) : "—"}</li>
    `;

    meta.append(title, tagline, overview, infoList);

    // cast list
    if (data.credits && data.credits.cast && data.credits.cast.length) {
      const castTitle = document.createElement("h3");
      castTitle.textContent = "Top Cast";
      castTitle.style.marginTop = "12px";
      const castRow = document.createElement("div");
      castRow.style.display = "flex";
      castRow.style.gap = "12px";
      castRow.style.overflow = "auto";
      (data.credits.cast.slice(0,12)).forEach(c => {
        const cdiv = document.createElement("div");
        cdiv.style.minWidth = "120px";
        cdiv.style.fontSize = ".9rem";
        cdiv.innerHTML = `<strong>${c.name}</strong><div class="meta">${c.character}</div>`;
        castRow.appendChild(cdiv);
      });
      meta.append(castTitle, castRow);
    }

    row.append(poster, meta);
    container.appendChild(row);

    // videos (trailers)
    if (data.videos && data.videos.results && data.videos.results.length) {
      const vids = data.videos.results.filter(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
      if (vids.length) {
        const vid = vids[0];
        const iframeWrap = document.createElement("div");
        iframeWrap.style.marginTop = "12px";
        iframeWrap.innerHTML = `<h3>Trailer</h3><div style="position:relative;padding-top:56%;height:0;overflow:hidden;border-radius:8px;margin-top:6px;">
          <iframe src="https://www.youtube.com/embed/${vid.key}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
        </div>`;
        container.appendChild(iframeWrap);
      }
    }

    // add to modal body
    refs.modalBody.appendChild(container);
    // focus modal for accessibility
    refs.modalBody.focus();

    // allow closing
    refs.closeModal.onclick = () => {
      refs.modal.setAttribute("aria-hidden", "true");
      refs.modal.style.display = "none";
      if (prevActive) prevActive.focus();
    };

  } catch (e) {
    hideOverlay();
    console.error("openDetails", e);
    toast("Failed to load details: " + e.message);
    refs.modal.setAttribute("aria-hidden", "true");
    refs.modal.style.display = "none";
  }
}
function numberWithCommas(x){ return x?.toString()?.replace(/\B(?=(\d{3})+(?!\d))/g, ",") ?? x; }

/* -------------------------
   Search / discover flow
   ------------------------- */
let searchTimer = null;
function debounceSearch(cb, wait = 500) {
  return (...args) => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => cb(...args), wait);
  };
}

async function loadAndRender({ reset = true } = {}) {
  // decide which method to fetch
  const q = state.query?.trim();
  try {
    state.loading = true;
    showOverlay("Fetching movies…");
    let resp;

    if (q) {
      // search route
      resp = await searchMovies(q, state.page);
    } else {
      // use discover (with filters) OR lists (popular/top_rated...)
      if (state.mode === "discover" || state.genre || state.year || state.sort !== "popularity.desc") {
        resp = await discoverMovies(state.page);
      } else if (state.mode === "trending") {
        resp = await tmdbList("trending", state.page);
      } else {
        resp = await tmdbList(state.mode, state.page);
      }
    }

    // If the TMDB result contains 'results' use that (typical), otherwise handle different formats
    const list = resp.results || (Array.isArray(resp) ? resp : []);
    state.totalPages = resp.total_pages || 1;

    if (reset) {
      refs.grid.innerHTML = "";
    }

    renderMovies(list, { append: !reset });

    // update UI controls
    refs.pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
    refs.prevPage.disabled = state.page <= 1;
    refs.firstPage.disabled = state.page <= 1;
    refs.nextPage.disabled = state.page >= state.totalPages;
    refs.lastPage.disabled = state.page >= state.totalPages;

    // show small status
    refs.status.textContent = `${list.length} movies loaded (page ${state.page})`;

    hideOverlay();
    state.loading = false;
  } catch (e) {
    hideOverlay();
    state.loading = false;
    console.error("loadAndRender", e);
    toast("Failed to fetch movies: " + e.message);
    refs.status.textContent = "Failed to load results.";
  }
}

/* Pagination controls */
function gotoPage(n) {
  if (n < 1) n = 1;
  if (n > state.totalPages) n = state.totalPages;
  state.page = n;
  loadAndRender({ reset: true });
}
refs.prevPage.onclick = () => gotoPage(state.page - 1);
refs.nextPage.onclick = () => gotoPage(state.page + 1);
refs.firstPage.onclick = () => gotoPage(1);
refs.lastPage.onclick = () => gotoPage(state.totalPages);
refs.loadMore.onclick = () => {
  if (state.page < state.totalPages) {
    state.page += 1;
    loadAndRender({ reset: false });
  }
};

/* Infinite scroll */
let infiniteScrollObserver = null;
function setupInfiniteScroll() {
  if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
  if (!refs.infiniteToggle.checked) return;
  const sentinel = document.createElement("div");
  sentinel.id = "infinite-sentinel";
  document.body.appendChild(sentinel);
  if ('IntersectionObserver' in window) {
    infiniteScrollObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !state.loading && state.page < state.totalPages) {
          state.page += 1;
          loadAndRender({ reset: false });
        }
      });
    }, { rootMargin: '400px' });
    infiniteScrollObserver.observe(sentinel);
  }
}

/* -------------------------
   Genres dropdown population
   ------------------------- */
async function populateGenres() {
  try {
    const j = await getGenres();
    const list = j.genres || [];
    refs.genre.innerHTML = `<option value="">All genres</option>`;
    list.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name;
      refs.genre.appendChild(opt);
    });
  } catch (e) {
    console.warn("populateGenres failed", e);
  }
}

/* -------------------------
   Startup & event wiring
   ------------------------- */
function wireEvents() {
  // Search: key '/' focuses search input
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== refs.search) {
      e.preventDefault();
      refs.search.focus();
      refs.search.select();
      return;
    }
    if (e.key === "f") {
      openFavorites();
    }
    if (e.key === "t") {
      toggleTheme();
    }
    if (e.key === "?") {
      alert("Help:\n/ focus search\nf open favorites\nt toggle theme\nClick a movie card for details.");
    }
  });

  // search input: debounce
  const doSearch = debounceSearch(() => {
    state.query = refs.search.value.trim();
    state.page = 1;
    loadAndRender({ reset: true });
  }, 420);
  refs.search.addEventListener("input", doSearch);

  // mode change (popular, top_rated, etc.)
  refs.mode.addEventListener("change", (e) => {
    state.mode = e.target.value;
    state.page = 1;
    loadAndRender({ reset: true });
  });

  // year slider
  refs.year.addEventListener("input", (e) => {
    refs.yearOut.value = e.target.value;
  });
  refs.year.addEventListener("change", (e) => {
    state.year = e.target.value;
  });
  refs.yearOut.textContent = refs.year.value;

  // sort & genre & apply/clear
  refs.sort.addEventListener("change", () => { state.sort = refs.sort.value; });
  refs.genre.addEventListener("change", () => { state.genre = refs.genre.value; });
  refs.applyFilters.addEventListener("click", () => {
    state.page = 1;
    // if any filter is active, set mode to discover for discover endpoint
    state.mode = (state.genre || state.year || state.sort !== "popularity.desc") ? "discover" : state.mode;
    loadAndRender({ reset: true });
  });
  refs.clearFilters.addEventListener("click", () => {
    refs.genre.value = "";
    refs.year.value = new Date().getFullYear();
    refs.sort.value = "popularity.desc";
    refs.yearOut.value = refs.year.value;
    state.genre = "";
    state.year = refs.year.value;
    state.sort = "popularity.desc";
    state.page = 1;
    loadAndRender({ reset: true });
  });

  // favorites drawer toggles
  refs.favoritesToggle.addEventListener("click", openFavorites);
  refs.closeFav.addEventListener("click", closeFavorites);
  refs.clearFav.addEventListener("click", () => {
    if (confirm("Clear all favorites?")) {
      state.favorites = {};
      saveFavorites();
      renderFavorites();
    }
  });

  // infinite toggle
  refs.infiniteToggle.addEventListener("change", () => {
    if (refs.infiniteToggle.checked) {
      setupInfiniteScroll();
      refs.pagination.style.display = "none";
    } else {
      if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
      refs.pagination.style.display = "";
    }
  });

  refs.clearCache.addEventListener("click", clearCache);
  refs.themeToggle.addEventListener("click", toggleTheme);

  // network events
  window.addEventListener("online", () => {
    refs.offlineBanner.classList.add("hidden");
    toast("You are online");
  });
  window.addEventListener("offline", () => {
    refs.offlineBanner.classList.remove("hidden");
    toast("You are offline — some features may be unavailable");
  });
}

/* favorites drawer open/close */
function openFavorites() {
  refs.favorites.setAttribute("aria-hidden", "false");
  refs.favorites.style.transform = "translateX(0)";
  refs.favorites.style.display = "flex";
  refs.favorites.setAttribute("aria-hidden", "false");
  renderFavorites();
}
function closeFavorites() {
  refs.favorites.setAttribute("aria-hidden", "true");
  refs.favorites.style.transform = "translateX(110%)";
}

/* theme toggle */
function toggleTheme() {
  const isDark = document.body.classList.contains("theme-dark");
  if (isDark) {
    document.body.classList.remove("theme-dark");
    document.body.classList.add("theme-light");
    refs.themeToggle.setAttribute("aria-pressed", "true");
    localStorage.setItem("movieexplorer:theme", "light");
  } else {
    document.body.classList.remove("theme-light");
    document.body.classList.add("theme-dark");
    refs.themeToggle.setAttribute("aria-pressed", "false");
    localStorage.setItem("movieexplorer:theme", "dark");
  }
}

/* apply saved theme if present */
function restoreTheme() {
  const t = localStorage.getItem("movieexplorer:theme");
  if (t === "light") {
    document.body.classList.remove("theme-dark");
    document.body.classList.add("theme-light");
  } else {
    document.body.classList.remove("theme-light");
    document.body.classList.add("theme-dark");
  }
}

/* -------------------------
   Boot sequence
   ------------------------- */
async function boot() {
  try {
    restoreTheme();
    setupLazyLoader();
    wireEvents();
    loadFavorites();

    // populate genres for the filter
    populateGenres();

    // initial load: popular movies
    await loadAndRender({ reset: true });

    // observe images for lazy loading
    if (state.lazyObserver) {
      $$("img.poster.loading").forEach(img => state.lazyObserver.observe(img));
    }

    // initialize infinite scroll if toggled
    setup