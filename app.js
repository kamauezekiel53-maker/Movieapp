const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const moviesRow = document.getElementById('moviesRow');
const seriesRow = document.getElementById('seriesRow');
const animeRow = document.getElementById('animeRow');
const searchInput = document.getElementById('searchInput');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const player = document.getElementById('player');
const trailerContainer = document.getElementById('trailerContainer');
const playerButtons = document.getElementById('playerButtons');
const addFavoriteBtn = document.getElementById('addFavorite');
const closeModal = document.querySelector('.close');

let favorites = JSON.parse(localStorage.getItem('moviehub_favorites')) || [];

// Fetch TMDB data
async function fetchTMDB(type, category='trending') {
  let url = '';
  if(category === 'trending') url = `https://api.themoviedb.org/3/trending/${type}/week?api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results;
}

// Display horizontal row
function displayRow(items, container) {
  container.innerHTML = '';
  items.forEach(movie => {
    const div = document.createElement('div');
    div.className = 'movie';
    div.innerHTML = `
      <img src="${IMG_URL + movie.poster_path}" alt="${movie.title || movie.name}">
      <div class="movie-info">
        <h4>${movie.title || movie.name}</h4>
      </div>
    `;
    div.onclick = () => openModal(movie);
    container.appendChild(div);
  });
}

// Modal
async function openModal(movie) {
  modalTitle.textContent = movie.title || movie.name;
  player.src = '';
  trailerContainer.innerHTML = '';
  playerButtons.innerHTML = '';

  // Trailer
  const res = await fetch(`https://api.themoviedb.org/3/${movie.media_type || 'movie'}/${movie.id}/videos?api_key=${API_KEY}`);
  const data = await res.json();
  const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  if(trailer) {
    trailerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>`;
  }

  // Full movie player buttons
  const tmdbId = movie.id;
  const providers = ['vidsrc','videoverse','hdmovie'];
  providers.forEach(p => {
    const btn = document.createElement('button');
    btn.textContent = `Play on ${p}`;
    btn.onclick = () => player.src = getPlayerURL(p, tmdbId);
    playerButtons.appendChild(btn);
  });

  addFavoriteBtn.onclick = () => addFavorite(movie);
  modal.style.display = 'flex';
}

function getPlayerURL(provider, tmdbId) {
  if(provider==='vidsrc') return `https://vidsrc.to/embed/movie/${tmdbId}`;
  if(provider==='videoverse') return `https://videoverse.cloud/embed/movie/${tmdbId}`;
  if(provider==='hdmovie') return `https://hidemovies.xyz/embed/${tmdbId}`;
}

// Favorites
function addFavorite(movie) {
  if(!favorites.some(f => f.id===movie.id)) {
    favorites.push(movie);
    localStorage.setItem('moviehub_favorites', JSON.stringify(favorites));
    alert('Added to favorites!');
  } else alert('Already in favorites!');
}

document.getElementById('viewFavorites').onclick = () => {
  displayRow(favorites, moviesRow);
}

// Search
searchInput.addEventListener('keyup', e => {
  if(e.key==='Enter') {
    const query = e.target.value.trim();
    if(query.length===0) return;
    searchTMDB(query);
  }
});

async function searchTMDB(query) {
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
  const data = await res.json();
  displayRow(data.results, moviesRow);
}

// Close modal
closeModal.onclick = () => {
  modal.style.display = 'none';
  player.src = '';
};

// Click outside modal to close
window.onclick = e => {
  if(e.target===modal) {
    modal.style.display = 'none';
    player.src = '';
  }
};

// Initial load
async function init() {
  const movies = await fetchTMDB('movie');
  displayRow(movies, moviesRow);

  const series = await fetchTMDB('tv');
  displayRow(series, seriesRow);

  const anime = await fetchTMDB('tv'); // you can filter anime by genre if needed
  displayRow(anime, animeRow);
}
init();