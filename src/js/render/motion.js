// Управление переходом между видами.
// Сначала старому виду даём короткую анимацию выхода, затем заменяем HTML
// и включаем наблюдение за появлением блоков. runId защищает от гонок,
// если пользователь быстро кликает по нескольким ссылкам.
import { setupReveals } from './reveal.js';

// Держим эти значения синхронно с --t-exit и небольшой паузой после вставки
// нового вида в _tokens.scss / _motion.scss. Иначе JS обрывает анимацию CSS.
const EXIT_MS = 340;
const ENTER_SETTLE_MS = 80;

let runId = 0;
let activeCleanup = () => {};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Единая проверка системной настройки «уменьшить движение». */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Заменяет текущий вид новым HTML.
 * @returns {Promise<boolean>} false, если переход был отменён более новым.
 */
export async function swapView(root, html, { scrollY = 0 } = {}) {
  const id = ++runId;
  const reduce = prefersReducedMotion();
  const previousView = root.querySelector('.view');

  root.setAttribute('aria-busy', 'true');

  if (previousView && !reduce) {
    previousView.classList.add('is-leaving');
    await wait(EXIT_MS);
    if (id !== runId) return false;
  }

  // Снимаем наблюдатели предыдущего вида до замены DOM.
  activeCleanup();
  activeCleanup = () => {};

  root.innerHTML = html;
  window.scrollTo(0, scrollY);

  const view = root.querySelector('.view');
  if (view) {
    activeCleanup = setupReveals(view, { reduce });
  }

  await wait(reduce ? 0 : ENTER_SETTLE_MS);
  if (id !== runId) return false;

  root.setAttribute('aria-busy', 'false');
  return true;
}

/** Освобождает наблюдатели при выгрузке страницы или HMR. */
export function cleanupMotion() {
  runId += 1;
  activeCleanup();
  activeCleanup = () => {};
}

