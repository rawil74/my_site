// Контроллер фоновой сцены.
// Canvas создаётся один раз в index.html; сцена сама владеет RAF, resize,
// курсором, reduced-motion и паузой при скрытой вкладке.
import { createTriangleScene } from './triangle-scene.js';

/** Упрощённый режим для телефонов, слабых машин и экономии трафика. */
function detectQuality() {
  if (window.innerWidth < 768) return 'low';
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    return 'low';
  }
  if (navigator.connection?.saveData) return 'low';
  return 'high';
}

/**
 * Свечение — это теневой проход на каждой собранной плитке, самый дорогой
 * эффект сцены. На слабых устройствах сразу включаем плоскую кромку, чтобы
 * первые же кадры не тормозили. Ширина экрана здесь намеренно не участвует:
 * современный телефон с 8 ядрами спокойно тянет свечение.
 */
function detectEffects() {
  if (navigator.connection?.saveData) return 'flat';
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) return 'flat';
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    return 'flat';
  }
  return 'glow';
}

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

  const quality = mode === 'low' ? 'low' : detectQuality();
  // ?bg=low already means "give me the cheapest version", so it also disables
  // the glow. Otherwise weak hardware is detected separately from quality.
  const effects = mode === 'low' ? 'flat' : detectEffects();

  if (effects === 'flat') root.classList.add('bg-flat');

  let scene = null;
  try {
    scene = createTriangleScene(canvas, {
      quality,
      effects,
      // The scene can downgrade itself after measuring real frame gaps. Mirror
      // that into the document so CSS/markup can react if needed.
      onEffectsChange(next) {
        root.classList.toggle('bg-flat', next === 'flat');
      },
    });
  } catch (error) {
    // A broken canvas or context must not take the whole page down with it.
    console.error('Фоновая сцена не запустилась:', error);
  }

  if (!scene) {
    root.classList.remove('bg-flat');
    root.classList.add('bg-off');
    return {
      setSection: noop,
      setPointer: noop,
      pause: noop,
      resume: noop,
      dispose: noop,
    };
  }

  root.classList.add('bg-on');
  if (quality === 'low') root.classList.add('bg-low');

  // Смена маршрута не пересоздаёт сцену: фон живёт отдельно от вида.
  return {
    setSection: noop,
    setPointer: noop,
    pause: scene.pause,
    resume: scene.resume,
    dispose() {
      scene.dispose();
      root.classList.remove('bg-on', 'bg-low', 'bg-flat');
    },
  };
}
