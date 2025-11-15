const APP_VERSION = '2.0.0';
const storedVersion = localStorage.getItem('moviehub_version') || '1.0.0';
if(storedVersion !== APP_VERSION){
    // Migration logic if needed
    localStorage.setItem('moviehub_version', APP_VERSION);
}

const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const moviesContainer = document.getElementById('movies');
const searchInput = document.getElementById('search');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close');
const viewFavoritesBtn = document.getElementById('view-favorites');

let favorites = JSON.parse(localStorage.getItem('moviehub_favorites')) || [];

// Fetch trending or searched movies
async function fetchMovies(query=''){
    let url = query 
        ? `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${query}`
        : `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    displayMovies(data.results);
}

// Display movies
function displayMovies(movies){
    moviesContainer.innerHTML = '';
    if(!movies || movies.length === 0){
        moviesContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No movies found</p>';
        return;
    }

    movies.forEach(movie => {
        const movieEl = document.createElement('div');
        movieEl.classList.add('movie');
        movieEl.innerHTML = `
            <img src="${IMG_URL + movie.poster_path}" alt="${movie.title}" />
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p>${movie.release_date ? movie.release_date.split('-')[0] : ''}</p>
            </div>
        `;
        movieEl.addEventListener('click', () => openModal(movie.id));
        moviesContainer.appendChild(movieEl);
    });
}

// Open modal with trailer
async function openModal(movieId){
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${API_KEY}`);
    const data = await res.json();
    const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');

    const movieRes = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}`);
    const movieData = await movieRes.json();

    modalBody.innerHTML = `
        <h2>${movieData.title} (${movieData.release_date ? movieData.release_date.split('-')[0] : ''})</h2>
        <p>${movieData.overview}</p>
        ${trailer ? `<iframe src="https://www.youtube.com/embed/${trailer.key}" frameborder="0" allowfullscreen></iframe>` : '<p>No trailer available</p>'}
        <button class="favorite-btn" onclick="addFavorite(${movieId})">Add to Favorites</button>
    `;

    modal.style.display = 'flex';
}

// Add favorite
function addFavorite(id){
    if(!favorites.includes(id)){
        favorites.push(id);
        localStorage.setItem('moviehub_favorites', JSON.stringify(favorites));
        alert('Added to favorites!');
    } else alert('Already in favorites!');
}

// Display favorites
function showFavorites(){
    if(favorites.length === 0){
        moviesContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No favorites yet</p>';
        return;
    }
    const favoriteMovies = favorites.map(async id => {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}`);
        return res.json();
    });
    Promise.all(favoriteMovies).then(data => displayMovies(data));
}

// Close modal
closeModal.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', e => { if(e.target == modal) modal.style.display = 'none'; });

// Search functionality (Enter to search)
searchInput.addEventListener('keyup', e => {
    if(e.key === 'Enter'){
        fetchMovies(e.target.value.trim());
    }
});

// Favorites button
viewFavoritesBtn.addEventListener('click', showFavorites);

// Initial load
fetchMovies();