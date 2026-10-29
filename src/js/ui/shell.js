// Оболочка сайта: шапка, мобильное Offcanvas-меню и подвал.
// Шаблоны собираются из данных site.js, поэтому имя и ссылки меняются
// в одном месте. Здесь же поддерживается aria-expanded, focus trap
// и возврат фокуса на заголовок после навигации.
import { Offcanvas } from 'bootstrap';

/** Пункты основной и мобильной навигации. */
function navLinks(site, mobile = false) {
  return site.nav
    .map(
      (item) => `<a class="site-nav__link${mobile ? ' mobile-nav__link' : ''}" href="${item.path}" data-nav data-section="${item.id}">
        ${item.label}
      </a>`
    )
    .join('');
}

/** Шапка: логотип, навигация, GitHub и кнопка меню. */
function headerTemplate(site) {
  return `<div class="site-header__inner shell">
    <a class="wordmark" href="/" data-nav data-section="home" aria-label="${site.fullName} — на главную">
      <span class="wordmark__monogram" aria-hidden="true">РФ</span>
      <span class="wordmark__name">${site.firstName} <span>${site.lastName}</span></span>
    </a>
    <nav class="site-nav" aria-label="Основная навигация">
      ${navLinks(site)}
      <span class="site-nav__marker" aria-hidden="true"></span>
    </nav>
    <div class="site-header__aside">
      <a class="header-link mono" href="${site.github}" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      <button class="menu-button" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNav" aria-controls="mobileNav" aria-expanded="false">
        <span class="menu-button__label mono">Меню</span>
        <span class="menu-button__icon" aria-hidden="true"><span></span><span></span></span>
      </button>
    </div>
  </div>
  <div class="site-header__line" aria-hidden="true"></div>`;
}

/** Мобильное меню на Bootstrap Offcanvas. */
function mobileNavTemplate(site) {
  return `<div class="offcanvas offcanvas-end mobile-nav" tabindex="-1" id="mobileNav" aria-labelledby="mobileNavLabel">
    <div class="offcanvas-header mobile-nav__header">
      <p class="eyebrow" id="mobileNavLabel">Навигация</p>
      <button class="menu-close" type="button" data-bs-dismiss="offcanvas" aria-label="Закрыть меню">
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <div class="offcanvas-body mobile-nav__body">
      <nav class="mobile-nav__list" aria-label="Мобильная навигация">
        ${navLinks(site, true)}
      </nav>
      <div class="mobile-nav__footer">
        <p class="mono">${site.role}</p>
        <a class="header-link mono" href="${site.github}" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </div>`;
}

/** Подвал с копирайтом и возвратом наверх. */
function footerTemplate(site) {
  return `<div class="site-footer__inner shell">
    <p class="mono">© 2026 ${site.fullName}</p>
    <a class="footer-top mono" href="#top" data-scroll-top>Наверх <span aria-hidden="true">↑</span></a>
  </div>`;
}

let header;
let nav;
let marker;
let mobileNav;

/** Пересчитывает позицию и ширину подчёркивания активного пункта. */
function updateNavMarker() {
  if (!nav || !marker) return;
  const active = nav.querySelector('[aria-current="page"]');
  if (!active) {
    nav.style.setProperty('--marker-w', '0px');
    return;
  }
  const navRect = nav.getBoundingClientRect();
  const linkRect = active.getBoundingClientRect();
  nav.style.setProperty('--marker-x', `${linkRect.left - navRect.left}px`);
  nav.style.setProperty('--marker-w', `${linkRect.width}px`);
  nav.classList.add('is-ready');
}

/** Синхронизирует активные ссылки в шапке и мобильном меню. */
export function updateActiveNav(section) {
  document.querySelectorAll('[data-section]').forEach((link) => {
    const active = link.dataset.section === section;
    link.classList.toggle('is-active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  requestAnimationFrame(updateNavMarker);
}

/** Вставляет шапку, меню и подвал в заранее подготовленные контейнеры. */
export function mountShell(site) {
  header = document.getElementById('site-header');
  mobileNav = document.getElementById('mobile-nav');
  const footer = document.getElementById('site-footer');
  if (header) header.innerHTML = headerTemplate(site);
  if (mobileNav) mobileNav.innerHTML = mobileNavTemplate(site);
  if (footer) footer.innerHTML = footerTemplate(site);
}

/** Подключает поведение оболочки после mountShell. */
export function initShell() {
  nav = document.querySelector('.site-nav');
  marker = document.querySelector('.site-nav__marker');
  mobileNav = document.getElementById('mobileNav');
  const menuButton = document.querySelector('.menu-button');
  let focusAfterMenuClose = false;

  const setMenuExpanded = (expanded) => {
    menuButton?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };

  // Плотный фон шапки включается только после начала прокрутки.
  const onScroll = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateNavMarker);

  // «Наверх» обрабатываем сами: якорь #top конфликтует с hash-навигацией
  // и может сначала прокрутить страницу, а затем вернуть её обратно.
  // behavior: instant отменяет и глобальный smooth-scroll Bootstrap,
  // поэтому кнопка сразу оказывается в начале текущей страницы.
  document.querySelector('[data-scroll-top]')?.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`
    );
  });

  // После навигации обновляем активный пункт и закрываем меню, если оно открыто.
  document.addEventListener('route:change', (event) => {
    updateActiveNav(event.detail.section);
    if (mobileNav?.classList.contains('show')) {
      focusAfterMenuClose = true;
      Offcanvas.getInstance(mobileNav)?.hide();
    }
  });

  // aria-expanded должен отражать реальное состояние Offcanvas.
  mobileNav?.addEventListener('show.bs.offcanvas', () => {
    focusAfterMenuClose = false;
    setMenuExpanded(true);
  });

  mobileNav?.addEventListener('hidden.bs.offcanvas', () => {
    setMenuExpanded(false);
    if (focusAfterMenuClose) {
      focusAfterMenuClose = false;
      document.querySelector('[data-route-heading]')?.focus({ preventScroll: true });
    }
  });

  // После открытия переводим фокус на первый доступный элемент меню.
  mobileNav?.addEventListener('shown.bs.offcanvas', () => {
    const focusable = Array.from(
      mobileNav.querySelectorAll('a[href], button:not([disabled])')
    ).filter((element) => element.offsetParent !== null);
    focusable[0]?.focus({ preventScroll: true });
  });

  // Ручной focus trap: Tab не уходит за пределы открытого меню.
  mobileNav?.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      mobileNav.querySelectorAll('a[href], button:not([disabled])')
    ).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Навигационный клик закрывает меню, а фокус после анимации
  // возвращается на заголовок нового раздела.
  mobileNav?.querySelectorAll('[data-nav]').forEach((link) => {
    link.addEventListener('click', () => {
      focusAfterMenuClose = true;
      Offcanvas.getInstance(mobileNav)?.hide();
    });
  });

  requestAnimationFrame(updateNavMarker);
}
