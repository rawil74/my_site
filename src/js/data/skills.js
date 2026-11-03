// Справочник навыков: легенда уровней и группы компетенций.
// Уровни описывают контекст применения, а не «процент владения».
// TODO(author): уровни — рабочая оценка, уточнить после ревью.
export const skillLegend = [
  { level: 'study', label: 'изучаю' },
  { level: 'edu', label: 'учебные проекты' },
  { level: 'self', label: 'самостоятельные проекты' },
  { level: 'work', label: 'рабочее применение' },
];

export const skillGroups = [
  {
    index: '01',
    title: 'Стек',
    note: 'Порядок — от самого сильного к базовому.',
    skills: [
      {
        name: 'Python',
        context: 'основной язык: FastAPI-сервисы, SQLAlchemy, автоматизация',
        level: 'self',
      },
      {
        name: 'FastAPI',
        context: 'HTTP API и WebSocket-комнаты Quiz Service',
        level: 'self',
      },
      {
        name: 'SQLAlchemy',
        context: 'модели, запросы и миграции в Quiz Service',
        level: 'self',
      },
      {
        name: 'PostgreSQL',
        context: 'основное хранилище: схема, индексы, запросы',
        level: 'self',
      },
      {
        name: 'Redis',
        context: 'кэш, состояние комнат и координация',
        level: 'self',
      },
      {
        name: 'Docker',
        context: 'локальное окружение и запуск сервисов через compose',
        level: 'self',
      },
      {
        name: 'Godot 4',
        context: 'веб-геймдев: прототипы и небольшие игры',
        level: 'edu',
      },
      {
        name: 'JavaScript / TypeScript',
        context: 'фронтенд сайта, SPA-роутер и canvas-сцена',
        level: 'self',
      },
      {
        name: 'ClickHouse',
        context: 'аналитика событий викторин',
        level: 'edu',
      },
      {
        name: '1С',
        context: 'прикладная разработка и интеграции',
        level: 'edu',
      },
      {
        name: 'C#',
        context: 'базовый уровень: учебные задачи и инструменты',
        level: 'study',
      },
    ],
  },
  {
    index: '02',
    title: 'Инженерные практики',
    note: 'То, что применяю в собственных сервисах.',
    skills: [
      {
        name: 'Чистая архитектура',
        context: 'границы слоёв и зависимости по Мартину',
        level: 'self',
      },
      {
        name: 'Авторизация',
        context: 'аутентификация, роли и доступ в сервисах',
        level: 'self',
      },
      {
        name: 'Тестирование',
        context: 'юнит- и интеграционные проверки API и домена',
        level: 'self',
      },
    ],
  },
  {
    index: '03',
    title: 'База и дополнительно',
    note: 'Фундамент, на который опираются решения.',
    skills: [
      {
        name: 'Веб и сети',
        context: 'HTTP, WebSocket и базовая модель сети',
        level: 'self',
      },
      {
        name: 'Хранение данных',
        context:
          'нормализация, денормализация, кэш, простые и составные индексы, шардирование',
        level: 'self',
      },
      {
        name: 'Нейросети',
        context: 'терминология и запуск локальных квантованных моделей',
        level: 'self',
      },
      {
        name: 'Веб-геймдев',
        context: 'небольшой опыт прототипов на Godot 4',
        level: 'edu',
      },
    ],
  },
];
