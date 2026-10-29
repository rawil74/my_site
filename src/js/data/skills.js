// Справочник навыков: легенда уровней и группы компетенций.
// Уровни описывают контекст применения, а не «процент владения».
// TODO(author): уровни и контекст применения — заглушки для прототипа.
export const skillLegend = [
  { level: 'study', label: 'изучаю' },
  { level: 'edu', label: 'учебные проекты' },
  { level: 'self', label: 'самостоятельные проекты' },
  { level: 'work', label: 'рабочее применение' },
];

export const skillGroups = [
  {
    index: '01',
    title: 'Языки',
    note: 'То, на чём формулируются решения.',
    skills: [
      { name: 'TypeScript', context: 'основной язык в проектах и инструментах', level: 'self' },
      { name: 'JavaScript', context: 'браузер, Node.js, canvas-эксперименты', level: 'self' },
      { name: 'SQL', context: 'модели данных, запросы, миграции', level: 'self' },
      { name: 'Python', context: 'учебные задачи и автоматизация', level: 'edu' },
    ],
  },
  {
    index: '02',
    title: 'Backend',
    note: 'API, доменная логика и работа с состоянием.',
    skills: [
      { name: 'Node.js', context: 'HTTP-сервисы, CLI-инструменты', level: 'self' },
      { name: 'Fastify', context: 'API для собственных проектов', level: 'self' },
      { name: 'REST', context: 'проектирование контрактов и ошибок', level: 'self' },
      { name: 'Очереди и фоновые задачи', context: 'сценарии обработки данных', level: 'study' },
    ],
  },
  {
    index: '03',
    title: 'Frontend',
    note: 'Интерфейс как продолжение модели.',
    skills: [
      { name: 'React', context: 'интерфейсы карт, каталогов и форм', level: 'self' },
      { name: 'Vue 3', context: 'личная библиотека материалов', level: 'self' },
      { name: 'CSS / SCSS', context: 'дизайн-системы, сетки, адаптивность', level: 'self' },
      { name: 'Canvas 2D', context: 'генеративный фон и визуализация', level: 'study' },
    ],
  },
  {
    index: '04',
    title: 'Данные',
    note: 'Хранение, связи и честная цена решений.',
    skills: [
      { name: 'PostgreSQL', context: 'реляционные модели и запросы', level: 'self' },
      { name: 'SQLite', context: 'локальные приложения и эксперименты', level: 'self' },
      { name: 'Redis', context: 'кэш и сценарии очередей', level: 'study' },
      { name: 'Индексы и запросы', context: 'чтение планов, оптимизация выборок', level: 'study' },
    ],
  },
  {
    index: '05',
    title: 'Архитектура',
    note: 'Границы, компромиссы и объяснимые решения.',
    skills: [
      { name: 'Моделирование предметной области', context: 'сущности, связи, ограничения', level: 'self' },
      { name: 'Проектирование API', context: 'контракты и обработка ошибок', level: 'self' },
      { name: 'Технические решения', context: 'ADR и разбор альтернатив', level: 'edu' },
      { name: 'Распределённые системы', context: 'теория и учебные сценарии', level: 'study' },
    ],
  },
  {
    index: '06',
    title: 'Тестирование',
    note: 'Проверка поведения, а не количества тестов.',
    skills: [
      { name: 'Vitest', context: 'юнит-тесты доменной логики', level: 'self' },
      { name: 'Playwright', context: 'сценарии интерфейса и скриншоты', level: 'edu' },
      { name: 'Тестовые данные', context: 'фикстуры и воспроизводимые сценарии', level: 'edu' },
      { name: 'Ручная проверка', context: 'адаптивность, клавиатура, состояния', level: 'self' },
    ],
  },
  {
    index: '07',
    title: 'Инфраструктура',
    note: 'Чтобы систему можно было запустить и повторить.',
    skills: [
      { name: 'Git', context: 'ветки, история, ревью собственных изменений', level: 'self' },
      { name: 'Docker', context: 'локальные окружения', level: 'edu' },
      { name: 'Linux / shell', context: 'базовые сценарии разработки', level: 'edu' },
      { name: 'Vite', context: 'сборка и структура фронтенда', level: 'self' },
    ],
  },
];
