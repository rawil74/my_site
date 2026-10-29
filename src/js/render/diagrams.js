// Генераторы SVG-схем для проектов и карточек.
// Все схемы используют общий viewBox 800×600 и стилизуются через
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

/** Контур зависимостей: вложенные волнистые уровни и центральный узел. */
function contourDiagram() {
  const contours = [
    [430, 300, 245, 190, 0.8],
    [430, 300, 205, 158, 2.1],
    [430, 300, 165, 126, 4.2],
    [430, 300, 124, 94, 1.4],
    [430, 300, 82, 62, 3.3],
    [430, 300, 42, 32, 5.1],
  ];
  const paths = contours
    .map(([cx, cy, rx, ry, seed], index) => {
      const points = [];
      for (let i = 0; i < 64; i += 1) {
        const angle = (i / 64) * Math.PI * 2;
        const wobble =
          1 +
          Math.sin(angle * 3 + seed) * 0.08 +
          Math.cos(angle * 5 + seed * 1.7) * 0.045;
        points.push([
          cx + Math.cos(angle) * rx * wobble,
          cy + Math.sin(angle) * ry * wobble,
        ]);
      }
      const d = `M${points.map((point) => point.map((n) => n.toFixed(1)).join(' ')).join(' L')} Z`;
      return `<path class="diagram__contour" style="--n:${index}" d="${d}" />`;
    })
    .join('');

  return frame(
    `${paths}
    ${LINE(430, 80, 430, 520, 'diagram__axis')}
    ${LINE(210, 300, 650, 300, 'diagram__axis')}
    ${DOT(430, 300, 5, 'diagram__dot diagram__dot--bright')}
    ${LABEL('services', 455, 292)}
    ${LABEL('queue', 520, 210)}
    ${LABEL('storage', 550, 382)}
    ${LABEL('gateway', 280, 212)}
    ${LABEL('contour / 01', 58, 86)}
    ${LABEL('dependencies', 612, 518, 'text-anchor="end"')}
    ${LABEL('radius: 6', 58, 518)}`,
    'Схема контура зависимостей сервисов'
  );
}

