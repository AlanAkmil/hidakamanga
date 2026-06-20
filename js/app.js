const API = {
  list: (params) => fetch('/api/list?' + new URLSearchParams(params)).then(r => r.json()),
  search: (q) => fetch('/api/search?q=' + encodeURIComponent(q)).then(r => r.json()),
  detail: (slug) => fetch('/api/detail?slug=' + encodeURIComponent(slug)).then(r => r.json()),
  chapter: (slug, chapter) => fetch(`/api/chapter?slug=${encodeURIComponent(slug)}&chapter=${chapter}`).then(r => r.json()),
  img: (url) => '/api/img?url=' + encodeURIComponent(url)
};

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function cardHTML(item, type) {
  const safeImg = item.thumbnail || item.poster || '';
  return `
    <a class="card" href="detail.html?slug=${encodeURIComponent(item.slug)}">
      <div class="thumb">
        ${safeImg ? `<img src="${API.img(safeImg)}" loading="lazy" alt="${item.title}">` : ''}
        <span class="type-badge">${type || 'comic'}</span>
      </div>
      <div class="info">
        <div class="title">${item.title}</div>
      </div>
    </a>`;
}