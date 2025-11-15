const APP_VERSION = '3.0.0';
const storedVersion = localStorage.getItem('moviehub_version') || '1.0.0';
if(storedVersion !== APP_VERSION){
    localStorage.setItem('moviehub_version', APP_VERSION);
}

// ========= SIMKL CONFIG =========
const SIMKL_CLIENT_ID = "22d70df8d4ebcfb18d99d87ea3346b029a31ab9515e49bf28be29a1dc5225d55";
const SIMKL_BASE = "https://api.simkl.com";
const IMG_URL = "https://simkl.net/posters/";

// ========= DOM ELEMENTS =========
const moviesContainer = document.getElementById('movies');
const searchInput = document.getElementById('search');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close');
const viewFavoritesBtn = document.getElementById('view-favorites');

let favorites = JSON.parse(localStorage.getItem('moviehub_favorites')) || [];

// ========= FETCH TRENDING OR SEARCH =========
async function fetchMovies(query = '') {

    let url = query
        ? `${SIMKL_BASE}/search/movie?q=${encodeURIComponent(query)}`
        : `${SIMKL_BASE}/movies/trending`;

    const res = await fetch(url, {
        headers: {
            "simkl-api-key": SIMKL_CLIENT_ID
        }
    });

    const data = await res.json();

    // search returns array of different types → filter movies
    const results = query ? data.filter(x => x.movie) : data;

    displayMovies(results);
}

// ========= DISPLAY MOVIES =========
function displayMovies(movies){
    moviesContainer.innerHTML = '';

    if(!movies || movies.length === 0){
        moviesContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No movies found</p>';
        return;
    }

    movies.forEach(item => {
        const movie = item.movie || item;  

        const poster = movie.poster ? `${IMG_URL}${movie.poster}_m.jpg` : '';

        const movieEl = document.createElement('div');
        movieEl.classList.add('movie');
        movieEl.innerHTML = `
            <img src="${poster}" alt="${movie.title}" />
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p>${movie.year || ''}</p>
            </div>
        `;
        movieEl.addEventListener('click', () => openModal(movie.ids.simkl_id));
        moviesContainer.appendChild(movieEl);
    });
}

// ========= MOVIE DETAILS + TRAILER =========
async function openModal(simkl_id){

    const res = await fetch(`${SIMKL_BASE}/movies/${simkl_id}`, {
        headers: {
            "simkl-api-key": SIMKL_CLIENT_ID
        }
    });

    const data = await res.json();
    const movie = data.movie;

    const poster = movie.poster ? `${IMG_URL}${movie.poster}_m.jpg` : '';
    const trailer = movie.trailer ? movie.trailer : null;

    modalBody.innerHTML = `
        <h2>${movie.title} (${movie.year || ''})</h2>
        <img src="${poster}" style="width:200px;border-radius:12px;margin:10px 0;" />
        <p>${movie.overview || "No description available."}</p>

        ${trailer 
            ? `<iframe width="100%" height="300" 
                src="https://www.youtube.com/embed/${trailer}"
                frameborder="0" allowfullscreen></iframe>`
            : '<p>No trailer available</p>'
        }

        <button class="favorite-btn" onclick="addFavorite(${movie.ids.simkl_id})">
            Add to Favorites
        </button>
    `;

    modal.style.display = 'flex';
}

// ========= FAVORITES =========
function addFavorite(id){
    if(!favorites.includes(id)){
        favorites.push(id);
        localStorage.setItem('moviehub_favorites', JSON.stringify(favorites));
        alert('Added to favorites!');
    } else alert('Already in favorites!');
}

function showFavorites(){
    if(favorites.length === 0){
        moviesContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No favorites yet</p>';
        return;
    }

    const favoriteMovies = favorites.map(async id => {
        const res = await fetch(`${SIMKL_BASE}/movies/${id}`, {
            headers: {
                "simkl-api-key": SIMKL_CLIENT_ID
            }
        });
        const data = await res.json();
        return data.movie;
    });

    Promise.all(favoriteMovies).then(movies => displayMovies(movies));
}

// ========= MODAL CLOSE =========
closeModal.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', e => { if(e.target == modal) modal.style.display = 'none'; });

// ========= SEARCH =========
searchInput.addEventListener('keyup', e => {
    if(e.key === 'Enter'){
        fetchMovies(e.target.value.trim());
    }
});

// ========= FAVORITES BUTTON =========
viewFavoritesBtn.addEventListener('click', showFavorites);

// ========= INITIAL LOAD =========
fetchMovies();