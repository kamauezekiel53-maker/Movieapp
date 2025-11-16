const apiKey = '7cc9abef50e4c94689f48516718607be'; // Replace with your TMDB API key
const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('searchBtn');
const moviesContainer = document.getElementById('movies');

async function fetchMovies(query = 'popular') {
    const url = query === 'popular' 
        ? `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=1`
        : `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}&language=en-US&page=1`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - Check your API key or network.`);
        }
        const data = await response.json();
        if (data.results.length === 0) {
            alert('No movies found. Try a different search!');
            return;
        }
        displayMovies(data.results);
    } catch (error) {
        console.error('Error fetching movies:', error);
        alert('Failed to load movies. Check console for details.');
    }
}

function displayMovies(movies) {
    moviesContainer.innerHTML = '';
    movies.forEach(movie => {
        const movieEl = document.createElement('div');
        movieEl.classList.add('movie');
        movieEl.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
            <h3>${movie.title}</h3>
            <p>Rating: ${movie.vote_average}/10</p>
            <p>${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
        `;
        movieEl.addEventListener('click', () => alert(`Overview: ${movie.overview}`));
        moviesContainer.appendChild(movieEl);
    });
}

searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) fetchMovies(query);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});

// Load popular movies on page load
fetchMovies();