/** Архитектурная схема: узлы и направленные связи между ними. */
function architectureDiagram() {
  const nodes = [
    [120, 150, 136, 58, 'ingest'],
    [332, 150, 136, 58, 'normalize'],
    [544, 150, 136, 58, 'graph db'],
    [544, 330, 136, 58, 'api'],
    [332, 330, 136, 58, 'worker'],
    [120, 330, 136, 58, 'source'],
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
    <path class="diagram__link" d="M256 179H332" />
    <path class="diagram__link" d="M468 179H544" />
    <path class="diagram__link" d="M612 208V330" />
    <path class="diagram__link" d="M544 359H468" />
    <path class="diagram__link" d="M332 359H256" />
    <path class="diagram__link" d="M188 330V208" />
    <path class="diagram__link diagram__link--dashed" d="M188 179H332H468V330" />
  `;
  return frame(
    `${links}${boxes}
    ${DOT(256, 179, 2.5)}${DOT(468, 179, 2.5)}${DOT(612, 330, 2.5)}${DOT(468, 359, 2.5)}
    ${LABEL('source', 120, 424)}
    ${LABEL('flow / 02', 58, 86)}
    ${LABEL('event → model', 612, 518, 'text-anchor="end"')}`,
    'Схема архитектуры проекта'
  );
}

/** Поток обработки: последовательные этапы с точками-связями. */
function flowDiagram() {
  const stages = ['draft', 'rules', 'check', 'resolve', 'publish'];
  const start = 70;
  const gap = 138;
  const nodes = stages
    .map((label, index) => {
      const x = start + index * gap;
      return `
        <g class="diagram__stage" style="--n:${index}">
          <rect class="diagram__node" x="${x}" y="236" width="104" height="104" />
          <text class="diagram__label diagram__label--node" x="${x + 14}" y="292">0${index + 1}</text>
          <text class="diagram__label" x="${x + 14}" y="318">${label}</text>
          <circle class="diagram__dot" cx="${x + 14}" cy="264" r="2.5" />
        </g>`;
    })
    .join('');
  const arrows = stages
    .slice(0, -1)
    .map((_, index) => {
      const x = start + index * gap + 104;
      return `<path class="diagram__link" d="M${x + 6} 288H${x + 28}" />${DOT(x + 28, 288, 2.5)}`;
    })
    .join('');
  return frame(
    `${LINE(70, 288, 740, 288, 'diagram__axis')}${arrows}${nodes}
    ${LABEL('flow / 03', 58, 86)}
    ${LABEL('draft → rules → result', 612, 518, 'text-anchor="end"')}`,
    'Схема потока проверки расписания'
  );
}

/** Сетка каталога: карточки разного размера и служебные линии. */
function gridDiagram() {
  const cells = [
    [96, 142, 188, 112],
    [308, 142, 188, 112],
    [520, 142, 188, 112],
    [96, 280, 400, 170],
    [520, 280, 188, 80],
    [520, 386, 188, 64],
  ];
  const rects = cells
    .map(
      ([x, y, w, h], index) => `
      <g class="diagram__cell" style="--n:${index}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" />
        <path class="diagram__cell-line" d="M${x + 16} ${y + 28}H${x + w - 24}M${x + 16} ${y + 48}H${x + w - 64}" />
        <circle class="diagram__dot" cx="${x + w - 18}" cy="${y + 18}" r="2.5" />
      </g>`
    )
    .join('');
  return frame(
    `${LINE(80, 100, 80, 500, 'diagram__axis')}
    ${LABEL('library / 04', 96, 86)}
    ${rects}
    ${LABEL('records: 128', 96, 518)}
    ${LABEL('view: catalog', 612, 518, 'text-anchor="end"')}`,
    'Схема каталога личной библиотеки'
  );
}

/** Волновая схема для проекта с генеративным визуалом. */
function waveDiagram() {
  const values = [330, 292, 314, 244, 268, 196, 218, 154];
  const points = values.map((y, index) => [120 + index * 78, y]);
  const line = `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}`;
  const area = `${line} L${points[points.length - 1][0]} 430 L120 430 Z`;
  return frame(
    `${LINE(120, 430, 700, 430, 'diagram__axis')}
    ${LINE(120, 110, 120, 430, 'diagram__axis')}
    <path class="diagram__area" d="${area}" />
    <path class="diagram__path" pathLength="1" d="${line}" />
    ${points
      .map(
        ([x, y], index) =>
          `<g class="diagram__point" style="--n:${index}">${DOT(x, y, 3)}${LABEL(
            String(index + 1).padStart(2, '0'),
            x - 8,
            460
          )}</g>`
      )
      .join('')}
    ${LABEL('search / 05', 58, 86)}
    ${LABEL('query → index → rank', 612, 518, 'text-anchor="end"')}`,
    'Схема эксперимента с локальным поиском'
  );
}

function graphDiagram() {
  const nodes = [
    [150, 180, 5],
    [315, 128, 3],
    [470, 204, 4],
    [620, 142, 3],
    [560, 350, 5],
    [380, 402, 3],
    [226, 342, 4],
    [690, 430, 2],
    [300, 250, 2],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [6, 0], [1, 8], [8, 5], [4, 7],
  ];
  return frame(
    `<g class="diagram__edges">${edges
      .map(([a, b]) => LINE(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1]))
      .join('')}</g>
    ${nodes
      .map(
        ([x, y, r], index) =>
          `<g class="diagram__point" style="--n:${index}">
            <circle class="diagram__halo" cx="${x}" cy="${y}" r="${r + 8}" />
            ${DOT(x, y, r, 'diagram__dot diagram__dot--bright')}
          </g>`
      )
      .join('')}
    ${LABEL('field / 06', 58, 86)}
    ${LABEL('pointer', 712, 266, 'text-anchor="end"')}
    ${LABEL('energy', 712, 284, 'text-anchor="end"')}`,
    'Схема генеративного поля'
  );
}

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
  contour: contourDiagram,
  architecture: architectureDiagram,
  flow: flowDiagram,
  grid: gridDiagram,
  wave: waveDiagram,
  graph: graphDiagram,
  layers: layersDiagram,
};

export function diagram(variant = 'graph') {
  return (diagrams[variant] || graphDiagram)();
}

export function chartSvg(values = [28, 46, 38, 64, 58, 76], labels = []) {
  const max = Math.max(...values, 1);
  const width = 720;
  const height = 320;
  const left = 56;
  const bottom = 270;
  const gap = values.length > 1 ? (width - left - 40) / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = left + index * gap;
    const y = bottom - (value / max) * 190;
    return [x, y];
  });
  const line = `M${points.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L')}`;
  const area = `${line} L${points[points.length - 1][0]} ${bottom} L${left} ${bottom} Z`;
  return `<svg class="chart__svg" viewBox="0 0 ${width} ${height + 40}" role="img" aria-label="Демонстрационный график">
    <g class="chart__grid">
      ${[0, 1, 2, 3, 4]
        .map((step) => {
          const y = bottom - step * 47.5;
          return `<line x1="${left}" y1="${y}" x2="${width - 30}" y2="${y}" />`;
        })
        .join('')}
    </g>
    ${LINE(left, bottom, width - 30, bottom, 'chart__axis')}
    ${LINE(left, 50, left, bottom, 'chart__axis')}
    <path class="chart__area" d="${area}" />
    <path class="chart__path" pathLength="1" d="${line}" />
    ${points
      .map(
        ([x, y], index) =>
          `<g class="chart__point" style="--n:${index}">
            <circle cx="${x}" cy="${y}" r="3.5" />
            <text x="${x}" y="${bottom + 28}" text-anchor="middle">${labels[index] || index + 1}</text>
          </g>`
      )
      .join('')}
    <text class="chart__caption" x="${left}" y="28">демо-данные / заменить</text>
  </svg>`;
}
