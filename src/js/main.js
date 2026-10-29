// Точка входа приложения.
// Здесь собираются шрифты, Bootstrap, стили, оболочка, фон и роутер.
import '@fontsource-variable/unbounded';
import '@fontsource-variable/golos-text';
import '@fontsource-variable/jetbrains-mono';
import 'bootstrap';

import '../scss/styles.scss';

import { site } from './data/site.js';
import { createBackground } from './background/index.js';
import { initRouter } from './router.js';
import { initShell, mountShell } from './ui/shell.js';

document.documentElement.classList.add('js');

// Шапка, мобильное меню и подвал монтируются до первого рендера маршрута,
// чтобы при прямом открытии страницы оболочка уже была на месте.
mountShell(site);
initShell();

// Canvas создаётся один раз. Роутер только сообщает ему текущий раздел,
// поэтому сцена не перезагружается при переходах.
const background = createBackground(document.getElementById('bg-canvas'));

initRouter();

// При горячей замене модулей аккуратно освобождаем ресурсы canvas.
if (import.meta.hot) {
  import.meta.hot.dispose(() => background.dispose());
}
