// Everything is wrapped in an IIFE so names like `observer` don't collide
// with page scripts (books.html declares its own `const observer`).
(function () {

  // ─── Mobile Nav Toggle ──────────────────────────
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        toggle.classList.remove('open');
        links.classList.remove('open');
      });
    });
  }

  // ─── Active Nav Link ────────────────────────────
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ─── Scroll Fade-in ─────────────────────────────
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        fadeObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  function animateCards(cards) {
    cards.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = `opacity 0.5s ease ${i * 0.07}s, transform 0.5s ease ${i * 0.07}s`;
      fadeObserver.observe(el);
    });
  }

  // Cards that are already in the HTML (category pages)
  animateCards(document.querySelectorAll('.card'));


  // ════════════════════════════════════════════════
  //  HOME PAGE PREVIEWS — pulled live from each page
  // ════════════════════════════════════════════════
  const PREVIEW_COUNT = 3;

  const ARROW_SVG =
    '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>';

  // Fetch a page and parse it into a document
  async function loadPage(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }

  // Rewrite relative paths (../img/…) so they work from the home page
  function fixPaths(card, pageUrl) {
    const abs = p => new URL(p, pageUrl).href;

    card.querySelectorAll('[src]').forEach(el => el.setAttribute('src', abs(el.getAttribute('src'))));

    if (card.dataset.photos) {
      try {
        card.dataset.photos = JSON.stringify(JSON.parse(card.dataset.photos).map(abs));
      } catch (_) { /* leave as is */ }
    }

    const href = card.getAttribute('href');
    card.setAttribute('href', !href || href === '#' ? pageUrl : abs(href));

    // Page-only handlers (e.g. openLightbox) don't exist on the home page
    card.removeAttribute('onclick');
    card.removeAttribute('style');
    return card;
  }

  // Music / Travel / Movies: copy the first N cards from #cards
  async function cardPreview(pageUrl) {
    const doc   = await loadPage(pageUrl);
    const cards = [...doc.querySelectorAll('#cards .card')];
    return {
      total: cards.length,
      cards: cards.slice(0, PREVIEW_COUNT).map(c => fixPaths(document.importNode(c, true), pageUrl))
    };
  }

  // Books: build cards from the .book-row list.
  // Newest year first; within a year, the highest-numbered (most recently added) book first.
  async function bookPreview(pageUrl) {
    const doc    = await loadPage(pageUrl);
    const blocks = [...doc.querySelectorAll('.year-block')];
    const rows   = blocks.flatMap(block =>
      [...block.querySelectorAll('.book-row')].reverse().map(row => ({ row, yearId: block.id }))
    );

    const cards = rows.slice(0, PREVIEW_COUNT).map(({ row, yearId }) => {
      const text  = sel => (row.querySelector(sel)?.textContent || '').trim();
      const genre = text('.book-genre').split('·')[0].trim();

      const a = document.createElement('a');
      a.className = 'card';
      a.href = pageUrl + (yearId ? '#' + yearId : '');
      a.innerHTML =
        '<span class="card-category"></span>' +
        '<h3 class="card-title"></h3>' +
        '<p class="card-excerpt"></p>' +
        '<div class="card-meta"><span></span><span class="card-arrow">' + ARROW_SVG + '</span></div>';
      a.querySelector('.card-category').textContent  = genre;
      a.querySelector('.card-title').textContent     = text('.book-title');
      a.querySelector('.card-excerpt').textContent   = text('.book-author');
      a.querySelector('.card-meta span').textContent = text('.book-rating');
      return a;
    });

    return { total: rows.length, cards };
  }

  // Fill each [data-source] grid on the home page
  document.querySelectorAll('.cards-grid[data-source]').forEach(async grid => {
    const pageUrl = new URL(grid.dataset.source, location.href).href;
    const kind    = grid.dataset.kind;
    const stat    = document.querySelector(`[data-stat="${kind}"]`);

    try {
      const { total, cards } = kind === 'books'
        ? await bookPreview(pageUrl)
        : await cardPreview(pageUrl);

      grid.replaceChildren(...cards);
      animateCards(cards);
      if (stat) stat.textContent = total;
    } catch (err) {
      console.warn('Preview failed for', kind, err);
      // Fallback: one card that links to the full page
      grid.innerHTML =
        `<a href="${grid.dataset.source}" class="card">` +
        `<h3 class="card-title">See all ${kind}</h3>` +
        `<div class="card-meta"><span></span><span class="card-arrow">${ARROW_SVG}</span></div></a>`;
    }
  });

})();
