const API_KEY = "7cc9abef50e4c94689f48516718607be"; // replace if needed
const BASE_URL = "https://api.themoviedb.org/3";

const moviesContainer = document.getElementById("movies");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

async function fetchMovies(url) {
  const res = await fetch(url);
  const data = await res.json();
  showMovies(data.results);
}

function showMovies(movies) {
  moviesContainer.innerHTML = "";

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";

    card.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" />
      <div class="movie-info">
        <h3>${movie.title}</h3>
        <p>⭐ ${movie.vote_average.toFixed(1)}</p>
      </div>
    `;

    moviesContainer.appendChild(card);
  });
}

// Load popular movies on start
fetchMovies(`${BASE_URL}/movie/popular?api_key=${API_KEY}`);

searchForm.addEventListener("submit", e => {
  e.preventDefault();
  const query = searchInput.value.trim();

  if (query) {
    fetchMovies(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${query}`);
  }
});