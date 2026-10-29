// Описание маршрутов и композиций страниц.
// Здесь данные из /data превращаются в декларативный список блоков,
// который затем рендерится в render/blocks.js. Никакой HTML-разметки
// на этом уровне нет: так проще менять состав страниц.
import { site } from '../data/site.js';
import { about } from '../data/about.js';
import { featuredProject, findProject, nextProject, projects } from '../data/projects.js';
import { skillGroups, skillLegend } from '../data/skills.js';
import { goals } from '../data/goals.js';

/** Короткий конструктор карточки проекта. */
const projectTile = (project, variant, extra = {}) => ({
  type: 'project-tile',
  project,
  variant,
  ...extra,
});

/** Конструктор вводного экрана обычной страницы. */
const pageHero = (eyebrow, title, lead, meta = []) => ({
  type: 'hero',
  variant: 'page',
  eyebrow,
  title,
  lead,
  meta,
});

/** Главная: короткая история от знакомства до контактов. */
function homeView() {
  return {
    id: 'home',
    section: 'home',
    title: 'Главная',
    description: `${site.fullName} — разработчик. ${site.tagline}`,
    blocks: [
      {
        type: 'hero',
        variant: 'home',
        eyebrow: 'Разработчик',
        nameLines: [site.firstName, site.lastName],
        tagline: site.tagline,
        intro: site.intro,
        actions: [
          { label: 'Смотреть проекты', href: '/projects', variant: 'solid' },
          { label: 'Обо мне', href: '/about', variant: 'ghost' },
        ],
        meta: [
          { label: 'Роль', value: site.role },
          { label: 'Фокус', value: 'системы / интерфейсы' },
        ],
      },
      {
        type: 'prose',
        variant: 'statement',
        eyebrow: 'Подход',
        text:
          'Я собираю системы, в которых <span class="is-bright">модель данных, API и интерфейс</span> говорят на одном языке. Сначала разбираюсь в устройстве, потом выбираю инструменты — и стараюсь оставлять решения, которые можно объяснить.',
        note: 'модель → контур → интерфейс',
        diagram: ['модель', 'границы', 'эксплуатация'],
      },
      projectTile(featuredProject, 'featured', {
        eyebrow: 'Избранный проект',
      }),
      {
        type: 'matrix',
        variant: 'compact',
        eyebrow: 'Компетенции',
        title: 'Инструменты под задачу',
        note: 'Без процентов и рейтингов — только то, что уже применялось.',
        groups: skillGroups,
      },
      {
        type: 'timeline',
        variant: 'vector',
        eyebrow: 'Вектор',
        title: 'Куда двигаюсь',
        items: goals.horizons,
        action: { label: 'Подробнее о целях', href: '/goals' },
      },
      {
        type: 'contact',
        variant: 'home',
        eyebrow: 'Контакт',
        title: 'Есть задача или идея?',
        text: 'Открыт к разговору о продуктах, инструментах и инженерных задачах.',
      },
    ],
  };
}

/** Обо мне: позиция, хронология, принципы и текущий фокус. */
function aboutView() {
  return {
    id: 'about',
    section: 'about',
    title: 'Обо мне',
    description: about.lead,
    blocks: [
      pageHero('Обо мне', about.heroTitle, about.lead, about.meta),
      {
        type: 'prose',
        variant: 'statement',
        eyebrow: 'Позиция',
        text:
          'Мне близок подход, где <span class="is-bright">сложность остаётся управляемой</span>: границы модулей понятны, данные имеют владельца, а интерфейс не прячет цену решения. Я учусь на собственных проектах и разбираю чужие.',
        note: 'модель → границы → проверка',
        diagram: ['смысл', 'структура', 'проверка'],
      },
      {
        type: 'timeline',
        variant: 'vertical',
        eyebrow: 'Хронология',
        title: 'Этапы развития',
        note: 'Даты добавим после подтверждения фактов.',
        items: about.timeline,
      },
      {
        type: 'bullets',
        variant: 'principles',
        eyebrow: 'Инженерный подход',
        title: 'Как я работаю',
        items: about.principles,
      },
      {
        type: 'prose',
        variant: 'split',
        eyebrow: 'Сейчас и дальше',
        title: 'Где я нахожусь',
        columns: [
          { title: 'Что уже умею', items: about.now },
          { title: 'Что развиваю', items: about.next },
        ],
      },
      {
        type: 'contact',
        variant: 'compact',
        eyebrow: 'Контакт',
        title: 'Продолжим разговор?',
        text: 'Посмотри проекты или напиши — контакты пока в режиме заглушки.',
      },
    ],
  };
}

