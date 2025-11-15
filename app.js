const apiKey = "30de4b3340b4d7538b2749a60af12d71793126e39de3a8c69f88333271e5b5bb";

async function searchMovies(query) {
  const url = `https://api.simkl.com/search/movie?q=${query}&client_id=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

document.getElementById("searchInput").addEventListener("input", async (e) => {
  const query = e.target.value;
  if (query.length < 2) return;

  const movies = await searchMovies(query);
  displayMovies(movies);
});

function displayMovies(movies) {
  const movieList = document.getElementById("movieList");
  movieList.innerHTML = "";

  movies.forEach((movie) => {
    const div = document.createElement("div");
    div.classList.add("movie");

    div.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <p>${movie.title}</p>
    `;

    div.onclick = () => openModal(movie);
    movieList.appendChild(div);
  });
}

function openModal(movie) {
  document.getElementById("modalTitle").textContent = movie.title;

  const tmdb = movie.ids.tmdb;

  const players = [
    `https://vidsrc.to/embed/movie/${tmdb}`,
    `https://videoverse.cloud/embed/movie/${tmdb}`,
    `https://hidemovies.xyz/embed/${tmdb}`
  ];

  let current = 0;
  const iframe = document.getElementById("moviePlayer");

  const tryPlayer = () => {
    iframe.src = players[current];

    iframe.onerror = () => {
      current++;
      if (current < players.length) {
        tryPlayer();
      } else {
        alert("No working player found.");
      }
    };
  };

  tryPlayer();

  document.getElementById("movieModal").style.display = "block";
}

document.querySelector(".close").onclick = () => {
  document.getElementById("movieModal").style.display = "none";
  document.getElementById("moviePlayer").src = "";
};