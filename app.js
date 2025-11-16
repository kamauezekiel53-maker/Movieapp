const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const trendingRow = document.getElementById('trendingRow');
const topRatedRow = document.getElementById('topRatedRow');
const upcomingRow = document.getElementById('upcomingRow');
const animeRow = document.getElementById('animeRow');
const searchInput = document.getElementById('searchInput');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalOverview = document.getElementById('modalOverview');
const modalTrailer = document.getElementById('modalTrailer');
const closeModal = document.getElementById('closeModal');

let currentMovie = null;

// Local Storage
const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
const favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// =================== Close Modal ===================
closeModal.onclick = () => {
  modal.style.display = 'none';
  modalTrailer.src = '';
};

// =================== Fetch Movies ===================
async function fetchMovies(url, row) {
  const res = await fetch(url);
  const data = await res.json();
  row.innerHTML = '';
  data.results.forEach(movie => {
    const img = document.createElement('img');
    img.src = IMG_URL + movie.poster_path;
    img.alt = movie.title;
    img.onclick = () => openModal(movie.id);
    row.appendChild(img);
  });
}

// =================== Open Modal ===================
async function openModal(movieId) {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&append_to_response=videos`);
  const movie = await res.json();
  currentMovie = movie;

  modalTitle.innerText = movie.title;
  modalOverview.innerText = movie.overview;

  const trailer = movie.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  if(trailer) modalTrailer.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;

  document.getElementById('futureFeatures').innerHTML = `
    Feature placeholders: Rating ⭐ | Trivia 🎲 | AR Filters 📱 | Analytics 📊
  `;

  modal.style.display = 'flex';
}

// =================== Watchlist / Favorites ===================
document.getElementById('addWatchlist').onclick = () => {
  if(currentMovie && !watchlist.find(m => m.id === currentMovie.id)) {
    watchlist.push({id: currentMovie.id, title: currentMovie.title});
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    alert('Added to Watchlist!');
  }
};

document.getElementById('addFavorite').onclick = () => {
  if(currentMovie && !favorites.find(m => m.id === currentMovie.id)) {
    favorites.push({id: currentMovie.id, title: currentMovie.title});
    localStorage.setItem('favorites', JSON.stringify(favorites));
    alert('Added to Favorites!');
  }
};

document.getElementById('shareMovie').onclick = () => {
  if(currentMovie) alert(`Share link (placeholder) for ${currentMovie.title}`);
};

// =================== Initial Fetch ===================
fetchMovies(`https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}`, trendingRow);
fetchMovies(`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}`, topRatedRow);
fetchMovies(`https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}`, upcomingRow);
fetchMovies(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=16`, animeRow); // Genre 16 = Animation

// =================== Search ===================
searchInput.addEventListener('keypress', async e => {
  if(e.key === 'Enter') {
    const query = searchInput.value;
    trendingRow.innerHTML = '';
    topRatedRow.innerHTML = '';
    upcomingRow.innerHTML = '';
    animeRow.innerHTML = '';
    fetchMovies(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${query}`, trendingRow);
  }
});