/* VERSION */
const APP_VERSION = '3.0';
localStorage.setItem('moviehub_version', APP_VERSION);

/* SIMKL CONFIG */
const SIMKL_KEY = "22d70df8d4ebcfb18d99d87ea3346b029a31ab9515e49bf28be29a1dc5225d55";
const SIMKL_BASE = "https://api.simkl.com";
const POSTER = "https://simkl.net/posters/";

/* DOM */
const moviesContainer = document.getElementById('movies');
const searchInput = document.getElementById('search');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close');
const tabs = document.querySelectorAll('.tab');

let currentType = "movies";
let favorites = JSON.parse(localStorage.getItem("moviehub_favorites")) || [];

/* FETCH DATA */
async function fetchData(type, query = "") {
    let url = "";

    if (query) {
        url = `${SIMKL_BASE}/search/${type}?q=${encodeURIComponent(query)}`;
    } else {
        if (type === "movies") url = `${SIMKL_BASE}/movies/trending`;
        if (type === "series") url = `${SIMKL_BASE}/tv/trending`;
        if (type === "anime") url = `${SIMKL_BASE}/anime/trending`;
    }

    const res = await fetch(url, { headers: { "simkl-api-key": SIMKL_KEY } });
    const data = await res.json();

    const results = query ? data.filter(x => x[type.slice(0, -1)]) : data;

    displayMovies(results, type);
}

/* DISPLAY */
function displayMovies(list, type) {
    moviesContainer.innerHTML = "";

    if (!list.length) {
        moviesContainer.innerHTML = `<p>No results found.</p>`;
        return;
    }

    list.forEach(item => {
        const m = item.movie || item.show || item.anime || item;

        const poster = m.poster ? `${POSTER}${m.poster}_m.jpg` : "";

        const box = document.createElement("div");
        box.className = "movie";
        box.innerHTML = `
            <img src="${poster}">
            <div class="movie-info">
                <h3>${m.title}</h3>
                <p>${m.year || ""}</p>
            </div>
        `;

        box.onclick = () => openModal(m.ids.simkl_id, type);
        moviesContainer.appendChild(box);
    });
}

/* DETAILS */
async function openModal(id, type) {
    let url = `${SIMKL_BASE}/${type}/${id}`;

    const res = await fetch(url, {
        headers: { "simkl-api-key": SIMKL_KEY }
    });

    const data = await res.json();

    const m = data.movie || data.show || data.anime;

    const poster = m.poster ? `${POSTER}${m.poster}_m.jpg` : "";

    modalBody.innerHTML = `
        <h2>${m.title} (${m.year || ""})</h2>
        <img src="${poster}" style="width:200px;border-radius:10px;margin:10px 0;">
        <p>${m.overview || "No description available."}</p>
        ${m.trailer 
            ? `<iframe src="https://www.youtube.com/embed/${m.trailer}" allowfullscreen></iframe>` 
            : "<p>No trailer available</p>"
        }
        <button onclick="addFavorite(${m.ids.simkl_id})">Add to Favorites ⭐</button>
    `;

    modal.style.display = "flex";
}

/* FAVORITES */
function addFavorite(id) {
    if (!favorites.includes(id)) {
        favorites.push(id);
        localStorage.setItem("moviehub_favorites", JSON.stringify(favorites));
        alert("Added to favorites!");
    } else {
        alert("Already added!");
    }
}

function showFavorites() {
    if (!favorites.length) {
        moviesContainer.innerHTML = "<p>No favorites saved.</p>";
        return;
    }

    const requests = favorites.map(id =>
        fetch(`${SIMKL_BASE}/movies/${id}`, {
            headers: { "simkl-api-key": SIMKL_KEY }
        }).then(r => r.json())
    );

    Promise.all(requests).then(all => {
        const movies = all.map(x => x.movie);
        displayMovies(movies, "movies");
    });
}

/* EVENTS */
closeModal.onclick = () => modal.style.display = "none";
window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };

searchInput.onkeyup = e => {
    if (e.key === "Enter") fetchData(currentType, searchInput.value.trim());
};

document.getElementById("view-favorites").onclick = showFavorites;

tabs.forEach(tab => {
    tab.onclick = () => {
        document.querySelector(".tab.active").classList.remove("active");
        tab.classList.add("active");
        currentType = tab.dataset.type;
        fetchData(currentType);
    };
});

/* INITIAL LOAD */
fetchData("movies");