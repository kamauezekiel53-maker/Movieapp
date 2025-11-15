const API_KEY='7cc9abef50e4c94689f48516718607be';
const IMG_URL='https://image.tmdb.org/t/p/w500';
const moviesRow=document.getElementById('moviesRow');
const seriesRow=document.getElementById('seriesRow');
const animeRow=document.getElementById('animeRow');
const searchInput=document.getElementById('searchInput');
const modal=document.getElementById('modal');
const modalTitle=document.getElementById('modalTitle');
const player=document.getElementById('player');
const trailerContainer=document.getElementById('trailerContainer');
const playerButtons=document.getElementById('playerButtons');
const addFavoriteBtn=document.getElementById('addFavorite');
const closeModal=document.querySelector('.close');
const toggleTheme=document.getElementById('toggleTheme');

let favorites=JSON.parse(localStorage.getItem('moviehub_favorites'))||[];

async function fetchTMDB(type,category='trending',extraParams=''){
  const url=`https://api.themoviedb.org/3/trending/${type}/week?api_key=${API_KEY}${extraParams}`;
  const res=await fetch(url); const data=await res.json(); return data.results;
}

function displayRow(items,container){
  container.innerHTML='';
  items.forEach(movie=>{
    const div=document.createElement('div'); div.className='movie';
    div.innerHTML=`
      <img data-src="${movie.poster_path?IMG_URL+movie.poster_path:'https://via.placeholder.com/300x450?text=No+Image'}" alt="${movie.title||movie.name}" class="lazy">
      <div class="movie-info">${movie.title||movie.name}</div>
      ${movie.vote_average?'<div class="star-rating">'+movie.vote_average.toFixed(1)+'⭐</div>':''}
      ${favorites.some(f=>f.id===movie.id)?'<div class="badge">❤️</div>':''}
    `;
    div.onclick=()=>openModal(movie);
    container.appendChild(div);
  });
  lazyLoadImages();
}

// Lazy loading
function lazyLoadImages(){
  const lazyImages=document.querySelectorAll('.lazy');
  const observer=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const img=entry.target; img.src=img.dataset.src;
        observer.unobserve(img);
      }
    });
  });
  lazyImages.forEach(img=>observer.observe(img));
}

// Modal
async function openModal(movie){
  modalTitle.textContent=movie.title||movie.name;
  player.src=''; trailerContainer.innerHTML=''; playerButtons.innerHTML='';

  // Trailer fallback
  const res=await fetch(`https://api.themoviedb.org/3/${movie.media_type||'movie'}/${movie.id}/videos?api_key=${API_KEY}`);
  const data=await res.json();
  const trailer=data.results.find(v=>v.type==='Trailer'&&v.site==='YouTube');
  if(trailer) trailerContainer.innerHTML=`<iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>`;

  if(movie.media_type==='tv'){
    const seasonSelect=document.createElement('select');
    for(let i=1;i<=movie.number_of_seasons;i++){
      const opt=document.createElement('option'); opt.value=i; opt.textContent='Season '+i;
      seasonSelect.appendChild(opt);
    }
    playerButtons.appendChild(seasonSelect);
    const epContainer=document.createElement('div'); epContainer.id='episodesContainer'; epContainer.style.marginTop='10px';
    playerButtons.appendChild(epContainer);

    const loadEpisodes=async(seasonNum)=>{
      epContainer.innerHTML='Loading episodes...';
      const epRes=await fetch(`https://api.themoviedb.org/3/tv/${movie.id}/season/${seasonNum}?api_key=${API_KEY}`);
      const epData=await epRes.json(); epContainer.innerHTML='';
      epData.episodes.forEach(ep=>{
        const btn=document.createElement('button'); btn.textContent=`E${ep.episode_number}: ${ep.name}`; btn.style.margin='2px';
        btn.onclick=()=>playEpisode(movie.id,seasonNum,ep.episode_number);
        epContainer.appendChild(btn);
      });
    }
    seasonSelect.addEventListener('change', e=>loadEpisodes(e.target.value));
    loadEpisodes(1);
  } else {
    const btn=document.createElement('button'); btn.textContent='Play (provider unavailable)';
    btn.onclick=()=>alert('Movie playback unavailable. Watch trailer above!');
    playerButtons.appendChild(btn);
  }

  addFavoriteBtn.onclick=()=>addFavorite(movie);
  modal.style.display='flex';
}

function playEpisode(tvId,season,episode){player.src=`https://vidsrc.to/embed/tv/${tvId}/season/${season}/episode/${episode}`;}

function addFavorite(movie){
  if(!favorites.some(f=>f.id===movie.id)){
    favorites.push(movie); localStorage.setItem('moviehub_favorites',JSON.stringify(favorites));
    alert('Added to favorites!'); init();
  } else alert('Already in favorites!');
}

document.getElementById('viewFavorites').onclick=()=>displayRow(favorites,moviesRow);
searchInput.addEventListener('keyup', e=>{if(e.key==='Enter'){const query=e.target.value.trim(); if(query) searchTMDB(query);}});

async function searchTMDB(query){
  const res=await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
  const data=await res.json(); displayRow(data.results,moviesRow);
}

// Close modal
closeModal.onclick=()=>{modal.style.display='none';player.src='';};
window.onclick=e=>{if(e.target===modal){modal.style.display='none';player.src='';}};

// Dark/light toggle
toggleTheme.onclick=()=>{document.body.classList.toggle('light');};

// Init
async function init(){
  const movies=await fetchTMDB('movie'); displayRow(movies,moviesRow);
  const series=await fetchTMDB('tv'); displayRow(series,seriesRow);
  const anime=await fetchTMDB('tv','trending','&with_genres=16'); displayRow(anime,animeRow);
}
init();