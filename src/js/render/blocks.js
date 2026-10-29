// Рендер блоков страницы.
// Каждый тип получает собственную семантическую разметку и набор классов,
// а анимации и стили выбирают поведение по data-block / block--variant.
import { site } from '../data/site.js';
import { skillLegend } from '../data/skills.js';
import { chartSvg, diagram } from './diagrams.js';

const pad = (value) => String(value).padStart(2, '0');
const arrow = '<span class="arrow" aria-hidden="true">↗</span>';

/**
 * Оборачивает содержимое в секцию с общими классами блока.
 * @param {string} type — тип для data-block и CSS
 * @param {string} inner — готовая HTML-разметка
 * @param {{id?: string, variant?: string, className?: string, tag?: string}} options
 */
function block(type, inner, options = {}) {
  const {
    id = '',
    variant = '',
    className = '',
    tag = 'section',
  } = options;
  const classes = [
    'block',
    `block--${type}`,
    variant ? `block--${variant}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const attributes = [
    `class="${classes}"`,
    `data-block="${type}"`,
    variant ? `data-variant="${variant}"` : '',
    id ? `id="${id}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<${tag} ${attributes}>${inner}</${tag}>`;
}

/** Надзаголовок с декоративной линией. */
function eyebrow(text) {
  return `<p class="eyebrow"><span class="eyebrow__text">${text}</span></p>`;
}

/** Список технологий; пустой список не создаёт лишнюю разметку. */
function tags(items = [], className = 'tag-list') {
  if (!items.length) return '';
  return `<ul class="${className}" aria-label="Технологии">${items
    .map((item) => `<li>${item}</li>`)
    .join('')}</ul>`;
}

/** Пары «подпись — значение» для роли, периода, статуса и т. п. */
function metaList(items = [], className = 'meta-list') {
  if (!items.length) return '';
  return `<dl class="${className}">${items
    .map(
      (item) =>
        `<div class="meta-list__item"><dt>${item.label}</dt><dd>${item.value}</dd></div>`
    )
    .join('')}</dl>`;
}

/** Кнопка-действие. Без href превращается в неактивную заглушку. */
function actionLink(action) {
  if (!action) return '';
  if (!action.href) {
    return `<span class="action action--${action.variant || 'ghost'} is-disabled">${action.label}</span>`;
  }
  return `<a class="action action--${action.variant || 'ghost'}" href="${action.href}">${action.label}${arrow}</a>`;
}

/** Ссылка проекта; отсутствующая ссылка помечается как незаполненная. */
function projectLink(link) {
  if (!link || !link.href) {
    return `<span class="project-link is-disabled">${link?.label || 'Ссылка'} <span class="mono">[добавить]</span></span>`;
  }
  const external = link.external ? ' target="_blank" rel="noreferrer"' : '';
  return `<a class="project-link" href="${link.href}"${external}>${link.label}${arrow}</a>`;
}

/** Небольшой статус: идея, прототип, в работе. */
function statusTag(status) {
  return `<span class="status-tag"><span class="status-tag__dot" aria-hidden="true"></span>${status}</span>`;
}

/** Единый заголовок секции: метка, название и короткое пояснение. */
function sectionHead(blockData) {
  return `<header class="section-head">
    ${blockData.eyebrow ? eyebrow(blockData.eyebrow) : ''}
    ${blockData.title ? `<h2 class="section-title">${blockData.title}</h2>` : ''}
    ${blockData.note ? `<p class="section-note mono">${blockData.note}</p>` : ''}
  </header>`;
}

/**
 * Первый экран. Поддерживает четыре варианта:
 * home, page, project и notfound.
 */
function renderHero(data) {
  if (data.variant === 'page') {
    return block(
      'hero',
      `<div class="page-intro">
        <div class="page-intro__top">
          ${eyebrow(data.eyebrow)}
        </div>
        <h1 class="page-intro__title" tabindex="-1" data-route-heading>
          <span class="mask-line"><span class="mask-line__inner">${data.title}</span></span>
        </h1>
        <div class="page-intro__bottom">
          <p class="lead">${data.lead}</p>
          ${metaList(data.meta, 'meta-list meta-list--page')}
        </div>
      </div>`,
      { variant: data.variant, className: 'block--page-intro' }
    );
  }

  if (data.variant === 'project') {
    return block(
      'hero',
      `<div class="project-hero">
        <div class="project-hero__top">
          <a class="back-link mono" href="${data.back.href}"><span aria-hidden="true">←</span> ${data.back.label}</a>
          ${eyebrow(data.eyebrow)}
        </div>
        <div class="project-hero__title-row">
          <h1 class="project-hero__title" tabindex="-1" data-route-heading>
            <span class="mask-line"><span class="mask-line__inner">${data.title}</span></span>
          </h1>
          <p class="project-hero__kicker">${data.kicker}</p>
        </div>
        <div class="project-hero__bottom">
          <p class="lead">${data.lead}</p>
          ${metaList(data.meta, 'meta-list meta-list--hero')}
        </div>
      </div>`,
      { variant: data.variant, className: 'block--project-hero' }
    );
  }

  if (data.variant === 'notfound') {
    return block(
      'hero',
      `<div class="notfound">
        ${data.eyebrow ? eyebrow(data.eyebrow) : ''}
        <p class="notfound__code" aria-hidden="true">${data.code}</p>
        <h1 class="notfound__title" tabindex="-1" data-route-heading>${data.title}</h1>
        <p class="lead">${data.text}</p>
        <div class="actions">${data.actions.map(actionLink).join('')}</div>
      </div>`,
      { variant: data.variant }
    );
  }

  return block(
    'hero',
    `<div class="hero">
      <div class="hero__main">
        <div class="hero__top">
          ${eyebrow(data.eyebrow)}
        </div>
        <h1 class="hero__name" tabindex="-1" data-route-heading aria-label="${data.nameLines.join(' ')}">
          ${data.nameLines
            .map(
              (line, index) =>
                `<span class="mask-line hero__name-line${index ? ' is-muted' : ''}"><span class="mask-line__inner">${line}</span></span>`
            )
            .join('')}
        </h1>
      </div>
      <aside class="hero__aside">
        <p class="hero__tagline">${data.tagline}</p>
        <p class="hero__intro">${data.intro}</p>
        <div class="actions">${data.actions.map(actionLink).join('')}</div>
        ${metaList(data.meta, 'meta-list meta-list--hero')}
      </aside>
    </div>`,
    { variant: data.variant, className: 'block--home-hero' }
  );
}

/** Текстовый блок: statement, split или обычные абзацы с тегами. */
function renderProse(data) {
  if (data.variant === 'statement') {
    return block(
      'prose',
      `<div class="statement">
        <div class="statement__head">
          ${eyebrow(data.eyebrow)}
          <span class="statement__mark mono" aria-hidden="true">+</span>
        </div>
        <div class="statement__body">
          <p class="statement__text">${data.text}</p>
          <div class="statement__foot">
            <p class="section-note mono">${data.note}</p>
            <div class="statement__diagram" aria-hidden="true">
              ${data.diagram
                .map((label) => `<span class="statement__node">${label}</span>`)
                .join('')}
            </div>
          </div>
        </div>
      </div>`,
      { id: data.id, variant: data.variant }
    );
  }

  if (data.variant === 'split') {
    return block(
      'prose',
      `<div class="split">
        ${sectionHead(data)}
        <div class="split__columns">
          ${data.columns
            .map(
              (column) => `<div class="split__column">
                <h3 class="split__title">${column.title}</h3>
                <ul class="plain-list">${column.items
                  .map((item) => `<li>${item}</li>`)
                  .join('')}</ul>
              </div>`
            )
            .join('')}
        </div>
      </div>`,
      { id: data.id, variant: data.variant }
    );
  }

  return block(
    'prose',
    `<div class="prose-layout">
      ${sectionHead(data)}
      <div class="prose-layout__body">
        ${(data.paragraphs || []).map((paragraph) => `<p class="prose">${paragraph}</p>`).join('')}
        ${data.tags ? tags(data.tags) : ''}
        ${data.note ? `<p class="section-note mono">${data.note}</p>` : ''}
      </div>
    </div>`,
    { id: data.id, variant: data.variant }
  );
}

/** Нумерованный список пунктов с необязательным статусом. */
function renderBullets(data) {
  const items = (data.items || [])
    .map((item, index) => {
      const value = typeof item === 'string' ? { title: item } : item;
      return `<li class="bullet" style="--j:${index}">
        <span class="bullet__index mono">${pad(index + 1)}</span>
        <div class="bullet__body">
          ${value.title ? `<h3 class="bullet__title">${value.title}</h3>` : ''}
          ${value.text ? `<p class="bullet__text">${value.text}</p>` : ''}
          ${value.status ? `<span class="status-tag status-tag--small">${value.status}</span>` : ''}
        </div>
      </li>`;
    })
    .join('');

  return block(
    'bullets',
    `<div class="bullets-layout bullets-layout--${data.variant || 'default'}">
      ${sectionHead(data)}
      <ol class="bullet-list">${items}</ol>
      ${data.action ? `<div class="block-action">${actionLink(data.action)}</div>` : ''}
    </div>`,
    { id: data.id, variant: data.variant }
  );
}

/** Иллюстрация: изображение или SVG-схема в общей рамке. */
function renderFigure(data) {
  const media = data.src
    ? `<img src="${data.src}" alt="${data.alt || ''}" loading="lazy" />`
    : diagram(data.visual);
  return block(
    'figure',
    `<div class="figure-layout${data.variant === 'hero' ? ' figure-layout--hero' : ''}">
      ${data.eyebrow || data.title ? sectionHead(data) : ''}
      <figure class="figure">
        <div class="figure__frame" style="--aspect:${data.aspect || '4 / 3'}">
          <span class="figure__corner figure__corner--tl" aria-hidden="true"></span>
          <span class="figure__corner figure__corner--tr" aria-hidden="true"></span>
          <span class="figure__corner figure__corner--bl" aria-hidden="true"></span>
          <span class="figure__corner figure__corner--br" aria-hidden="true"></span>
          <span class="figure__scan" aria-hidden="true"></span>
          <div class="figure__media">${media}</div>
        </div>
        <figcaption class="figure__caption">
          <span>${data.caption}</span>
        </figcaption>
      </figure>
    </div>`,
    { id: data.id, variant: data.variant }
  );
}

/** График с подписью; данные приходят из описания проекта. */
function renderChart(data) {
  return block(
    'chart',
    `<div class="chart-layout">
      ${sectionHead(data)}
      <figure class="chart">
        <div class="chart__frame">${chartSvg(data.values, data.labels)}</div>
        <figcaption class="figure__caption">
          <span>${data.caption}</span>
        </figcaption>
      </figure>
    </div>`,
    { id: data.id, variant: data.variant }
  );
}

/**
 * Таймлайн в двух раскладках: горизонтальные горизонты и
 * вертикальная последовательность этапов.
 */
function renderTimeline(data) {
  const variant = data.variant || 'vertical';
  if (variant === 'vector' || variant === 'horizons') {
    const items = data.items
      .map(
        (item, index) => `<li class="timeline-step" style="--j:${index}">
          <span class="timeline-step__dot" aria-hidden="true"></span>
          <div class="timeline-step__top">
            <span class="mono">${item.index || pad(index + 1)}</span>
            <span class="mono timeline-step__label">${item.label}</span>
          </div>
          <h3 class="timeline-step__title">${item.title}</h3>
          ${item.text ? `<p class="timeline-step__text">${item.text}</p>` : ''}
          ${
            item.items
              ? `<ul class="plain-list plain-list--small">${item.items
                  .map((entry) => `<li>${entry}</li>`)
                  .join('')}</ul>`
              : ''
          }
        </li>`
      )
      .join('');

    return block(
      'timeline',
      `<div class="timeline-layout timeline-layout--${variant}">
        ${sectionHead(data)}
        <ol class="timeline-steps timeline-steps--${variant}">
          <span class="timeline-steps__line" aria-hidden="true"></span>
          ${items}
        </ol>
        ${data.action ? `<div class="block-action">${actionLink(data.action)}</div>` : ''}
      </div>`,
      { id: data.id, variant }
    );
  }

  const items = data.items
    .map(
      (item, index) => `<li class="timeline-entry" style="--j:${index}">
        <span class="timeline-entry__dot" aria-hidden="true"></span>
        <span class="timeline-entry__index mono">${pad(index + 1)}</span>
        <div class="timeline-entry__body">
          <div class="timeline-entry__top">
            <h3>${item.title}</h3>
          </div>
          <p>${item.text}</p>
          ${item.tags ? tags(item.tags, 'tag-list tag-list--small') : ''}
        </div>
      </li>`
    )
    .join('');

  return block(
    'timeline',
    `<div class="timeline-layout timeline-layout--vertical">
      ${sectionHead(data)}
      <ol class="timeline-entries">
        <span class="timeline-entries__line" aria-hidden="true"></span>
        ${items}
      </ol>
    </div>`,
    { id: data.id, variant }
  );
}

/** Человекочитаемая подпись уровня навыка из общей легенды. */
function levelLabel(level) {
  return skillLegend.find((item) => item.level === level)?.label || level;
}

/** Матрица компетенций: компактный список или подробные строки. */
function renderMatrix(data) {
  if (data.variant === 'compact') {
    return block(
      'matrix',
      `<div class="matrix matrix--compact">
        ${sectionHead(data)}
        <div class="competency-list">
          ${data.groups
            .map(
              (group) => `<a class="competency" href="/skills">
                <span class="competency__index mono">${group.index}</span>
                <span class="competency__title">${group.title}</span>
                <span class="competency__tech mono">${group.skills
                  .slice(0, 4)
                  .map((skill) => skill.name)
                  .join(' · ')}</span>
                <span class="competency__arrow" aria-hidden="true">↗</span>
              </a>`
            )
            .join('')}
        </div>
      </div>`,
      { id: data.id, variant: data.variant }
    );
  }

  return block(
    'matrix',
    `<div class="matrix matrix--group">
      <header class="matrix__head">
        ${data.eyebrow ? eyebrow(data.eyebrow) : ''}
        <h2 class="section-title">${data.title}</h2>
        <p class="section-note mono">${data.note}</p>
      </header>
      <ul class="skill-rows">
        ${data.skills
          .map(
            (skill, index) => `<li class="skill-row" style="--j:${index}">
              <span class="skill-row__name">${skill.name}</span>
              <span class="skill-row__context">${skill.context}</span>
              <span class="skill-row__level" data-level="${skill.level}">
                <span class="skill-row__dot" aria-hidden="true"></span>${levelLabel(skill.level)}
              </span>
            </li>`
          )
          .join('')}
      </ul>
    </div>`,
    { id: data.id, variant: data.variant }
  );
}

/** Общая содержательная часть карточки проекта. */
function projectCardContent(project) {
  return `<div class="project-card__content">
    <div class="project-card__top">
      <span class="mono">${project.index}</span>
      ${statusTag(project.status)}
    </div>
    <h2 class="project-card__title">
      <a href="/projects/${project.slug}">${project.title}</a>
    </h2>
    <p class="project-card__kicker">${project.kicker}</p>
    <p class="project-card__summary">${project.summary}</p>
    ${tags(project.stack.slice(0, 4), 'tag-list tag-list--small')}
    <div class="project-card__bottom">
      <span class="mono">${project.year}</span>
      <a class="project-link" href="/projects/${project.slug}">Открыть проект${arrow}</a>
    </div>
  </div>`;
}

/**
 * Карточка проекта в трёх вариантах: featured, catalog и next.
 * У featured и next своя композиция, поэтому они обрабатываются отдельно.
 */
function renderProjectTile(data) {
  const { project, variant } = data;

  if (variant === 'next') {
    return block(
      'project-tile',
      `<a class="next-project" href="/projects/${project.slug}">
        <div class="next-project__top">
          ${eyebrow(data.eyebrow || 'Следующий проект')}
        </div>
        <div class="next-project__row">
          <h2>${project.title}</h2>
          <span class="next-project__arrow" aria-hidden="true">→</span>
        </div>
        <p class="next-project__kicker">${project.kicker}</p>
      </a>`,
      { variant }
    );
  }

  const media = `<a class="project-card__media" href="/projects/${project.slug}" aria-label="Открыть проект ${project.title}">
    <span class="project-card__scan" aria-hidden="true"></span>
    ${diagram(project.visual)}
  </a>`;

  if (variant === 'featured') {
    return block(
      'project-tile',
      `<article class="project-card project-card--featured">
        <div class="project-card__eyebrow-row">
          ${eyebrow(data.eyebrow || 'Избранный проект')}
        </div>
        <div class="project-card__featured-grid">
          ${projectCardContent(project)}
          ${media}
        </div>
        <div class="project-card__links">${project.links.map(projectLink).join('')}</div>
      </article>`,
      { variant, tag: 'div' }
    );
  }

  return block(
    'project-tile',
    `<article class="project-card project-card--${variant}">
      <div class="project-card__top">
        <span class="mono">${project.index}</span>
        ${statusTag(project.status)}
      </div>
      ${media}
      <div class="project-card__content">
        <h2 class="project-card__title"><a href="/projects/${project.slug}">${project.title}</a></h2>
        <p class="project-card__kicker">${project.kicker}</p>
        <p class="project-card__summary">${project.summary}</p>
        ${tags(project.stack.slice(0, 4), 'tag-list tag-list--small')}
        <div class="project-card__bottom">
          <span class="mono">${project.year}</span>
          <a class="project-link" href="/projects/${project.slug}">Открыть проект${arrow}</a>
        </div>
      </div>
    </article>`,
    { variant, tag: 'div' }
  );
}

/** Контактный блок: почта, соцсети и пометки о заглушках. */
function renderContact(data) {
  const email = site.emailIsPlaceholder
    ? `<span class="contact__mail-placeholder mono">демо</span>`
    : '';
  return block(
    'contact',
    `<div class="contact contact--${data.variant || 'default'}">
      <div class="contact__head">
        ${eyebrow(data.eyebrow)}
        <h2 class="contact__title">${data.title}</h2>
        <p class="contact__text">${data.text}</p>
      </div>
      <div class="contact__body">
        <a class="contact__mail" href="mailto:${site.email}">${site.email}${email}</a>
        <div class="contact__links">
          ${site.socials
            .map(
              (social) =>
                social.href
                  ? `<a class="contact-link" href="${social.href}"${social.external ? ' target="_blank" rel="noreferrer"' : ''}>
                      <span class="mono">${social.label}</span>
                      <span>${social.value}</span>
                      <span class="arrow" aria-hidden="true">↗</span>
                    </a>`
                  : `<span class="contact-link is-disabled">
                      <span class="mono">${social.label}</span>
                      <span>${social.value}</span>
                    </span>`
            )
            .join('')}
        </div>
      </div>
    </div>`,
    { variant: data.variant }
  );
}

/** Служебные блоки: легенда навыков и rail-колонка проекта. */
function renderMeta(data) {
  if (data.variant === 'legend') {
    return block(
      'meta',
      `<div class="legend-block">
        ${eyebrow(data.eyebrow)}
        <ul class="legend">
          ${data.items
            .map(
              (item) =>
                `<li class="legend__item"><span class="legend__dot" data-level="${item.level}" aria-hidden="true"></span>${item.label}</li>`
            )
            .join('')}
        </ul>
      </div>`,
      { variant: data.variant }
    );
  }

  if (data.variant === 'project-rail') {
    return block(
      'meta',
      `<aside class="project-rail">
        <div class="project-rail__sticky">
          <a class="back-link mono" href="/projects"><span aria-hidden="true">←</span> Все проекты</a>
          <dl class="rail-meta">
            ${data.meta
              .map(
                (item) =>
                  `<div><dt>${item.label}</dt><dd>${item.value}</dd></div>`
              )
              .join('')}
          </dl>
          <nav class="rail-nav" aria-label="Содержание проекта">
            ${data.nav
              .map(
                (item) =>
                  `<a class="rail-nav__link mono" href="${item.href}">${item.label}</a>`
              )
              .join('')}
          </nav>
          <div class="rail-links">${data.project.links.map(projectLink).join('')}</div>
        </div>
      </aside>`,
      { variant: data.variant, tag: 'div' }
    );
  }

  return '';
}

/** Группы блоков: каталог и двухколоночная страница проекта. */
function renderGroup(data) {
  if (data.variant === 'catalog') {
    return `<div class="catalog">${data.blocks.map(renderBlock).join('')}</div>`;
  }

  if (data.variant === 'project-body') {
    return `<div class="project-layout">
      ${renderBlock(data.rail)}
      <div class="project-content">${data.content.map(renderBlock).join('')}</div>
    </div>`;
  }

  return `<div class="block-group">${data.blocks?.map(renderBlock).join('') || ''}</div>`;
}

/** Реестр типов блоков: единственное место для добавления нового типа. */
export function renderBlock(data) {
  if (!data) return '';
  switch (data.type) {
    case 'hero':
      return renderHero(data);
    case 'prose':
      return renderProse(data);
    case 'bullets':
      return renderBullets(data);
    case 'figure':
      return renderFigure(data);
    case 'chart':
      return renderChart(data);
    case 'timeline':
      return renderTimeline(data);
    case 'matrix':
      return renderMatrix(data);
    case 'project-tile':
      return renderProjectTile(data);
    case 'contact':
      return renderContact(data);
    case 'meta':
      return renderMeta(data);
    case 'group':
      return renderGroup(data);
    default:
      return '';
  }
}

/** Корневая обёртка вида; по data-view и CSS-классу работают переходы. */
export function renderView(view) {
  return `<div class="view view--${view.id}" data-view="${view.id}">
    ${view.blocks.map(renderBlock).join('')}
  </div>`;
}
