const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

// Rows
const trendingRow = document.getElementById('trendingRow');
const topRatedRow = document.getElementById('topRatedRow');
const actionRow = document.getElementById('actionRow');
const comedyRow = document.getElementById('comedyRow');
const searchInput = document.getElementById('searchInput');

// Modal
const modal = document.getElementById('trailerModal');
const trailerVideo = document.getElementById('trailerVideo');
const closeModal = document.querySelector('.close');

closeModal.onclick = () => {
  modal.style.display = 'none';
  trailerVideo.pause();
};

// Fetch Movies
async function fetchMovies(url, container) {
  const res = await fetch(url);
  const data = await res.json();
  container.innerHTML = '';
  data.results.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
      <img src="${IMG_URL + movie.poster_path}" alt="${movie.title || movie.name}">
      <h3>${movie.title || movie.name}</h3>
    `;
    card.onclick = () => playTrailer(movie.id, movie.media_type || 'movie');
    container.appendChild(card);
  });
}

// Play Trailer inside modal
async function playTrailer(id, type) {
  const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${API_KEY}`);
  const data = await res.json();
  const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  
  if(trailer) {
    // Use embedded YouTube video via iframe alternative
    trailerVideo.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1&controls=1`;
    modal.style.display = 'flex';
  } else {
    alert('Trailer not available');
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
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
      <img src="${IMG_URL + movie.poster_path}" alt="${movie.title || movie.name}">
      <h3>${movie.title || movie.name}</h3>
    `;
    card.onclick = () => playTrailer(movie.id, movie.media_type || 'movie');
    trendingRow.appendChild(card);
  });
});