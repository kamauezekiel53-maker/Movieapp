// Replace with your TMDB API key
const API_KEY = "7cc9abef50e4c94689f48516718607be";
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const YT_EMBED = id => `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;

let state = {
  mode: "popular",
  page: 1,
  query: "",
  genre: "",
  year: "",
  sort: "popularity.desc",
  infinite: false,
  favorites: JSON.parse(localStorage.getItem("reel:favs") || "[]"),
  genres: []
};

/* DOM */
const grid = document.getElementById("grid");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const genreFilter = document.getElementById("genreFilter");
const yearFilter = document.getElementById("yearFilter");
const sortFilter = document.getElementById("sortFilter");
const applyFilters = document.getElementById("applyFilters");
const clearFilters = document.getElementById("clearFilters");
const pageInfo = document.getElementById("pageInfo");
const statusEl = document.getElementById("status");
const infiniteToggle = document.getElementById("infiniteToggle");
const loadMore = document.getElementById("loadMore");
const favoritesBtn = document.getElementById("favoritesBtn");
const themeToggle = document.getElementById("themeToggle");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");
const drawer = document.getElementById("favoritesPanel");
const closeFav = document.getElementById("closeFav");
const clearFav = document.getElementById("clearFav");
const favList = document.getElementById("favList");
const overlay = document.getElementById("overlay");
const offline = document.getElementById("offline");
const toasts = document.getElementById("toasts");

/* Init */
window.addEventListener("DOMContentLoaded", async () => {
  attachTabEvents();
  loadYears();
  await loadGenres();
  await loadMovies(true);
});

/* Events */
searchBtn.onclick = () => { state.query = searchInput.value.trim(); state.page = 1; loadMovies(true); };
clearSearchBtn.onclick = () => { searchInput.value = ""; state.query = ""; state.page = 1; loadMovies(true); };

genreFilter.onchange = e => state.genre = e.target.value;
yearFilter.onchange = e => state.year = e.target.value;
sortFilter.onchange = e => state.sort = e.target.value;

applyFilters.onclick = () => { state.page = 1; loadMovies(true); };
clearFilters.onclick = () => {
  genreFilter.value = ""; yearFilter.value = ""; sortFilter.value = "popularity.desc";
  state.genre = ""; state.year = ""; state.sort = "popularity.desc"; state.page = 1; loadMovies(true);
};

infiniteToggle.onchange = e => state.infinite = e.target.checked;
loadMore.onclick = () => { state.page += 1; loadMovies(false); };

favoritesBtn.onclick = () => drawer.classList.toggle("open");
closeFav.onclick = () => drawer.classList.remove("open");
clearFav.onclick = () => { state.favorites = []; localStorage.setItem("reel:favs", JSON.stringify([])); renderFavorites(); toast("Favorites cleared"); };

themeToggle.onclick = () => {
  const body = document.body;
  const isLight = body.classList.toggle("light");
  status(`Theme: ${isLight ? "Light" : "Dark"}`);
};

closeModal.onclick = () => { modal.setAttribute("aria-hidden", "true"); modalBody.innerHTML = ""; document.body.style.overflow = ""; };

/* Tabs */
function attachTabEvents() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      state.mode = btn.dataset.mode;
      state.page = 1;
      loadMovies(true);
    });
  });
}

/* Fetch helpers */
async function api(path, params = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set("api_key", API_KEY);
  Object.entries(params).forEach(([k, v]) => v !== "" && v != null && url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function status(msg) { statusEl.textContent = msg; }
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  toasts.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

/* Genres & years */
async function loadGenres() {
  const data = await api("/genre/movie/list", { language: "en-US" });
  state.genres = data.genres || [];
  state.genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id; opt.textContent = g.name;
    genreFilter.appendChild(opt);
  });
}
function loadYears() {
  const current = new Date().getFullYear();
  const start = 1950;
  for (let y = current; y >= start; y--) {
    const opt = document.createElement("option");
    opt.value = y; opt.textContent = y;
    yearFilter.appendChild(opt);
  }
}

/* Build query per mode */
function buildQuery() {
  const common = {
    page: state.page,
    sort_by: state.sort
  };
  if (state.genre) common.with_genres = state.genre;
  if (state.year) common.primary_release_year = state.year;

  if (state.query) {
    return { path: "/search/movie", params: { ...common, query: state.query } };
  }
  if (state.mode === "popular" || state.mode === "top_rated" || state.mode === "now_playing" || state.mode === "upcoming") {
    return { path: `/movie/${state.mode}`, params: { page: state.page } };
  }
  return { path: "/discover/movie", params: common };
}

/* Load movies */
async function loadMovies(reset = true) {
  try {
    grid.setAttribute("aria-busy", "true");
    if (reset) renderSkeletons();
    status("Loading...");
    const { path, params } = buildQuery();
    const data = await api(path, params);
    const movies = data.results || [];
    if (reset) grid.innerHTML = "";
    renderMovies(movies);
    pageInfo.textContent = `Page ${state.page}`;
    status(`Loaded ${movies.length} items`);
    if (state.infinite) observeInfinite();
    offline.classList.add("hidden");
  } catch (err) {
    status("Error loading. Showing cached if available.");
    offline.classList.remove("hidden");
  } finally {
    grid.setAttribute("aria-busy", "false");
  }
}

/* Render skeletons */
function renderSkeletons(count = 10) {
  grid.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "card skel skel-anim";
    card.innerHTML = `<div class="poster"></div><div class="card-body"></div>`;
    grid.appendChild(card);
  }
}

/* Render movie cards */
function renderMovies(movies) {
  movies.forEach(m => {
    const poster = m.poster_path ? `${IMG}${m.poster_path}` : "https://placehold.co/400x600?text=No+Image";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${poster}" class="poster" alt="${escapeHtml(m.title)} poster">
      <div class="card-body">
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="meta">
          <span>⭐ ${Number(m.vote_average || 0).toFixed(1)}</span>
          <button class="ghost-btn fav-btn">${isFav(m.id) ? "Saved" : "Save"}</button>
        </div>
        <div class="meta">
          <span class="tag">${(m.release_date || "").slice(0,4) || "—"}</span>
          <span class="tag">${categoryLabel(state.mode)}</span>
        </div>
      </div>
    `;
    card.querySelector(".fav-btn").onclick = (e) => { e.stopPropagation(); toggleFavorite(m); };
    card.onclick = () => openModal(m.id);
    grid.appendChild(card);
  });
}

