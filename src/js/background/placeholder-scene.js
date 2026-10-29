// Заменяемая фоновая сцена: поле точек, редкие крестики и связи.
// Файл можно полностью заменить другой сценой, сохранив интерфейс
// createPlaceholderScene(ctx, { quality }) -> { resize, render, update }.
// Canvas прозрачный: цвет подложки приходит из body, а не из сцены.

/** Детерминированный псевдослучайный хеш для стабильного рисунка. */
const hash = (value) => {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Создаёт сцену и возвращает методы управления.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{quality?: 'auto' | 'low' | 'high'}} options
 */
export function createPlaceholderScene(ctx, { quality = 'auto' } = {}) {
  let width = 1;
  let height = 1;
  let nodes = [];

  /** Строит сетку узлов с детерминированным джиттером. */
  function build() {
    const low = quality === 'low' || width < 720;
    const spacing = low ? 78 : 58;
    const cols = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;
    nodes = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const seed = row * 97 + col * 31;
        const jitterX = (hash(seed) - 0.5) * spacing * 0.22;
        const jitterY = (hash(seed + 7) - 0.5) * spacing * 0.22;
        nodes.push({
          x: col * spacing + jitterX,
          y: row * spacing + jitterY,
          phase: hash(seed + 13) * Math.PI * 2,
          depth: 0.35 + hash(seed + 19) * 0.65,
          size: low ? 1.3 : 0.8 + hash(seed + 23) * 1.15,
          cross: hash(seed + 29) > 0.86,
          alpha: 0.1 + hash(seed + 37) * 0.28,
          col,
          row,
          cols,
        });
      }
    }
  }

  /**
   * Полный кадр сцены.
   * @param {{energy?: number, density?: number, pointer?: {x: number, y: number}}} state
   * @param {number} time — накопленное время в секундах
   */
  function render(state, time) {
    ctx.clearRect(0, 0, width, height);

    const energy = 0.45 + (state.energy ?? 0.6) * 0.75;
    const pointerX = state.pointer?.x ?? 0.5;
    const pointerY = state.pointer?.y ?? 0.5;
    const amp = 4 + energy * 11;

    ctx.save();
    ctx.lineWidth = 1;

    // Едва заметная инженерная разметка.
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    for (let i = 1; i < 4; i += 1) {
      const x = (width / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 1; i < 4; i += 1) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Мягкое поле вокруг указателя.
    const glow = ctx.createRadialGradient(
      pointerX * width,
      pointerY * height,
      0,
      pointerX * width,
      pointerY * height,
      Math.max(width, height) * 0.42
    );
    glow.addColorStop(0, `rgba(255,255,255,${0.035 * energy})`);
    glow.addColorStop(0.55, 'rgba(255,255,255,0.008)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Связи между соседними точками.
    const spacing = width < 720 || quality === 'low' ? 78 : 58;
    ctx.strokeStyle = `rgba(255,255,255,${0.035 + energy * 0.025})`;
    nodes.forEach((node) => {
      if (node.col >= node.cols - 1) return;
      const next = nodes[(node.row * node.cols + node.col + 1)];
      if (!next) return;
      const x1 = node.x + Math.sin(time * 0.16 + node.phase) * amp;
      const y1 = node.y + Math.cos(time * 0.13 + node.phase * 1.2) * amp;
      const x2 = next.x + Math.sin(time * 0.16 + next.phase) * amp;
      const y2 = next.y + Math.cos(time * 0.13 + next.phase * 1.2) * amp;
      if (Math.abs(y1 - y2) > spacing * 0.35) return;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // Точки поля.
    nodes.forEach((node, index) => {
      const driftX =
        Math.sin(time * 0.18 + node.phase + node.x * 0.003) * amp +
        (pointerX - 0.5) * 22 * node.depth;
      const driftY =
        Math.cos(time * 0.14 + node.phase * 1.2 + node.y * 0.002) * amp +
        (pointerY - 0.5) * 16 * node.depth;
      const x = node.x + driftX;
      const y = node.y + driftY;
      const pulse = 0.55 + 0.45 * Math.sin(time * 0.55 + node.phase + index * 0.01);
      const alpha = Math.min(0.5, node.alpha * (0.65 + energy * 0.45) * pulse);

      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fillRect(x, y, node.size, node.size);

      if (node.cross) {
        ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  /** Пересчитывает поле после изменения размера окна. */
  function resize({ width: nextWidth, height: nextHeight }) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    build();
  }

  build();

  return {
    resize,
    render,
    update() {},
  };
}
