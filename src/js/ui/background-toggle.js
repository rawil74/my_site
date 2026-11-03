// Переключатель фоновой анимации в шапке.
// Сцена создаётся в main.js и передаётся сюда готовой: модуль не знает про
// canvas, он только ставит её на паузу и переключает класс bg-off, который
// уже используется для режима «?bg=off».
const STORAGE_KEY = 'background';

function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Приватный режим или запрет хранилища: настройка живёт до перезагрузки.
    return null;
  }
}

function savePreference(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

/** Подключает кнопку «Фон» к готовой сцене. */
export function initBackgroundToggle(background) {
  const root = document.documentElement;
  const button = document.querySelector('[data-bg-toggle]');
  if (!button) return;

  // ?bg=off (или сцена не запустилась) — включать нечего, кнопка не нужна.
  if (root.classList.contains('bg-off')) {
    button.hidden = true;
    return;
  }

  let enabled = readPreference() !== 'off';
  const label = button.querySelector('[data-bg-toggle-label]');

  const apply = (next) => {
    enabled = next;
    root.classList.toggle('bg-off', !enabled);
    if (enabled) background.resume();
    else background.pause();
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Выключить фон' : 'Включить фон');
    button.title = enabled ? 'Выключить фон' : 'Включить фон';
    // На десктопе подпись называет действие, на телефоне остаётся слово «Фон»,
    // а состояние показывает индикатор.
    if (label) label.textContent = enabled ? 'Выкл. фон' : 'Вкл. фон';
  };

  apply(enabled);

  button.addEventListener('click', () => {
    apply(!enabled);
    savePreference(enabled ? 'on' : 'off');
  });
}
