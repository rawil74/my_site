// Появление блоков при первом показе и при прокрутке.
// Блоки выше первого экрана получают короткую каскадную задержку,
// остальные ждут IntersectionObserver. Возвращаемая функция снимает наблюдатели.
const MAX_INITIAL_DELAY = 240;

/**
 * @param {HTMLElement} root — контейнер вида
 * @param {{reduce?: boolean}} options
 * @returns {() => void} cleanup
 */
export function setupReveals(root, { reduce = false } = {}) {
  if (!root) return () => {};
  const blocks = Array.from(root.querySelectorAll('[data-block]'));

  // При reduced-motion блоки сразу видимы, без наблюдения.
  if (reduce) {
    blocks.forEach((block) => block.classList.add('is-in'));
    return () => {};
  }

  const viewport = window.innerHeight;
  const initial = [];
  const deferred = [];

  // Разделяем блоки на те, что уже в первом экране, и те, что ждут скролла.
  blocks.forEach((block) => {
    const rect = block.getBoundingClientRect();
    if (rect.top < viewport * 0.94 && rect.bottom > -40) {
      initial.push(block);
    } else {
      deferred.push(block);
    }
  });

  initial.forEach((block, index) => {
    const delay = Math.min(index * 55, MAX_INITIAL_DELAY);
    block.style.setProperty('--delay', `${delay}ms`);
  });

  requestAnimationFrame(() => {
    initial.forEach((block) => block.classList.add('is-in'));
  });

  // Остальные блоки появляются при входе в область просмотра.
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.setProperty('--delay', '0ms');
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.06 }
  );

  deferred.forEach((block) => observer.observe(block));

  // Если пользователь перешёл по якорю или Tab-ом внутрь ещё скрытого
  // блока, показываем его сразу, не дожидаясь прокрутки.
  const onFocusIn = (event) => {
    const block = event.target.closest?.('[data-block]');
    if (!block || block.classList.contains('is-in')) return;
    block.style.setProperty('--delay', '0ms');
    block.classList.add('is-in');
    observer.unobserve(block);
  };
  root.addEventListener('focusin', onFocusIn);

  return () => {
    observer.disconnect();
    root.removeEventListener('focusin', onFocusIn);
  };
}
