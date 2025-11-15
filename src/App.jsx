import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import axios from "axios";

// Replace with your TMDb API key
const API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3Y2M5YWJlZjUwZTRjOTQ2ODlmNDg1MTY3MTg2MDdiZSIsIm5iZiI6MTc2MzE4ODAwNS40MTYsInN1YiI6IjY5MTgxZDI1NmNiM2U1Yjg1NzRjOWY3MyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.QcbC58rNduIgTJR_ljFzbCxel4o3C9hLdV6CSzXuqRU";

const App = () => {
  const [movies, setMovies] = useState([]);
  const [category, setCategory] = useState("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDetails, setShowDetails] = useState(null);

  useEffect(() => {
    fetchMovies(category);
  }, [category]);

  const fetchMovies = async (type) => {
    try {
      const res = await axios.get(
        `https://api.themoviedb.org/3/movie/${type}?api_key=${API_KEY}&language=en-US&page=1`
      );
      setMovies(res.data.results);
    } catch (error) {
      console.error("Error fetching movies:", error);
    }
  };

  const searchMovies = async (query) => {
    if (!query) return fetchMovies(category);
    try {
      const res = await axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${query}`
      );
      setMovies(res.data.results);
    } catch (error) {
      console.error("Error searching movies:", error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchMovies(searchTerm);
  };

  return (
    <div>
      {/* Header */}
      <header className="header">
        <h1>🎬 MovieHub</h1>
        <nav>
          <button onClick={() => setCategory("popular")}>Popular</button>
          <button onClick={() => setCategory("top_rated")}>Top Rated</button>
          <button onClick={() => setCategory("upcoming")}>Upcoming</button>
        </nav>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search movies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </header>

      {/* Movie Grid */}
      <div className="movie-grid">
        {movies.map((movie) => (
          <div
            key={movie.id}
            className="movie-card"
            onClick={() => setShowDetails(movie)}
          >
            <img
              src={
                movie.poster_path
                  ? `https://image.tmdb.org/t/p/w300${movie.poster_path}`
                  : "https://via.placeholder.com/300x450?text=No+Image"
              }
              alt={movie.title}
            />
            <h3>{movie.title}</h3>
          </div>
        ))}
      </div>

      {/* Movie Details Modal */}
      {showDetails && (
        <div className="modal" onClick={() => setShowDetails(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="close" onClick={() => setShowDetails(null)}>
              &times;
            </span>
            <h2>{showDetails.title}</h2>
            <p><strong>Release:</strong> {showDetails.release_date}</p>
            <p><strong>Rating:</strong> {showDetails.vote_average}</p>
            <p>{showDetails.overview}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const css = `
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #121212;
  color: #fff;
}
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #1f1f1f;
}
.header nav button {
  margin-left: 0.5rem;
  padding: 0.5rem 1rem;
  background: #ff3b3b;
  border: none;
  color: #fff;
  cursor: pointer;
}
.search-form {
  display: flex;
  margin-top: 0.5rem;
}
.search-form input {
  padding: 0.5rem;
  border-radius: 5px 0 0 5px;
  border: none;
  outline: none;
}
.search-form button {
  padding: 0.5rem 1rem;
  border: none;
  background: #ff3b3b;
  color: #fff;
  cursor: pointer;
  border-radius: 0 5px 5px 0;
}
.movie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  padding: 1rem;
}
.movie-card {
  background: #1f1f1f;
  padding: 0.5rem;
  text-align: center;
  cursor: pointer;
}
.movie-card img {
  width: 100%;
  border-radius: 5px;
}
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}
.modal-content {
  background: #1f1f1f;
  padding: 2rem;
  border-radius: 10px;
  max-width: 500px;
  width: 90%;
  position: relative;
}
.modal-content .close {
  position: absolute;
  top: 10px;
  right: 20px;
  cursor: pointer;
  font-size: 1.5rem;
}
@media(max-width:600px){
  .header {flex-direction:column; align-items:flex-start;}
  .search-form{width:100%;}
}
`;
const style = document.createElement("style");
style.appendChild(document.createTextNode(css));
document.head.appendChild(style);

// Render App
ReactDOM.render(<App />, document.getElementById("root"));