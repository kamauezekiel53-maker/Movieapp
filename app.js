// Put this file as app.js
// TMDB API key you gave:
const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMAGE_W500 = 'https://image.tmdb.org/t/p/w500';
const IMAGE_ORIG = 'https://image.tmdb.org/t/p/original';

// DOM refs
const heroImg = document.getElementById('hero-img');
const heroTitle = document.getElementById('hero-title');
const heroDesc = document.getElementById('hero-desc');
const playBtn = document.getElementById('play-btn');

const trendingRow = document.getElementById('trending');
const topRatedRow = document.getElementById('toprated');
const actionRow = document.getElementById('action');

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// Small helper for fetch
async function tmdbFetch(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  return res.json();
}

// Fetch & render initial data
async function init() {
  try {
    // trending (TMDB "popular")
    const trending = await tmdbFetch('/movie/popular', { language: 'en-US', page: 1 });
    renderRow(trendingRow, trending.results);

    // top rated
    const toprated = await tmdbFetch('/movie/top_rated', { language: 'en-US', page: 1 });
    renderRow(topRatedRow, toprated.results);

    // action (discover by genre id 28 = Action)
    const action = await tmdbFetch('/discover/movie', { with_genres: '28', sort_by: 'popularity.desc', language:'en-US', page:1 });
    renderRow(actionRow, action.results);

    // hero - pick the first trending movie with a backdrop
    const heroMovie = trending.results.find(m => m.backdrop_path) || trending.results[0];
    renderHero(heroMovie);
  } catch (err) {
    console.error(err);
    heroTitle.innerText = 'Failed to load movies';
    heroDesc.innerText = '';
  }
}

// Render one horizontal row of posters
function renderRow(container, movies = []) {
  container.innerHTML = '';
  movies.forEach(movie => {
    const img = document.createElement('img');
    img.className = 'poster';
    img.alt = movie.title || movie.name;
    img.loading = 'lazy';
    img.src = movie.poster_path ? IMAGE_W500 + movie.poster_path : '';
    img.addEventListener('click', () => onPosterClick(movie));
    container.appendChild(img);
  });
}

// Hero rendering & play button handler
function renderHero(movie) {
  if (!movie) return;
  heroImg.src = movie.backdrop_path ? IMAGE_ORIG + movie.backdrop_path : (movie.poster_path ? IMAGE_W500 + movie.poster_path : '');
  heroTitle.innerText = movie.title || movie.name;
  heroDesc.innerText = movie.overview ? truncate(movie.overview, 220) : 'No description available.';
  playBtn.onclick = () => openMovieTrailer(movie.id, movie.title || movie.name);
}

// Clicking a poster shows hero details for that movie
function onPosterClick(movie) {
  renderHero(movie);
  // scroll window up to hero on small screens
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Open trailer using TMDB videos -> prefer YouTube trailer (will open new tab)
async function openMovieTrailer(movieId, title = '') {
  try {
    const data = await tmdbFetch(`/movie/${movieId}/videos`, { language: 'en-US' });
    // prefer trailers with type "Trailer" and site "YouTube"
    const trailer = data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') || data.results.find(v => v.site === 'YouTube');
    if (trailer) {
      const YOUTUBE = `https://www.youtube.com/watch?v=${trailer.key}`;
      window.open(YOUTUBE, '_blank');
    } else {
      alert('Trailer not available. Opening movie page on TMDB.');
      window.open(`https://www.themoviedb.org/movie/${movieId}`, '_blank');
    }
  } catch (err) {
    console.error(err);
    alert('Failed to fetch trailer.');
  }
}

function truncate(text, n) {
  return text && text.length > n ? text.slice(0, n-1) + '…' : text;
}

/* Search functionality */
searchBtn.addEventListener('click', onSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSearch(); });

async function onSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  try {
    const results = await tmdbFetch('/search/movie', { query: q, language:'en-US', page:1, include_adult:false });
    // show results in trending row (quick UX)
    if (results.results.length) {
      renderRow(trendingRow, results.results);
      // set first as hero
      const first = results.results.find(m => m.backdrop_path) || results.results[0];
      if (first) renderHero(first);
      window.scrollTo({ top: 420, behavior: 'smooth' });
    } else {
      alert('No results found.');
    }
  } catch (err) {
    console.error(err);
    alert('Search failed.');
  }
}

// Initialize
init();