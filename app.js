const API_KEY = "7cc9abef50e4c94689f48516718607be";
const BASE_URL = "https://api.themoviedb.org/3";

let currentPage = 1;
let currentQuery = "";
let currentGenre = "";
let currentYear = "";
let currentSort = "";
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

/* DOM Elements */
const movieGrid = document.getElementById("movieGrid");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const genreFilter = document.getElementById("genreFilter");
const yearFilter = document.getElementById("yearFilter");
const sortFilter = document.getElementById("sortFilter");
const pageInfo = document.getElementById("pageInfo");
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const modalPoster = document.getElementById("modalPoster");
const modalTitle = document.getElementById("modalTitle");
const modalTagline = document.getElementById("modalTagline");
const modalOverview = document.getElementById("modalOverview");
const castList = document.getElementById("castList");
const favoriteBtn = document.getElementById("favoriteBtn");

/* INIT APP */
loadGenres();
loadYears();
loadMovies();

/* EVENTS */
searchBtn.onclick = () => {
    currentQuery = searchInput.value;
    currentPage = 1;
    loadMovies();
};

genreFilter.onchange = () => {
    currentGenre = genreFilter.value;
    loadMovies();
};

yearFilter.onchange = () => {
    currentYear = yearFilter.value;
    loadMovies();
};

sortFilter.onchange = () => {
    currentSort = sortFilter.value;
    loadMovies();
};

document.getElementById("prevPage").onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        loadMovies();
    }
};

document.getElementById("nextPage").onclick = () => {
    currentPage++;
    loadMovies();
};

document.getElementById("themeToggle").onclick = () =>
    document.body.classList.toggle("dark");

document.getElementById("favoritesBtn").onclick = () =>
    displayFavorites();

document.getElementById("homeBtn").onclick = () =>
    loadMovies();

/* FETCH MOVIES */
async function loadMovies() {
    movieGrid.innerHTML = createSkeletons();

    const url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&page=${currentPage}`
        + (currentQuery ? `&query=${currentQuery}` : "")
        + (currentGenre ? `&with_genres=${currentGenre}` : "")
        + (currentYear ? `&primary_release_year=${currentYear}` : "")
        + (currentSort ? `&sort_by=${currentSort}` : "");

    const res = await fetch(url);
    const data = await res.json();

    pageInfo.textContent = currentPage;

    renderMovies(data.results);
}

function createSkeletons() {
    let html = "";
    for (let i = 0; i < 12; i++) {
        html += `<div class="movie-card skeleton"></div>`;
    }
    return html;
}

/* RENDER GRID */
function renderMovies(movies) {
    movieGrid.innerHTML = "";

    movies.forEach(movie => {
        const poster = movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : "https://placehold.co/500x750?text=No+Image";

        const card = document.createElement("div");
        card.className = "movie-card";
        card.innerHTML = `
            <img src="${poster}" class="poster">
            <h3>${movie.title}</h3>
            <p>⭐ ${movie.vote_average}</p>
        `;

        card.onclick = () => openModal(movie.id);
        movieGrid.appendChild(card);
    });
}

/* MODAL DETAILS */
async function openModal(id) {
    modal.classList.remove("hidden");

    const res = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}&append_to_response=credits`);
    const movie = await res.json();

    modalPoster.src = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : "https://placehold.co/500x750";

    modalTitle.textContent = movie.title;
    modalTagline.textContent = movie.tagline || "";
    modalOverview.textContent = movie.overview;

    castList.innerHTML = movie.credits.cast
        .slice(0, 10)
        .map(c => `<div class='cast-item'><strong>${c.name}</strong><br>${c.character}</div>`)
        .join("");

    favoriteBtn.onclick = () => toggleFavorite(movie);
}

closeModal.onclick = () => modal.classList.add("hidden");

/* FAVORITES SYSTEM */
function toggleFavorite(movie) {
    const exists = favorites.some(f => f.id === movie.id);
    if (!exists) favorites.push(movie);
    else favorites = favorites.filter(f => f.id !== movie.id);

    localStorage.setItem("favorites", JSON.stringify(favorites));
    alert(exists ? "Removed from favorites" : "Added to favorites");
}

function displayFavorites() {
    const favs = JSON.parse(localStorage.getItem("favorites") || "[]");
    movieGrid.innerHTML = "";
    pageInfo.textContent = "Favorites";

    favs.forEach(movie => {
        const poster = movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : "https://placehold.co/500x750";

        const card = document.createElement("div");
        card.className = "movie-card";
        card.innerHTML = `
            <img src="${poster}" class="poster">
            <h3>${movie.title}</h3>
            <button class="btn" onclick='removeFavorite(${movie.id})'>Remove</button>
        `;
        movieGrid.appendChild(card);
    });
}

function removeFavorite(id) {
    favorites = favorites.filter(f => f.id !== id);
    localStorage.setItem("favorites", JSON.stringify(favorites));
    displayFavorites();
}

/* LOAD GENRES */
async function loadGenres() {
    const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
    const data = await res.json();

    data.genres.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.name;
        genreFilter.appendChild(opt);
    });
}

/* YEARS */
function loadYears() {
    for (let y = 2025; y >= 1950; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearFilter.appendChild(opt);
    }
}