// Полноэкранный просмотр иллюстраций: увеличение, пан и щипковый зум.
// Сценарий рассчитан на телефон: любое касание рамки открывает просмотр,
// а внутри работают кнопки, двойной тап, жест двумя пальцами и колесо.
// Модуль строит <dialog> лениво, чтобы не держать лишнюю разметку на странице.

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;
const DOUBLE_TAP_SCALE = 2.2;
const DOUBLE_TAP_DELAY = 320;

let dialog;
let viewport;
let content;
let title;
let percent;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let pointers = new Map();
let pinchStart = null;
let moved = false;
let lastTap = 0;
let lastTapX = 0;
let lastTapY = 0;

/** Ограничивает масштаб рабочим диапазоном. */
const clampScale = (value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

/** Держит изображение в пределах вьюпорта, чтобы его нельзя было «увезти». */
function clampOffset() {
  const rect = viewport.getBoundingClientRect();
  const maxX = (rect.width * (scale - 1)) / 2;
  const maxY = (rect.height * (scale - 1)) / 2;
  offsetX = Math.min(maxX, Math.max(-maxX, offsetX));
  offsetY = Math.min(maxY, Math.max(-maxY, offsetY));
}

/** Применяет текущее состояние к сцене и обновляет подпись масштаба. */
function applyTransform() {
  content.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
  percent.textContent = `${Math.round(scale * 100)}%`;
  viewport.classList.toggle('is-zoomed', scale > ZOOM_MIN + 0.01);
}

function resetTransform() {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  applyTransform();
}

/** Меняет масштаб с сохранением центра и сразу пересчитывает границы. */
function zoomBy(delta) {
  scale = clampScale(scale + delta);
  if (scale === ZOOM_MIN) {
    offsetX = 0;
    offsetY = 0;
  }
  clampOffset();
  applyTransform();
}

function toggleZoom() {
  if (scale > ZOOM_MIN + 0.01) {
    resetTransform();
  } else {
    scale = clampScale(DOUBLE_TAP_SCALE);
    clampOffset();
    applyTransform();
  }
}

/** Собирает диалог и подписки один раз при первом открытии. */
function ensureDialog() {
  if (dialog) return;

  document.body.insertAdjacentHTML(
    'beforeend',
    `<dialog class="media-viewer" aria-label="Просмотр изображения">
      <div class="media-viewer__bar">
        <p class="media-viewer__title mono"></p>
        <div class="media-viewer__tools">
          <button class="media-viewer__tool" type="button" data-zoom-out aria-label="Уменьшить">−</button>
          <button class="media-viewer__tool media-viewer__zoom mono" type="button" data-zoom-value aria-label="Сбросить масштаб">100%</button>
          <button class="media-viewer__tool" type="button" data-zoom-in aria-label="Увеличить">+</button>
          <button class="media-viewer__tool media-viewer__tool--close" type="button" data-media-close aria-label="Закрыть просмотр">×</button>
        </div>
      </div>
      <div class="media-viewer__viewport" data-media-viewport>
        <div class="media-viewer__content" data-media-content></div>
      </div>
    </dialog>`
  );

  dialog = document.querySelector('.media-viewer');
  viewport = dialog.querySelector('[data-media-viewport]');
  content = dialog.querySelector('[data-media-content]');
  title = dialog.querySelector('.media-viewer__title');
  percent = dialog.querySelector('[data-zoom-value]');

  dialog.querySelector('[data-zoom-in]').addEventListener('click', () => zoomBy(ZOOM_STEP));
  dialog.querySelector('[data-zoom-out]').addEventListener('click', () => zoomBy(-ZOOM_STEP));
  dialog.querySelector('[data-zoom-value]').addEventListener('click', resetTransform);
  dialog.querySelector('[data-media-close]').addEventListener('click', () => dialog.close());

  // Клик по тёмному полю вокруг иллюстрации закрывает просмотр.
  viewport.addEventListener('click', (event) => {
    if (scale > ZOOM_MIN + 0.01 || moved) return;
    if (event.target.closest('svg, img')) return;
    dialog.close();
  });

  viewport.addEventListener('dblclick', (event) => {
    if (event.target.closest('svg, img')) event.preventDefault();
    toggleZoom();
  });

  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 0.2 : -0.2);
    },
    { passive: false }
  );

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved = false;
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      pinchStart = {
        distance: Math.hypot(first.x - second.x, first.y - second.y),
        scale,
      };
    }
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId);
    const next = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, next);

    if (pointers.size === 2 && pinchStart) {
      const [first, second] = [...pointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (pinchStart.distance > 0) {
        scale = clampScale((pinchStart.scale * distance) / pinchStart.distance);
        clampOffset();
        applyTransform();
        moved = true;
      }
      return;
    }

    if (scale <= ZOOM_MIN + 0.01) return;
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    offsetX += dx;
    offsetY += dy;
    clampOffset();
    applyTransform();
  });

  const endPointer = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = null;

    // Двойной тап на телефоне: первый увеличивает, второй возвращает.
    if (!moved && event.pointerType !== 'mouse') {
      const now = Date.now();
      const nearLast =
        Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 30;
      if (now - lastTap < DOUBLE_TAP_DELAY && nearLast) {
        toggleZoom();
        lastTap = 0;
      } else {
        lastTap = now;
        lastTapX = event.clientX;
        lastTapY = event.clientY;
      }
    }
  };

  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  dialog.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomBy(-ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      resetTransform();
    }
  });

  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('media-viewer-open');
    content.replaceChildren();
    pointers = new Map();
    pinchStart = null;
    resetTransform();
  });
}

/** Переносит копию иллюстрации в диалог и открывает его. */
function openViewer(trigger) {
  const frame = trigger.closest('.figure__frame');
  const media = frame?.querySelector('.figure__media');
  if (!media) return;

  ensureDialog();

  const figure = trigger.closest('figure');
  const caption = figure?.querySelector('.figure__caption span')?.textContent.trim();
  const diagramLabel = media.querySelector('svg')?.getAttribute('aria-label');
  const imageAlt = media.querySelector('img')?.alt;
  const label = caption || diagramLabel || imageAlt || 'Просмотр изображения';

  title.textContent = label;
  content.replaceChildren(media.cloneNode(true));
  dialog.setAttribute('aria-label', label);
  resetTransform();
  document.documentElement.classList.add('media-viewer-open');
  dialog.showModal();
  dialog.querySelector('[data-media-close]')?.focus({ preventScroll: true });
}

/** Подключает делегированный обработчик ко всем рамкам иллюстраций. */
export function initMediaViewer() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-media-open]');
    if (!trigger) return;
    event.preventDefault();
    openViewer(trigger);
  });
}
