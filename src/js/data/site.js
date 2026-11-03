// Глобальные данные сайта: имя, роль, контакты и основная навигация.
// TODO(author): заменить заглушки имени, почты и ссылок на реальные данные.
export const site = {
  firstName: 'Равиль',
  lastName: 'Фамилия',
  fullName: 'Равиль Фамилия',
  role: 'Разработчик · backend, Python / FastAPI',
  tagline: 'Разбираюсь в системах. Создаю свои.',
  intro:
    'Проектирую бэкенд на Python: модели данных, API и реальное время. До интерфейса довожу сам — от сетки и типографики до canvas-сцены. Люблю, когда сложное объясняется просто, а система ведёт себя предсказуемо.',
  email: 'hello@example.com',
  emailIsPlaceholder: true,
  github: 'https://github.com/rawil74',
  nav: [
    { id: 'home', label: 'Главная', path: '/' },
    { id: 'about', label: 'Обо мне', path: '/about' },
    { id: 'projects', label: 'Проекты', path: '/projects' },
    { id: 'skills', label: 'Навыки', path: '/skills' },
    { id: 'goals', label: 'Цели', path: '/goals' },
  ],
  socials: [
    {
      label: 'GitHub',
      value: 'github.com/rawil74',
      href: 'https://github.com/rawil74',
      external: true,
    },
    {
      label: 'Telegram',
      value: '[добавить ссылку]',
      href: null,
    },
    {
      label: 'Email',
      value: 'hello@example.com',
      href: 'mailto:hello@example.com',
      placeholder: true,
    },
  ],
};
