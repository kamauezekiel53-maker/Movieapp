const apiKey = "30de4b3340b4d7538b2749a60af12d71793126e39de3a8c69f88333271e5b5bb";

async function searchMovies(query) {
  const url = `https://api.simkl.com/search/?q=${query}&type=movie&client_id=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.log("API ERROR:", await res.text());
    return [];
  }

  const data = await res.json();
  return data;
}

document.getElementById("searchInput").addEventListener("input", async (e) => {
  const query = e.target.value.trim();
  if (query.length < 2) return;

  const movies = await searchMovies(query);
  displayMovies(movies);
});

function displayMovies(movies) {
  const movieList = document.getElementById("movieList");
  movieList.innerHTML = "";

  if (!movies.length) {
    movieList.innerHTML = "<p>No movies found.</p>";
    return;
  }

  movies.forEach(movie => {
    const div = document.createElement("div");
    div.classList.add("movie");

    const poster = movie.poster ? movie.poster : "https://via.placeholder.com/300x450?text=No+Image";

    div.innerHTML = `
      <img src="${poster}" alt="${movie.title}">
      <p>${movie.title}</p>
    `;

    div.onclick = () => openPlayer(movie);
    movieList.appendChild(div);
  });
}

function openPlayer(movie) {
  document.getElementById("modalTitle").textContent = movie.title;

  const tmdb = movie.ids?.tmdb;
  if (!tmdb) {
    alert("This movie has no TMDB ID. Cannot play.");
    return;
  }

  const players = [
    `https://vidsrc.to/embed/movie/${tmdb}`,
    `https://videoverse.cloud/embed/movie/${tmdb}`,
    `https://hidemovies.xyz/embed/${tmdb}`
  ];

  let index = 0;
  const iframe = document.getElementById("moviePlayer");

  const tryNext = () => {
    iframe.src = players[index];

    iframe.onerror = () => {
      index++;
      if (index < players.length) tryNext();
      else alert("No working video source.");
    };
  };

  tryNext();

  document.getElementById("movieModal").style.display = "block";
}

document.querySelector(".close").onclick = () => {
  document.getElementById("movieModal").style.display = "none";
  document.getElementById("moviePlayer").src = "";
};