// History API-роутер для SPA.
// Поддерживает прямые URL, обновление страницы, кнопки браузера и
// восстановление позиции скролла. Содержимое рендерится до обновления URL,
// а смена вида идёт через общий переход в render/motion.js.
import { site } from './data/site.js';
import { renderView } from './render/blocks.js';
import { resolveView } from './render/views.js';
import { cleanupMotion, prefersReducedMotion, swapView } from './render/motion.js';

// Позиции скролла храним по нормализованному пути, чтобы возврат назад
// открывал страницу в том же месте, где пользователь её оставил.
const scrollPositions = new Map();

let root;
let currentPath = normalizePath(window.location.pathname);

/** Убирает завершающие слэши, кроме корня. */
function normalizePath(path) {
  if (!path || path === '/') return '/';
  const normalized = path.replace(/\/+$/, '');
  return normalized || '/';
}

/** Сохраняет query-параметры (например, ?bg=off) при смене маршрута. */
function routeUrl(path) {
  return `${path}${window.location.search}`;
}

/** Синхронизирует title и meta description с текущим видом. */
function updateDocument(view) {
  const isHome = view.id === 'home';
  document.title = isHome
    ? `${site.fullName} — разработчик`
    : `${view.title} — ${site.fullName}`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', view.description);
}

/** Озвучивает переход через aria-live, не уводя фокус с заголовка. */
function announce(view) {
  const status = document.getElementById('route-status');
  if (status) status.textContent = `Открыт раздел: ${view.title}`;
}

/** Ставит фокус на h1 нового вида для клавиатурной и скринридерной навигации. */
function focusHeading() {
  const heading = root.querySelector('[data-route-heading]');
  if (heading) heading.focus({ preventScroll: true });
}

/** Сообщает оболочке и фону, какой раздел сейчас открыт. */
function emitRouteChange(view, path) {
  document.dispatchEvent(
    new CustomEvent('route:change', {
      detail: { view, path, section: view.section },
    })
  );
}

/**
 * Рендерит маршрут и синхронизирует историю/документ.
 * swapView анимирует выход старого вида; если переход отменён (быстрый клик),
 * completed === false и история не меняется.
 */
async function render(path, { replace = false, pop = false, initial = false, restoreY = 0 } = {}) {
  const normalized = normalizePath(path);
  const view = resolveView(normalized);
  const html = renderView(view);
  const scrollY = pop ? restoreY : 0;

  const completed = await swapView(root, html, { scrollY });
  if (!completed) return;

  currentPath = normalized;
  if (replace || initial) {
    window.history.replaceState({ path: normalized }, '', routeUrl(normalized));
  } else if (!pop) {
    window.history.pushState({ path: normalized }, '', routeUrl(normalized));
  }

  document.documentElement.dataset.section = view.section;
  updateDocument(view);
  announce(view);
  focusHeading();
  emitRouteChange(view, normalized);
}

/** Публичная навигация: используется ссылками, меню и будущими кнопками. */
export function navigate(path, options = {}) {
  const normalized = normalizePath(path);
  if (!options.pop && !options.initial && normalized === currentPath) {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    return;
  }

  // Перед уходом запоминаем позицию текущей страницы.
  if (!options.pop && !options.initial) {
    scrollPositions.set(currentPath, window.scrollY);
  }

  render(normalized, options).catch((error) => {
    console.error('Не удалось открыть маршрут', error);
  });
}

/** Не перехватываем клики с модификаторами (новая вкладка, скачивание и т. п.). */
function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Глобальный перехват внутренних ссылок.
 * Внешние домены, mailto:, tel:, download и target="_blank" остаются
 * обычными ссылками браузера.
 */
function onDocumentClick(event) {
  const link = event.target.closest?.('a');
  if (!link || event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) return;
  if (link.target && link.target !== '_self') return;
  if (link.hasAttribute('download') || link.dataset.noRoute !== undefined) return;

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return;

  const path = normalizePath(url.pathname);
  const samePath = path === normalizePath(window.location.pathname);

  if (samePath && url.hash) return;
  if (link.href.startsWith('mailto:') || link.href.startsWith('tel:')) return;

  event.preventDefault();

  // Клик по уже открытому разделу просто поднимает страницу наверх.
  if (samePath && !url.hash) {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    return;
  }

  navigate(path);
}

/** Возврат/вперёд: восстанавливаем сохранённую позицию скролла. */
function onPopState() {
  scrollPositions.set(currentPath, window.scrollY);
  const path = normalizePath(window.location.pathname);
  const restoreY = scrollPositions.get(path) ?? 0;
  render(path, { pop: true, restoreY }).catch((error) => {
    console.error('Не удалось восстановить маршрут', error);
  });
}

/** Инициализация роутера после монтирования оболочки. */
export function initRouter() {
  root = document.getElementById('view-root');
  if (!root) throw new Error('Не найден контейнер #view-root');

  // Отключаем встроенное восстановление: им управляет scrollPositions.
  window.history.scrollRestoration = 'manual';
  const initial = normalizePath(window.location.pathname);
  window.history.replaceState({ path: initial }, '', routeUrl(initial));

  document.addEventListener('click', onDocumentClick);
  window.addEventListener('popstate', onPopState);
  window.addEventListener('beforeunload', cleanupMotion, { once: true });

  render(initial, { initial: true, replace: true }).catch((error) => {
    console.error('Не удалось открыть сайт', error);
  });
}

