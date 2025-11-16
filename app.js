const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const trendingRow = document.getElementById('trendingRow');
const topRatedRow = document.getElementById('topRatedRow');
const actionRow = document.getElementById('actionRow');
const comedyRow = document.getElementById('comedyRow');
const searchInput = document.getElementById('searchInput');

const modal = document.getElementById('trailerModal');
const trailerIframe = document.getElementById('trailerIframe');
const closeModal = document.querySelector('.close');

const watchlistBtn = document.getElementById('watchlistBtn');
const watchlistModal = document.getElementById('watchlistModal');
const closeWatchlist = document.querySelector('.close-watchlist');
const watchlistContainer = document.getElementById('watchlistContainer');

let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];

// Close modals
closeModal.onclick = () => { modal.style.display = 'none'; trailerIframe.src = ''; };
closeWatchlist.onclick = () => { watchlistModal.style.display = 'none'; };

// Show watchlist
watchlistBtn.onclick = () => {
  renderWatchlist();
  watchlistModal.style.display = 'flex';
};

// Fetch movies
async function fetchMovies(url, container) {
  const res = await fetch(url);
  const data = await res.json();
  container.innerHTML = '';
  data.results.forEach(movie => {
    createMovieCard(movie, container);
  });
}

// Create movie card
function createMovieCard(movie, container) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  const isFavorited = watchlist.some(item => item.id === movie.id && item.media_type === (movie.media_type || 'movie'));
  card.innerHTML = `
    <img src="${IMG_URL + movie.poster_path}" alt="${movie.title || movie.name}">
    <h3>${movie.title || movie.name}</h3>
    <div class="heart ${isFavorited ? 'active' : ''}">❤️</div>
  `;
  card.onclick = (e) => {
    if(e.target.classList.contains('heart')) return;
    playTrailer(movie.id, movie.media_type || 'movie');
  };

  const heart = card.querySelector('.heart');
  heart.onclick = (e) => {
    e.stopPropagation();
    toggleWatchlist(movie);
    heart.classList.toggle('active');
  };

  container.appendChild(card);
}

// Play trailer inside modal
async function playTrailer(id, type) {
  const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${API_KEY}`);
  const data = await res.json();
  const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  if(trailer) {
    trailerIframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1&controls=1`;
    modal.style.display = 'flex';
  } else {
    alert('Trailer not available');
  }
}

// Watchlist functions
function toggleWatchlist(movie) {
  const type = movie.media_type || 'movie';
  const exists = watchlist.some(item => item.id === movie.id && item.media_type === type);
  if(!exists) {
    watchlist.push({id: movie.id, media_type: type});
  } else {
    watchlist = watchlist.filter(item => !(item.id === movie.id && item.media_type === type));
  }
  localStorage.setItem('watchlist', JSON.stringify(watchlist));
}

async function renderWatchlist() {
  watchlistContainer.innerHTML = '';
  for(let item of watchlist) {
    const res = await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}?api_key=${API_KEY}`);
    const movie = await res.json();
    createMovieCard(movie, watchlistContainer);
  }
}

// Initial Load
fetchMovies(`https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}`, trendingRow);
fetchMovies(`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}`, topRatedRow);
fetchMovies(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=28`, actionRow); // Action
fetchMovies(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=35`, comedyRow); // Comedy

// Search functionality
searchInput.addEventListener('keyup', async (e) => {
  const query = e.target.value;
  if(query.length < 3) return;
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${query}`);
  const data = await res.json();
  trendingRow.innerHTML = '';
  data.results.forEach(movie => {
    createMovieCard(movie, trendingRow);
  });
});