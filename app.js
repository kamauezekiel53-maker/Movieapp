const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const trendingRow = document.getElementById('trendingRow');
const topRatedRow = document.getElementById('topRatedRow');
const actionRow = document.getElementById('actionRow');
const comedyRow = document.getElementById('comedyRow');
const searchRow = document.getElementById('searchRow');
const searchInput = document.getElementById('searchInput');
const genreSelect = document.getElementById('genreSelect');

const modal = document.getElementById('trailerModal');
const trailerIframe = document.getElementById('trailerIframe');
const closeModal = document.querySelector('.close');

const watchlistBtn = document.getElementById('watchlistBtn');
const watchlistModal = document.getElementById('watchlistModal');
const closeWatchlist = document.querySelector('.close-watchlist');
const watchlistContainer = document.getElementById('watchlistContainer');

const themeToggle = document.getElementById('themeToggle');

let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];

// Close modals
closeModal.onclick = () => { modal.style.display = 'none'; trailerIframe.src = ''; };
closeWatchlist.onclick = () => { watchlistModal.style.display = 'none'; };

// Show watchlist
watchlistBtn.onclick = () => {
  renderWatchlist();
  watchlistModal.style.display = 'flex';
};

// Theme toggle
themeToggle.onclick = () => {
  document.body.classList.toggle('light');
};

// Fetch movies
async function fetchMovies(url, container) {
  container.innerHTML = '<div class="loader"></div>';
  const res = await fetch(url);
  const data = await res.json();
  container.innerHTML = '';
  data.results.forEach(movie => {
    createMovieCard(movie, container);
  });
}

// Create movie card
function createMovieCard(movie, container, isWatchlist = false) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  const isFavorited = watchlist.some(item => item.id === movie.id && item.media_type === (movie.media_type || 'movie'));
  card.innerHTML = `
    <img src="${IMG_URL + movie.poster_path