// Контроллер фоновой сцены.
// Canvas создаётся один раз, а при смене раздела плавно меняются только
// параметры энергии и плотности. Сцена рисуется в requestAnimationFrame
// и останавливается при скрытой вкладке или reduced-motion.
import { createPlaceholderScene } from './placeholder-scene.js';

// Параметры для каждого раздела: характер фона меняется, но сцена остаётся той же.
const SECTION_STATE = {
  home: { energy: 0.82, density: 1 },
  about: { energy: 0.48, density: 0.82 },
  projects: { energy: 0.92, density: 1.08 },
  skills: { energy: 0.38, density: 0.7 },
  goals: { energy: 0.64, density: 0.9 },
  404: { energy: 0.28, density: 0.55 },
};

/** Упрощённый режим для телефонов, слабых машин и экономии трафика. */
function detectQuality() {
  if (window.innerWidth < 768) return 'low';
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return 'low';
  if (navigator.connection?.saveData) return 'low';
  return 'high';
}

// Заглушка для случая, когда canvas недоступен или отключён через ?bg=off.
const noop = () => {};

/**
 * Инициализирует фон и возвращает небольшой API управления.
 * @param {HTMLCanvasElement | null} canvas
 */
export function createBackground(canvas) {
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('bg');

  if (!canvas || mode === 'off') {
    root.classList.add('bg-off');
    return {
      setSection: noop,
      setPointer: noop,
      pause: noop,
      resume: noop,
      dispose: noop,
    };
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    root.classList.add('bg-off');
    return { setSection: noop, setPointer: noop, pause: noop, resume: noop, dispose: noop };
  }

  const quality = mode === 'low' ? 'low' : detectQuality();
  root.classList.add('bg-on');
  if (quality === 'low') root.classList.add('bg-low');

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = createPlaceholderScene(ctx, { quality });

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let last = performance.now();
  let time = 0;
  let paused = false;
  let destroyed = false;

  // current плавно догоняет target; pointer — отдельное сглаживание курсора.
  const initialState = SECTION_STATE[document.documentElement.dataset.section] || SECTION_STATE.home;
  let current = { ...initialState, pointer: { x: 0.5, y: 0.5 } };
  let target = { ...initialState, pointer: { x: 0.5, y: 0.5 } };
  const pointer = { x: 0.5, y: 0.5 };
  const pointerTarget = { x: 0.5, y: 0.5 };

  /** Подгоняет размер canvas под CSS-размер и devicePixelRatio. */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(
      window.devicePixelRatio || 1,
      quality === 'low' ? 1.25 : 2
    );
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene.resize({ width, height, dpr });
    drawOnce();
  }

  function drawOnce() {
    scene.render(
      {
        ...current,
        pointer: { x: pointer.x, y: pointer.y },
      },
      time
    );
  }

  /** Основной цикл: экспоненциальное сглаживание и отрисовка сцены. */
  function frame(now) {
    if (destroyed || paused) return;
    const dt = Math.min(48, now - last) / 1000;
    last = now;
    time += dt;

    const ease = 1 - Math.exp(-dt * 2.6);
    const pointerEase = 1 - Math.exp(-dt * 3.8);

    current.energy += (target.energy - current.energy) * ease;
    current.density += (target.density - current.density) * ease;
    pointer.x += (pointerTarget.x - pointer.x) * pointerEase;
    pointer.y += (pointerTarget.y - pointer.y) * pointerEase;

    drawOnce();
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (destroyed || paused || reduceQuery.matches || raf) return;
    last = performance.now();
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  /** Меняет целевые параметры сцены без её пересоздания. */
  function setSection(section) {
    const next = SECTION_STATE[section] || SECTION_STATE.home;
    target = { ...target, ...next };
    if (reduceQuery.matches) {
      current = { ...target };
      drawOnce();
    }
  }

  function setPointer(x, y) {
    pointerTarget.x = Math.max(0, Math.min(1, x));
    pointerTarget.y = Math.max(0, Math.min(1, y));
  }

  function onPointerMove(event) {
    setPointer(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
  }

  /** Не тратим кадры, пока вкладка не видна. */
  function onVisibilityChange() {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  }

  function onReduceChange() {
    if (reduceQuery.matches) {
      stop();
      current = { ...target };
      drawOnce();
    } else {
      start();
    }
  }

  function onRouteChange(event) {
    setSection(event.detail?.section || 'home');
  }

  // Подписки на размер, курсор, видимость, маршрут и системные настройки.
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('route:change', onRouteChange);
  reduceQuery.addEventListener?.('change', onReduceChange);
  window.addEventListener('resize', resize);

  resize();
  if (reduceQuery.matches) {
    current = { ...target };
    drawOnce();
  } else {
    start();
  }

  // Публичный API для роутера и HMR.
  return {
    setSection,
    setPointer,
    pause() {
      paused = true;
      stop();
    },
    resume() {
      paused = false;
      start();
    },
    dispose() {
      destroyed = true;
      stop();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('route:change', onRouteChange);
      reduceQuery.removeEventListener?.('change', onReduceChange);
      window.removeEventListener('resize', resize);
      root.classList.remove('bg-on', 'bg-low');
    },
  };
}
