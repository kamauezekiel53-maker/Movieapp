const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const movieList = document.getElementById('movieList');
const searchInput = document.getElementById('searchInput');
const movieModal = document.getElementById('movieModal');
const modalTitle = document.getElementById('modalTitle');
const moviePlayer = document.getElementById('moviePlayer');
const closeModal = document.querySelector('.close');

// Fetch trending movies initially
async function fetchTrending() {
    const res = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}`);
    const data = await res.json();
    displayMovies(data.results);
}

// Search movies
async function searchMovies(query) {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    displayMovies(data.results);
}

// Display movies in grid
function displayMovies(movies) {
    movieList.innerHTML = '';
    if (!movies || movies.length === 0) {
        movieList.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No movies found</p>';
        return;
    }
    movies.forEach(movie => {
        const div = document.createElement('div');
        div.classList.add('movie');
        div.innerHTML = `
            <img src="${IMG_URL + movie.poster_path}" alt="${movie.title}">
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p>${movie.release_date ? movie.release_date.split('-')[0] : ''}</p>
            </div>
        `;
        div.onclick = () => openModal(movie);
        movieList.appendChild(div);
    });
}

// Open modal with trailer + player
async function openModal(movie) {
    modalTitle.textContent = movie.title;
    moviePlayer.src = ''; // Reset player

    // Fetch trailers
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${API_KEY}`);
    const data = await res.json();
    const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');

    let modalContent = '';
    if (trailer) {
        modalContent += `<iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen style="margin-top:10px; height:250px;"></iframe>`;
    } else {
        modalContent += '<p>No trailer available</p>';
    }

    // Add full movie player buttons
    modalContent += `
        <h3>Play Movie:</h3>
        <button onclick="playMovie('vidsrc', ${movie.id})">VidSrc</button>
        <button onclick="playMovie('videoverse', ${movie.id})">VideoVerse</button>
        <button onclick="playMovie('hdmovie', ${movie.id})">HDMovies</button>
    `;

    // Inject modal content
    movieModal.querySelector('.modal-content').innerHTML = `
        <span class="close">&times;</span>
        <h2 id="modalTitle">${movie.title}</h2>
        <iframe id="moviePlayer" allowfullscreen style="margin-top:10px; height:300px;"></iframe>
        ${modalContent}
    `;

    // Re-assign close event
    movieModal.querySelector('.close').onclick = () => {
        movieModal.style.display = 'none';
        document.getElementById('moviePlayer').src = '';
    };

    movieModal.style.display = 'flex';
}

// Play movie using selected provider
function playMovie(provider, tmdbId) {
    const iframe = document.getElementById('moviePlayer');
    let urls = {
        vidsrc: `https://vidsrc.to/embed/movie/${tmdbId}`,
        videoverse: `https://videoverse.cloud/embed/movie/${tmdbId}`,
        hdmovie: `https://hidemovies.xyz/embed/${tmdbId}`
    };
    iframe.src = urls[provider];
}

// Search on Enter
searchInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') searchMovies(e.target.value.trim());
});

// Close modal on outside click
window.addEventListener('click', e => {
    if (e.target === movieModal) {
        movieModal.style.display = 'none';
        moviePlayer.src = '';
    }
});

// Initial load
fetchTrending();