/** Каталог: вводный экран, асимметричная сетка карточек и контакт. */
function projectsView() {
  return {
    id: 'projects',
    section: 'projects',
    title: 'Проекты',
    description:
      'Каталог проектов: инструменты, эксперименты и системы, в которых важны модель, интерфейс и инженерные компромиссы.',
    blocks: [
      pageHero(
        'Проекты',
        'Сделано, чтобы разобраться',
        'Каждый проект — проверка гипотезы: о данных, интерфейсе или границах системы. Ниже — работы разного масштаба и степени готовности.',
        [
          { label: 'В каталоге', value: `${String(projects.length).padStart(2, '0')} проектов` },
          { label: 'Статусы', value: 'идея · прототип · в работе' },
        ]
      ),
      {
        type: 'group',
        variant: 'catalog',
        blocks: projects.map((project) =>
          projectTile(project, project.featured ? 'catalog-featured' : 'catalog')
        ),
      },
      {
        type: 'contact',
        variant: 'compact',
        eyebrow: 'Дальше',
        title: 'Нужен разбор или прототип?',
        text: 'Можно обсудить задачу, архитектуру или интерфейс — без обязательств и громких обещаний.',
      },
    ],
  };
}

/**
 * Страница проекта: герой, большая схема, rail-навигация и контент.
 * rail и content рендерятся как один group, чтобы CSS управлял сеткой.
 */
function projectView(project) {
  const next = nextProject(project.slug);
  const meta = [
    { label: 'Роль', value: project.role },
    { label: 'Период', value: project.year },
    { label: 'Статус', value: project.status },
  ];

  const content = [
    {
      type: 'prose',
      id: 'task',
      eyebrow: 'Контекст',
      title: 'Задача',
      paragraphs: [project.context],
    },
    {
      type: 'bullets',
      id: 'role',
      eyebrow: 'Роль',
      title: 'Зона ответственности',
      items: project.roleDetails,
    },
    {
      type: 'bullets',
      id: 'features',
      eyebrow: 'Продукт',
      title: 'Основные возможности',
      items: project.features,
    },
    {
      type: 'figure',
      id: 'architecture',
      eyebrow: 'Архитектура',
      title: 'Как устроено',
      visual: project.architectureVisual,
      caption: project.architectureCaption,
    },
    {
      type: 'bullets',
      id: 'decisions',
      eyebrow: 'Решения',
      title: 'Ключевые решения',
      items: project.decisions,
      variant: 'decisions',
    },
    {
      type: 'bullets',
      id: 'limits',
      eyebrow: 'Ограничения',
      title: 'Что оказалось сложным',
      items: project.constraints,
    },
    {
      type: 'prose',
      id: 'stack',
      eyebrow: 'Стек',
      title: 'Технологии',
      paragraphs: ['Стек выбран под задачу, а не наоборот. Ниже — инструменты, которые реально участвуют в сценарии.'],
      tags: project.stack,
    },
    {
      type: 'bullets',
      id: 'results',
      eyebrow: 'Результат',
      title: 'Что получилось',
      items: project.results,
      variant: 'results',
    },
  ];

  if (project.chart) {
    content.push({
      type: 'chart',
      id: 'chart',
      eyebrow: 'Наблюдение',
      title: project.chart.title,
      caption: project.chart.caption,
      values: project.chart.values,
      labels: project.chart.labels,
    });
  }

  return {
    id: 'project',
    section: 'projects',
    title: project.title,
    description: project.summary,
    blocks: [
      {
        type: 'hero',
        variant: 'project',
        eyebrow: `Проект ${project.index}`,
        title: project.title,
        kicker: project.kicker,
        lead: project.summary,
        meta,
        back: { label: 'Все проекты', href: '/projects' },
      },
      {
        type: 'figure',
        variant: 'hero',
        visual: project.visual,
        caption: `${project.title} — визуальная схема. Заменить на реальный материал проекта.`,
        aspect: '16 / 9',
      },
      {
        type: 'group',
        variant: 'project-body',
        rail: {
          type: 'meta',
          variant: 'project-rail',
          project,
          meta,
          nav: content
            .filter((block) => block.id)
            .map((block) => ({
              href: `#${block.id}`,
              label: block.title,
            })),
        },
        content,
      },
      projectTile(next, 'next', {
        eyebrow: 'Следующий проект',
      }),
    ],
  };
}