/* Category label */
function categoryLabel(mode) {
  if (state.query) return "Search";
  switch (mode) {
    case "popular": return "Popular";
    case "top_rated": return "Top Rated";
    case "now_playing": return "Now Playing";
    case "upcoming": return "Upcoming";
    default: return "Discover";
  }
}

/* Favorites */
function isFav(id) { return state.favorites.some(f => f.id === id); }
function toggleFavorite(movie) {
  if (isFav(movie.id)) {
    state.favorites = state.favorites.filter(f => f.id !== movie.id);
    toast("Removed from favorites");
  } else {
    state.favorites.push(movie);
    toast("Added to favorites");
  }
  localStorage.setItem("reel:favs", JSON.stringify(state.favorites));
  renderFavorites();
  // Update buttons
  document.querySelectorAll(".fav-btn").forEach(btn => {
    // No-op: new cards will reflect current state
  });
}
function renderFavorites() {
  favList.innerHTML = "";
  state.favorites.forEach(m => {
    const poster = m.poster_path ? `${IMG}${m.poster_path}` : "https://placehold.co/200x300?text=No+Image";
    const item = document.createElement("div");
    item.className = "card";
    item.innerHTML = `
      <img src="${poster}" class="poster" alt="${escapeHtml(m.title)} poster">
      <div class="card-body">
        <div class="title">${escapeHtml(m.title)}</div>
        <div class="meta">
          <button class="btn play-btn">Play trailer</button>
          <button class="ghost-btn remove-btn">Remove</button>
        </div>
      </div>
    `;
    item.querySelector(".play-btn").onclick = () => openModal(m.id);
    item.querySelector(".remove-btn").onclick = () => { toggleFavorite(m); };
    favList.appendChild(item);
  });
}

/* Modal details + in-app trailer */
async function openModal(id) {
  try {
    overlay.classList.remove("hidden");
    const movie = await api(`/movie/${id}`, { append_to_response: "credits,videos", language: "en-US" });
    const poster = movie.poster_path ? `${IMG}${movie.poster_path}` : "https://placehold.co/400x600?text=No+Image";
    const tagline = movie.tagline || "";
    const cast = (movie.credits?.cast || []).slice(0, 6);
    const yt = (movie.videos?.results || []).find(v => v.site === "YouTube" && v.type === "Trailer");
    const player = yt ? `<iframe class="player" src="${YT_EMBED(yt.key)}" title="Trailer" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>` : `<div class="player"><div style="color:#888;display:grid;place-items:center;height:100%;">Trailer not available</div></div>`;

    modalBody.innerHTML = `
      <img class="modal-poster" src="${poster}" alt="${escapeHtml(movie.title)} poster" />
      <div class="modal-content">
        <div class="modal-title">${escapeHtml(movie.title)}</div>
        <div class="modal-sub">${escapeHtml(tagline)}</div>
        <div class="modal-actions">
          <span class="badge">⭐ ${Number(movie.vote_average || 0).toFixed(1)}</span>
          <span class="badge">${(movie.release_date || "").slice(0,4) || "—"}</span>
          <button class="btn fav-toggle">${isFav(movie.id) ? "Saved" : "Save"}</button>
        </div>
        <p>${escapeHtml(movie.overview || "No overview available.")}</p>
        <div class="meta">
          ${cast.map(c => `<span class="tag">${escapeHtml(c.name)}</span>`).join(" ")}
        </div>
        ${player}
      </div>
    `;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modalBody.querySelector(".fav-toggle").onclick = () => toggleFavorite(movie);
  } catch (e) {
    toast("Failed to load details");
  } finally {
    overlay.classList.add("hidden");
  }
}

/* Infinite scroll */
let observer;
function observeInfinite() {
  if (observer) observer.disconnect();
  const sentinel = document.createElement("div");
  sentinel.style.height = "1px";
  grid.appendChild(sentinel);
  observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      state.page += 1;
      loadMovies(false);
    }
  }, { rootMargin: "200px" });
  observer.observe(sentinel);
}

/* Utilities */
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]));
}

/* Keyboard shortcuts */
document.addEventListener("keydown", (e) => {
  if (e.key === "/") { e.preventDefault(); searchInput.focus(); }
  if (e.key === "f") { drawer.classList.toggle("open"); }
  if (e.key === "t") { themeToggle.click(); }
  if (e.key === "Escape") {
    if (modal.getAttribute("aria-hidden") === "false") closeModal.click();
    drawer.classList.remove("open");
  }
});