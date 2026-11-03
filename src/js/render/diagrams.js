// Генераторы SVG-схем для проектов и карточек.
// Схемы используют общий viewBox 800×600 и стилизуются через
// классы .diagram__* в _blocks.scss. Внутренние координаты условные:
// это декоративные инженерные схемы, а не точные данные.
const LABEL = (text, x, y, extra = '') =>
  `<text class="diagram__label" x="${x}" y="${y}" ${extra}>${text}</text>`;

const DOT = (x, y, r = 3, cls = 'diagram__dot') =>
  `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}" />`;

const LINE = (x1, y1, x2, y2, cls = 'diagram__link') =>
  `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;

/** Общая рамка схемы: контурные оси и подпись для скринридеров. */
function frame(content, label) {
  return `<svg class="diagram" viewBox="0 0 800 600" role="img" aria-label="${label}" focusable="false">
    <g class="diagram__construction">
      <path d="M40 0V600M760 0V600M0 40H800M0 560H800" />
      <path d="M40 40h12M40 40v12M760 40h-12M760 40v12M40 560h12M40 560v-12M760 560h-12M760 560v-12" />
    </g>
    ${content}
  </svg>`;
}

/** Комнаты в реальном времени: клиенты, API, координатор и хранилища. */
function realtimeDiagram() {
  const nodes = [
    [85, 120, 170, 56, 'web / mobile'],
    [315, 120, 170, 56, 'HTTP API'],
    [545, 120, 170, 56, 'auth'],
    [85, 280, 170, 56, 'WS rooms'],
    [315, 280, 170, 56, 'coordinator'],
    [545, 280, 170, 56, 'analytics'],
    [85, 440, 170, 56, 'PostgreSQL'],
    [315, 440, 170, 56, 'Redis'],
    [545, 440, 170, 56, 'ClickHouse'],
  ];

  const boxes = nodes
    .map(
      ([x, y, w, h, label], index) => `
      <g class="diagram__node" style="--n:${index}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0" />
        <text class="diagram__label diagram__label--node" x="${x + 14}" y="${y + 34}">${label}</text>
        <circle class="diagram__dot" cx="${x + w - 16}" cy="${y + 16}" r="2.5" />
      </g>`
    )
    .join('');

  const links = `
    <path class="diagram__link" d="M255 148H315" />
    <path class="diagram__link" d="M485 148H545" />
    <path class="diagram__link" d="M170 176V280" />
    <path class="diagram__link" d="M400 176V280" />
    <path class="diagram__link" d="M630 176V280" />
    <path class="diagram__link" d="M170 336L400 440" />
    <path class="diagram__link" d="M400 336L170 440" />
    <path class="diagram__link" d="M400 336V440" />
    <path class="diagram__link" d="M630 336V440" />
  `;

  return frame(
    `${links}${boxes}
    ${DOT(255, 148, 2.5)}${DOT(485, 148, 2.5)}${DOT(400, 336, 2.5)}
    ${LABEL('realtime / 02', 58, 86)}
    ${LABEL('rooms → events', 612, 518, 'text-anchor="end"')}`,
    'Схема сервиса викторин в реальном времени'
  );
}

/** Слои сайта: контент, вуаль, canvas-сцена и фон. */
function layersDiagram() {
  const layers = [
    [110, 'interface', 0.2],
    [190, 'content', 0.35],
    [270, 'veil', 0.55],
    [350, 'canvas scene', 0.8],
    [430, 'background', 0.95],
  ];
  return frame(
    `${layers
      .map(
        ([y, label, opacity], index) => `
        <g class="diagram__layer" style="--n:${index}">
          <rect x="120" y="${y}" width="540" height="54" class="diagram__node" style="opacity:${opacity}" />
          <text class="diagram__label" x="140" y="${y + 33}">${label}</text>
          <text class="diagram__label" x="640" y="${y + 33}" text-anchor="end">z ${index + 1}</text>
        </g>`
      )
      .join('')}
    ${LINE(690, 110, 690, 484, 'diagram__axis')}
    ${LABEL('layers / 07', 58, 86)}
    ${LABEL('fixed canvas', 120, 530)}`,
    'Схема слоёв фона и контента'
  );
}

const diagrams = {
  realtime: realtimeDiagram,
  layers: layersDiagram,
};

export function diagram(variant = 'realtime') {
  return (diagrams[variant] || realtimeDiagram)();
}