/** Навыки: легенда и отдельные матрицы по категориям. */
function skillsView() {
  return {
    id: 'skills',
    section: 'skills',
    title: 'Навыки',
    description:
      'Компетенции по категориям: языки, backend, frontend, данные, архитектура, тестирование и инфраструктура.',
    blocks: [
      pageHero(
        'Навыки',
        'Стек как инструментарий, а не список галочек',
        'Я отмечаю не «уровень владения», а контекст: где технология применялась и насколько самостоятельно. Это честнее, чем проценты.',
        [
          { label: 'Категорий', value: '07' },
          { label: 'Принцип', value: 'контекст важнее рейтинга' },
        ]
      ),
      {
        type: 'meta',
        variant: 'legend',
        eyebrow: 'Легенда',
        items: skillLegend,
      },
      ...skillGroups.map((group) => ({
        type: 'matrix',
        variant: 'group',
        title: group.title,
        note: group.note,
        skills: group.skills,
      })),
      {
        type: 'contact',
        variant: 'compact',
        eyebrow: 'Контакт',
        title: 'Нужен конкретный стек?',
        text: 'Расскажи о задаче — отвечу, что уже делал и где вижу ограничения.',
      },
    ],
  };
}

/** Цели: горизонты, эксперименты и текущая работа. */
function goalsView() {
  return {
    id: 'goals',
    section: 'goals',
    title: 'Цели',
    description:
      'Направления развития: текущий фокус, ближайшие задачи и технические эксперименты.',
    blocks: [
      pageHero(
        'Цели',
        goals.heroTitle,
        goals.lead,
        [
          { label: 'Горизонт', value: 'сейчас · ближайшее · дальше' },
          { label: 'Формат', value: 'направления, не обещания' },
        ]
      ),
      {
        type: 'timeline',
        variant: 'horizons',
        eyebrow: 'Карта направлений',
        title: 'Три горизонта',
        items: goals.horizons,
      },
      {
        type: 'bullets',
        variant: 'experiments',
        eyebrow: 'Эксперименты',
        title: 'Что проверяю',
        items: goals.experiments,
      },
      {
        type: 'prose',
        variant: 'statement',
        eyebrow: 'Сейчас',
        text: goals.workingOn,
        note: 'работа → гипотеза → следующий шаг',
        diagram: ['модель', 'проверка', 'вывод'],
      },
      {
        type: 'contact',
        variant: 'compact',
        eyebrow: 'Контакт',
        title: 'Есть пересечение?',
        text: 'Если тебе близки эти направления — напиши.',
      },
    ],
  };
}

/** 404: сохраняет общий визуальный язык и предлагает два выхода. */
function notFoundView(path) {
  return {
    id: 'not-found',
    section: '404',
    title: 'Страница не найдена',
    description: 'Такой страницы нет.',
    blocks: [
      {
        type: 'hero',
        variant: 'notfound',
        code: '404',
        title: 'Такой страницы нет',
        text: `Маршрут ${path} не существует или был перемещён.`,
        actions: [
          { label: 'На главную', href: '/', variant: 'solid' },
          { label: 'К проектам', href: '/projects', variant: 'ghost' },
        ],
      },
    ],
  };
}

/**
 * Сопоставляет путь с готовым описанием вида.
 * Возвращает 404-вид для неизвестных адресов и slug-ов проектов.
 */
export function resolveView(path) {
  if (path === '/' || path === '') return homeView();
  if (path === '/about') return aboutView();
  if (path === '/projects') return projectsView();
  if (path === '/skills') return skillsView();
  if (path === '/goals') return goalsView();

  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const project = findProject(projectMatch[1]);
    if (project) return projectView(project);
  }

  return notFoundView(path);
}
