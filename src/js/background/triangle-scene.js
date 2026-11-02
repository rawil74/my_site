
/**
 * Connected triangular-mosaic background.
 *
 * ES module usage:
 *   import { createTriangleScene } from './triangle-scene.js';
 *   const scene = createTriangleScene(canvasElement);
 *   // later: scene.destroy();
 *
 * Fixed triangular lattice. Tiles never follow the pointer: nearby slots are
 * populated ahead of pointer motion and distant slots fade out in place.
 */

const DEFAULTS = Object.freeze({
  background: '#080a0e',
  triangleSide: 60,
  assemblyRadius: 90,
  acceptRadius: 250,
  keepRadius: 172,
  assignmentInterval: 20,
  maxAddsPerStep: 3,
  touchHoldMs: 1700,
  leaveGraceMs: 420,
  dprLimit: 2,
  // 'glow' draws a blurred halo around assembled edges; 'flat' is the cheap
  // fallback for weak devices (opaque line, no shadow pass).
  effects: 'glow',
});

const TAU = Math.PI * 2;

/**
 * Free-field layout. Spacing and reach are multiples of the tile side, so the
 * whole field scales with `triangleSide` instead of using raw pixels.
 */
const FIELD = Object.freeze({
  spacingX: 1.51,
  spacingY: 1.51,
  jitter: 0.07,
  sourceReach: 5.65,
  spawnOffset: Object.freeze([0.85, 1.45]),
  spawnLateral: 0.75,
  pointerEpsilon: 0.025,
  motionBlendMs: 55,
  // Mobile browsers animate the viewport height as the address bar collapses.
  // Height changes below this many tile sides are handled by re-projecting the
  // existing field instead of rebuilding it (a rebuild reshuffles every tile
  // and reads as flicker while scrolling).
  resizeRebuildSlack: 2.5,
});

/** Resting 3D orientation of a free tile: symmetric ranges around zero. */
const HOME_TILT = Object.freeze({
  rx: 0.62,
  ry: 0.68,
  roll: 0.24,
  depth: 2.2,
});

/** Transition timing and visibility thresholds. */
const MOTION = Object.freeze({
  slotEaseMs: 155,
  orientationEaseMs: 160,
  snapEpsilon: 0.003,
  clearOpacity: 0.006,
  visibleOpacity: 0.012,
  settledOpacity: 0.985,
  freeAlpha: 0.86,
});

/** Static palette for free and assembled facets. */
const PALETTE = Object.freeze({
  far: Object.freeze([33, 42, 57]),
  near: Object.freeze([48, 62, 85]),
  edge: Object.freeze([104, 130, 171]),
});

/** Coefficients shared by the free and assembled lighting passes. */
const LIGHTING = Object.freeze({
  ambient: 0.3,
  diffuse: 1.24,
  depthScale: 0.07,
  depthMin: 0.76,
  depthMax: 1.24,
  specularPower: 22,
  specularBase: 0.16,
  specularFocus: 0.14,
  litLift: 1.2,
  litSpecular: 136,
  midBase: 0.54,
  midDiffuse: 0.44,
  midLift: 0.45,
  midSpecular: 54,
  darkBase: 0.18,
  darkDiffuse: 0.2,
  darkLift: 0.5,
});

/** Slot-selection scoring. Larger values pull tiles further off the pure
 * distance ranking; keep them small relative to a `side` of pixels. */
const SELECTION = Object.freeze({
  tieBreakBias: 0.18, // stable noise added so equal distances rotate seats
  seedMargin: 0.88, // fraction of assemblyRadius allowed for the seed slot
  seedUpDownPenalty: 0.02, // opposite facets rank slightly behind down ones
  leadBias: 0.52, // how strongly the frontier favours pointer direction
});

/** Per-facet drawing: gradient, assembly shadow, contour and light bevel. */
const RENDER = Object.freeze({
  lightReachRatioX: 0.92, // gradient span as a fraction of side / triHeight
  lightReachRatioY: 1.08,
  gradientColorStop: 0.24, // where lit blends into mid
  gradientMidStop: 0.58, // where mid ends and dark takes over
  shadowThreshold: 0.08, // focusMix above which a tile casts a shadow
  shadowRgb: '20, 30, 47',
  shadowAlphaBase: 0.08,
  shadowAlphaFocus: 0.1,
  shadowBlur: 2.1,
  shadowOffsetY: 0.55,
  contourWidth: 0.72,
  contourRgb: '62, 78, 101',
  contourAlphaBase: 0.2,
  contourAlphaFocus: 0.16,
  bevelWidth: 0.68,
  bevelAlphaBase: 0.15,
  bevelAlphaFocus: 0.3,
  bevelAlphaSpecular: 0.45,
});

/** Radial vignette under the influence patch while interaction is active. */
const GLOW = Object.freeze({
  radiusFactor: 1.18, // assemblyRadius fraction at full glow falloff
  centerColor: 'rgba(24, 34, 50, 0.12)',
  midColor: 'rgba(16, 23, 35, 0.045)',
  edgeColor: 'rgba(8, 10, 14, 0)',
  midStop: 0.58,
});

/**
 * Assembled mosaic look: a flat dark facet instead of the free-field gradient,
 * with a light glowing contour along every tile edge. Values are intentionally
 * neutral grey so the mesh reads as one material and the edge carries the shape.
 */
const ASSEMBLED = Object.freeze({
  fill: '#282b31',
  edgeColor: 'rgba(232, 238, 248, 0.88)',
  edgeWidth: 1,
  glowColor: 'rgba(196, 218, 250, 0.5)',
  glowBlur: 7,
  // Weak-device fallback: an opaque line without a alpha channel or shadow
  // pass. Slightly brighter than the glow edge to keep the same presence.
  flatEdgeColor: 'rgb(202, 212, 228)',
});

/**
 * Runtime capability probe. A device that cannot keep the animation near
 * 60 fps while the mesh is assembling loses the glow for the rest of the
 * session; everything else (colours, geometry) stays the same.
 */
const PERF = Object.freeze({
  window: 48, // rolling frame-gap samples
  checkEvery: 4, // evaluate the median every N frames
  slowFrameMs: 21, // median above this means below ~48 fps
  armAfterMs: 1000, // ignore page-load jank before judging
  maxGapMs: 1000, // longer gaps are sleep/resume, not sustained render cost
});

// Each resting triangle has its own 3D orientation. There is deliberately no
// global canvas/plane rotation: the depth effect belongs to individual tiles.
const CAMERA_DISTANCE = 1180;
const MIN_PERSPECTIVE_DEPTH = 250;
const LIGHT = normalize3([-0.49, -0.57, 0.66]);
const HALF_LIGHT = normalize3([LIGHT.x, LIGHT.y, LIGHT.z + 1]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const length2 = (x, y) => x * x + y * y;
const distance = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
const mod2 = (n) => ((n % 2) + 2) % 2;

function normalize3([x, y, z]) {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

// Asymptotic easing never truly reaches its target, which keeps repainting
// identical frames forever. Snap once the remaining difference is invisible.
function approach(current, target, ease, epsilon = 0.0001) {
  const next = lerp(current, target, ease);
  return Math.abs(target - next) < epsilon ? target : next;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomHomeOrientation() {
  return {
    rx: randomBetween(-HOME_TILT.rx, HOME_TILT.rx),
    ry: randomBetween(-HOME_TILT.ry, HOME_TILT.ry),
    roll: randomBetween(-HOME_TILT.roll, HOME_TILT.roll),
    depth: randomBetween(-HOME_TILT.depth, HOME_TILT.depth),
  };
}

function colorRgb(rgb) {
  return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}

function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function mulRgb(rgb, factor, lift = 0) {
  return rgb.map((c) => clamp(c * factor + lift, 0, 255));
}

function rotate3D(point, rx, ry, rz) {
  let { x, y, z } = point;

  // X rotation.
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y1 = y * cx - z * sx;
  const z1 = y * sx + z * cx;
  y = y1;
  z = z1;

  // Y rotation.
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x2 = x * cy + z * sy;
  const z2 = -x * sy + z * cy;
  x = x2;
  z = z2;

  // Z rotation.
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  return {
    x: x * cz - y * sz,
    y: x * sz + y * cz,
    z,
  };
}

function makeCanonicalVertices(kind, side) {
  const h = side * Math.sqrt(3) / 2;
  if (kind === 'down') {
    return [
      { x: -side / 2, y: -h / 3, z: 0 },
      { x: side / 2, y: -h / 3, z: 0 },
      { x: 0, y: 2 * h / 3, z: 0 },
    ];
  }
  return [
    { x: 0, y: -2 * h / 3, z: 0 },
    { x: side / 2, y: h / 3, z: 0 },
    { x: -side / 2, y: h / 3, z: 0 },
  ];
}

function createSlotLattice(side, radius) {
  const h = side * Math.sqrt(3) / 2;
  const extent = radius + side * 2.5;
  const rowLimit = Math.ceil(extent / h) + 4;
  const colLimit = Math.ceil(extent / side) + 4;
  const slots = [];
  const edgeOwners = new Map();

  function vertex(row, col) {
    return {
      id: `${row},${col}`,
      x: col * side + mod2(row) * side / 2,
      y: row * h,
      row,
      col,
    };
  }

  function edgeKey(a, b) {
    return a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
  }

  function addSlot(row, col, kind, vertices) {
    const center = {
      x: (vertices[0].x + vertices[1].x + vertices[2].x) / 3,
      y: (vertices[0].y + vertices[1].y + vertices[2].y) / 3,
    };
    const slot = {
      id: `${row}:${kind}:${col}`,
      row,
      col,
      kind,
      vertices,
      x: center.x,
      y: center.y,
      neighbors: new Set(),
      occupant: null,
      distanceFromGridCenter: 0,
    };
    slots.push(slot);

    for (let i = 0; i < 3; i += 1) {
      const a = vertices[i];
      const b = vertices[(i + 1) % 3];
      const key = edgeKey(a, b);
      const owner = edgeOwners.get(key);
      if (owner) {
        slot.neighbors.add(owner.id);
        owner.neighbors.add(slot.id);
      } else {
        edgeOwners.set(key, slot);
      }
    }
  }

  for (let row = -rowLimit; row <= rowLimit; row += 1) {
    const lowerShift = 1 - mod2(row);
    for (let col = -colLimit; col <= colLimit; col += 1) {
      // Down-pointing triangle: horizontal edge on the upper vertex row.
      // The lower vertex changes column on odd rows because the next vertex
      // row is shifted left by half a side. Omitting this parity correction
      // creates the alternating-row gaps and overlaps.
      addSlot(row, col, 'down', [
        vertex(row, col),
        vertex(row, col + 1),
        vertex(row + 1, col + mod2(row)),
      ]);

      // Up-pointing triangle shares each of its three edges with down triangles.
      const lowerLeft = col - lowerShift;
      addSlot(row, col, 'up', [
        vertex(row, col),
        vertex(row + 1, lowerLeft),
        vertex(row + 1, lowerLeft + 1),
      ]);
    }
  }

  // Place one actual triangle centroid at (0, 0). The same fixed offset is used
  // for every frame, so the lattice never changes phase as the pointer moves.
  let anchor = slots[0];
  for (const slot of slots) {
    if (length2(slot.x, slot.y) < length2(anchor.x, anchor.y)) anchor = slot;
  }
  const offsetX = anchor.x;
  const offsetY = anchor.y;

  for (const slot of slots) {
    slot.x -= offsetX;
    slot.y -= offsetY;
    slot.vertices = slot.vertices.map((v) => ({
      ...v,
      x: v.x - offsetX,
      y: v.y - offsetY,
    }));
    slot.distanceFromGridCenter = Math.hypot(slot.x, slot.y);
  }

  const activeSlots = slots.filter(
    (slot) => slot.distanceFromGridCenter <= radius + 0.001,
  );
  const activeIds = new Set(activeSlots.map((slot) => slot.id));
  for (const slot of activeSlots) {
    slot.neighbors = new Set(
      [...slot.neighbors].filter((id) => activeIds.has(id)),
    );
  }

  // Stable ordering is only a deterministic tie-breaker. Slot coordinates
  // never depend on the pointer; the interaction selects which fixed cells
  // are visible/occupied.
  activeSlots.sort((a, b) => a.id.localeCompare(b.id));
  for (const slot of activeSlots) {
    slot.opacity = 0;
    slot.targetOpacity = 0;
  }

  const byId = new Map(activeSlots.map((slot) => [slot.id, slot]));
  return { slots: activeSlots, byId, side, height: h };
}

function createHomeParticles(width, height, side) {
  const spacingX = side * FIELD.spacingX;
  const spacingY = side * FIELD.spacingY;
  const jitterX = spacingX * FIELD.jitter;
  const jitterY = spacingY * FIELD.jitter;
  const particles = [];
  let id = 0;
  const rows = Math.ceil(height / spacingY) + 3;
  const cols = Math.ceil(width / spacingX) + 3;

  for (let r = -1; r < rows; r += 1) {
    const stagger = mod2(r) * spacingX / 2;
    for (let c = -1; c < cols; c += 1) {
      const homeX =
        c * spacingX + stagger + randomBetween(-jitterX, jitterX) + spacingX;
      const homeY =
        r * spacingY + randomBetween(-jitterY, jitterY) + spacingY;
      const kind = Math.random() < 0.5 ? 'down' : 'up';
      const home = randomHomeOrientation();

      particles.push({
        id: id++,
        kind,
        homeX,
        homeY,
        restX: homeX,
        restY: homeY,
        planeDepth: 0,
        x: homeX,
        y: homeY,
        rx: home.rx,
        ry: home.ry,
        roll: home.roll,
        depth: home.depth,
        homeRx: home.rx,
        homeRy: home.ry,
        homeRoll: home.roll,
        homeDepth: home.depth,
        assignedSlot: null,
        sourceAlpha: 1,
        focusMix: 0,
        randomSeed: Math.random() * TAU,
        targetX: homeX,
        targetY: homeY,
      });
    }
  }

  return particles;
}

/**
 * Create and start the scene.
 *
 * @param {HTMLCanvasElement} canvas A canvas already laid out by the page.
 * @param {Partial<typeof DEFAULTS> & {
 *   quality?: 'low' | 'high',
 *   onEffectsChange?: (effects: 'glow' | 'flat') => void,
 * }} options Optional visual/behaviour overrides.
 * @returns {{
 *   resize: () => void,
 *   pause: () => void,
 *   resume: () => void,
 *   destroy: () => void,
 *   dispose: () => void,
 * }}
 */
export function createTriangleScene(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new TypeError('createTriangleScene expects a valid canvas element.');
  }

  const quality = options.quality === 'low' ? 'low' : 'high';
  const config = { ...DEFAULTS, ...options };

  // The mobile/weak-device mode trades pixel density and assembly speed for
  // headroom. Limiting DPR matters far more than skipping individual tiles.
  if (quality === 'low') {
    config.dprLimit = Math.min(Number(config.dprLimit) || 2, 1.5);
    config.assignmentInterval = Math.max(
      Number(config.assignmentInterval) || DEFAULTS.assignmentInterval,
      28,
    );
    config.maxAddsPerStep = Math.min(
      Number(config.maxAddsPerStep) || DEFAULTS.maxAddsPerStep,
      2,
    );
  }

  const ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: false,
  });
  if (!ctx) throw new Error('A 2D canvas context is not available.');

  const side = Math.max(
    18,
    Number(config.triangleSide) || DEFAULTS.triangleSide,
  );
  const triHeight = side * Math.sqrt(3) / 2;
  // The old lower bound (`side * 2`) made the default value the effective
  // minimum: with side = 60, any assemblyRadius below 120 was silently raised
  // back to 120, so the setting looked inert. Keep only a small floor so a
  // patch can shrink to a handful of tiles.
  const assemblyRadius = Math.max(
    side * 1.25,
    Number(config.assemblyRadius) || DEFAULTS.assemblyRadius,
  );
  const acceptRadius = Math.max(
    assemblyRadius + side * 2,
    Number(config.acceptRadius) || DEFAULTS.acceptRadius,
  );
  // keepRadius must stay outside assemblyRadius, otherwise tiles are released
  // in the same tick they are added. Preserve the configured value when it is
  // already larger, but never let the two radii cross.
  const keepRadius = Math.max(
    side * 1.5,
    Number(config.keepRadius) || DEFAULTS.keepRadius,
    assemblyRadius + side * 0.75,
  );

  let slotLattice = createSlotLattice(side, 1);
  let activeSlots = slotLattice.slots;
  let slotById = slotLattice.byId;

  const canonical = {
    down: makeCanonicalVertices('down', side),
    up: makeCanonicalVertices('up', side),
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let nextParticleId = 0;
  let rafId = 0;
  let wakeTimer = 0;
  let particleOrder = [];
  let particleOrderDirty = true;
  let resizeObserver = null;
  let destroyed = false;
  let apiPaused = false;
  let lastFrameTime = 0;
  let lastAssignmentTime = 0;
  let pendingInput = false;
  let growthActive = false;
  let mouseInside = false;
  let touchDown = false;
  let activeTouchId = null;
  let touchHoldUntil = 0;
  let pointerGraceUntil = 0;

  // Visual budget for assembled tiles. 'flat' skips every shadow pass and uses
  // an opaque edge line; it is chosen up front for weak devices and can also be
  // switched on later by the frame-gap probe below (never back).
  let effects = config.effects === 'flat' ? 'flat' : 'glow';
  const perfProbe = {
    gaps: [],
    armedAt:
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : 0,
    sinceCheck: 0,
  };

  const pointer = { x: 0, y: 0 };
  const pointerMotion = {
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  };

  const CAMERA = CAMERA_DISTANCE;

  // A reduced-motion visitor gets a still frame of the resting field instead of
  // a pointer-driven animation. Resize repaints it without restarting the loop.
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function canvasRect() {
    return canvas.getBoundingClientRect();
  }

  function pointerIsInside(clientX, clientY, rect) {
    return rect.width > 0 &&
      rect.height > 0 &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;
  }

  function setPointerPosition(clientX, clientY) {
    const rect = canvasRect();
    const inside = pointerIsInside(clientX, clientY, rect);

    if (inside) {
      // Scene coordinates are CSS pixels; the canvas transform handles DPR.
      const nextX = clientX - rect.left;
      const nextY = clientY - rect.top;
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now();

      if (pointerMotion.lastTime > 0) {
        const elapsed = Math.max(1, now - pointerMotion.lastTime);
        const vx = (nextX - pointerMotion.lastX) / elapsed;
        const vy = (nextY - pointerMotion.lastY) / elapsed;
        const blend = 1 - Math.exp(-elapsed / FIELD.motionBlendMs);
        pointerMotion.x = lerp(pointerMotion.x, vx, blend);
        pointerMotion.y = lerp(pointerMotion.y, vy, blend);
      }

      pointerMotion.lastX = nextX;
      pointerMotion.lastY = nextY;
      pointerMotion.lastTime = now;
      pointer.x = nextX;
      pointer.y = nextY;
    }

    return inside;
  }

  function updatePointerFromEvent(event) {
    return setPointerPosition(event.clientX, event.clientY);
  }

  function isInfluencing(now) {
    return activeTouchId !== null ||
      mouseInside ||
      touchDown ||
      now < touchHoldUntil ||
      now < pointerGraceUntil;
  }

  function projectRestingCenter(x, y, depth = 0) {
    // Perspective is centered on the viewport, but the viewport itself is not
    // rotated. Individual vertex rotations are applied in projectRestingVertex.
    const perspective =
      CAMERA / Math.max(MIN_PERSPECTIVE_DEPTH, CAMERA - depth);
    return {
      x: width / 2 + (x - width / 2) * perspective,
      y: height / 2 + (y - height / 2) * perspective,
      z: depth,
    };
  }

  function rebuildSlotLattice() {
    // Cover the full viewport plus a margin, so every screen location maps to
    // a permanent lattice slot even when the pointer approaches an edge.
    slotLattice = createSlotLattice(
      side,
      Math.hypot(width, height) / 2 + assemblyRadius + side * 3,
    );
    activeSlots = slotLattice.slots;
    slotById = slotLattice.byId;
  }

  function rebuildParticles() {
    for (const slot of activeSlots) {
      if (slot.occupant) slot.occupant.assignedSlot = null;
      slot.occupant = null;
      slot.opacity = 0;
      slot.targetOpacity = 0;
    }

    particles = createHomeParticles(width, height, side);
    nextParticleId = particles.length;

    for (const particle of particles) {
      const projected = projectRestingCenter(
        particle.homeX,
        particle.homeY,
        particle.homeDepth,
      );
      particle.restX = projected.x;
      particle.restY = projected.y;
      particle.planeDepth = projected.z;
      particle.x = projected.x;
      particle.y = projected.y;
      particle.targetX = projected.x;
      particle.targetY = projected.y;
    }

    particleOrderDirty = true;
  }

  // Keep every existing tile and slot, only move them to their new projected
  // positions. Used for the small viewport-height changes that mobile browsers
  // emit while the address bar animates during scrolling.
  function reprojectField() {
    for (const particle of particles) {
      const projected = projectRestingCenter(
        particle.homeX,
        particle.homeY,
        particle.homeDepth,
      );
      particle.restX = projected.x;
      particle.restY = projected.y;
      particle.planeDepth = projected.z;
      particle.x = projected.x;
      particle.y = projected.y;
      particle.targetX = projected.x;
      particle.targetY = projected.y;
      // Cached facet paths and gradients are in absolute canvas coordinates.
      particle.facet = undefined;
    }

    particleOrderDirty = true;
  }

  function resize() {
    if (destroyed) return;

    const rect = canvasRect();
    const nextWidth = Math.max(
      1,
      rect.width || canvas.clientWidth || window.innerWidth || 1,
    );
    const nextHeight = Math.max(
      1,
      rect.height || canvas.clientHeight || window.innerHeight || 1,
    );
    const nextDpr = Math.min(
      window.devicePixelRatio || 1,
      Number(config.dprLimit) || DEFAULTS.dprLimit,
    );

    // ResizeObserver also fires for layout shifts that leave the canvas size
    // untouched. Rebuilding there would reshuffle the field for no reason.
    if (
      nextWidth === width &&
      nextHeight === height &&
      nextDpr === dpr
    ) {
      return;
    }

    // A height change of a few tile sides (the address bar sliding on mobile)
    // keeps the existing field and only moves it to the new projection. The
    // field itself does not depend on the pixel ratio, so a dpr change alone
    // also re-renders without rebuilding.
    const soft =
      nextWidth === width &&
      Math.abs(nextHeight - height) <= side * FIELD.resizeRebuildSlack;

    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;

    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    if (soft) {
      reprojectField();
    } else {
      rebuildSlotLattice();
      rebuildParticles();
    }

    // Assigning canvas.width/height clears the bitmap. Paint right away so the
    // cleared surface is never presented as a blank frame.
    draw(performance.now());
    if (!reduceMotion) start();
  }

  function clearAssignments() {
    for (const slot of activeSlots) {
      if (slot.occupant) slot.occupant.assignedSlot = null;
      slot.occupant = null;
    }
  }

  function slotScreenPosition(slot) {
    return {
      x: width / 2 + slot.x,
      y: height / 2 + slot.y,
    };
  }

  function distanceToPointer(slot) {
    const p = slotScreenPosition(slot);
    return distance(p.x, p.y, pointer.x, pointer.y);
  }

  function findBestParticle(slot, candidates) {
    let best = null;
    let bestScore = Infinity;
    const target = slotScreenPosition(slot);
    const maxSourceDistance = side * FIELD.sourceReach;

    for (const particle of candidates) {
      if (particle.assignedSlot) continue;

      // Source facets may change orientation when they enter a slot. Do not
      // require a matching up/down source locally: that artificial scarcity
      // was one cause of holes inside an otherwise connected patch.
      const sourceDistance = distance(
        particle.restX,
        particle.restY,
        target.x,
        target.y,
      );
      if (sourceDistance > maxSourceDistance) continue;

      const stableTieBreak =
        ((particle.id * 37 + slot.row * 11 + slot.col * 7) % 101) / 101;
      const score =
        sourceDistance + stableTieBreak * SELECTION.tieBreakBias;

      if (score < bestScore) {
        bestScore = score;
        best = particle;
      }
    }

    return best;
  }

  function createLocalArrivalParticle(slot) {
    // The background pool is intentionally sparser than the slot lattice.
    // When no free source is nearby, synthesize a short local arrival rather
    // than leaving a permanent hole in the connected mosaic.
    const target = slotScreenPosition(slot);
    const speed = Math.hypot(pointerMotion.x, pointerMotion.y);
    const dirX =
      speed > FIELD.pointerEpsilon ? pointerMotion.x / speed : 0;
    const dirY =
      speed > FIELD.pointerEpsilon ? pointerMotion.y / speed : 0;
    const sideOffset =
      randomBetween(FIELD.spawnOffset[0], FIELD.spawnOffset[1]) * side;
    const lateral =
      randomBetween(-FIELD.spawnLateral, FIELD.spawnLateral) * side;
    const homeX = target.x - dirX * sideOffset - dirY * lateral;
    const homeY = target.y - dirY * sideOffset + dirX * lateral;
    const home = randomHomeOrientation();

    const particle = {
      id: nextParticleId++,
      kind: slot.kind,
      homeX,
      homeY,
      restX: homeX,
      restY: homeY,
      planeDepth: home.depth,
      x: homeX,
      y: homeY,
      rx: home.rx,
      ry: home.ry,
      roll: home.roll,
      depth: home.depth,
      homeRx: home.rx,
      homeRy: home.ry,
      homeRoll: home.roll,
      homeDepth: home.depth,
      assignedSlot: null,
      sourceAlpha: 0,
      focusMix: 0,
      randomSeed: Math.random() * TAU,
      targetX: homeX,
      targetY: homeY,
      synthetic: true,
    };

    particles.push(particle);
    particleOrderDirty = true;
    return particle;
  }

  function particleForSlot(slot, candidates) {
    const existing = findBestParticle(slot, candidates);
    if (existing) return existing;

    const local = createLocalArrivalParticle(slot);
    candidates.push(local);
    return local;
  }

  function occupy(slot, particle) {
    if (slot.occupant === particle) return;

    if (slot.occupant) slot.occupant.assignedSlot = null;

    if (particle.assignedSlot && particle.assignedSlot.occupant === particle) {
      const previous = particle.assignedSlot;
      previous.occupant = null;
      previous.targetOpacity = 0;
    }

    slot.occupant = particle;
    particle.assignedSlot = slot;
    slot.targetOpacity = 1;
  }

  function chooseSeed(candidates) {
    let bestSlot = null;
    let bestParticle = null;
    let bestScore = Infinity;

    for (const slot of activeSlots) {
      const radial = distanceToPointer(slot);
      if (radial > assemblyRadius * SELECTION.seedMargin) continue;

      const particle = findBestParticle(slot, candidates);
      const score =
        radial +
        (slot.kind === 'down' ? 0 : SELECTION.seedUpDownPenalty);

      if (score < bestScore) {
        bestScore = score;
        bestSlot = slot;
        bestParticle = particle;
      }
    }

    if (bestSlot) {
      occupy(
        bestSlot,
        bestParticle || particleForSlot(bestSlot, candidates),
      );
    }
  }

  function getFrontier() {
    const frontier = [];
    const speed = Math.hypot(pointerMotion.x, pointerMotion.y);
    const dirX =
      speed > FIELD.pointerEpsilon ? pointerMotion.x / speed : 0;
    const dirY =
      speed > FIELD.pointerEpsilon ? pointerMotion.y / speed : 0;

    for (const slot of activeSlots) {
      if (slot.occupant || distanceToPointer(slot) > assemblyRadius) continue;

      let touchesOccupied = false;
      for (const id of slot.neighbors) {
        const neighbor = slotById.get(id);
        if (neighbor && neighbor.occupant && neighbor.targetOpacity > 0) {
          touchesOccupied = true;
          break;
        }
      }

      if (touchesOccupied) frontier.push(slot);
    }

    // Fill the leading edge first. Radial distance keeps the patch compact;
    // the directional term biases additions toward where the pointer is going.
    frontier.sort((a, b) => {
      const pa = slotScreenPosition(a);
      const pb = slotScreenPosition(b);
      const ax = pa.x - pointer.x;
      const ay = pa.y - pointer.y;
      const bx = pb.x - pointer.x;
      const by = pb.y - pointer.y;
      const da = Math.hypot(ax, ay);
      const db = Math.hypot(bx, by);
      const leadA =
        speed > FIELD.pointerEpsilon ? ax * dirX + ay * dirY : 0;
      const leadB =
        speed > FIELD.pointerEpsilon ? bx * dirX + by * dirY : 0;
      const scoreA = da - leadA * SELECTION.leadBias;
      const scoreB = db - leadB * SELECTION.leadBias;
      return scoreA - scoreB || a.id.localeCompare(b.id);
    });

    return frontier;
  }

  function releaseDistantSlots() {
    for (const slot of activeSlots) {
      if (slot.occupant && distanceToPointer(slot) > keepRadius) {
        // Its source particle remains assigned until the transition finishes,
        // so it cannot reappear underneath the moving tile.
        slot.targetOpacity = 0;
      }
    }
  }

  function growAssembly() {
    releaseDistantSlots();

    const candidates = particles.filter((particle) => !particle.assignedSlot);
    const nearbyOccupied = activeSlots.some(
      (slot) =>
        slot.occupant &&
        slot.targetOpacity > 0 &&
        distanceToPointer(slot) <= assemblyRadius,
    );

    if (!nearbyOccupied) chooseSeed(candidates);

    let additions = 0;
    while (additions < config.maxAddsPerStep) {
      const frontier = getFrontier();
      if (frontier.length === 0) break;

      let added = false;
      for (const slot of frontier) {
        const particle = particleForSlot(slot, candidates);
        occupy(slot, particle);
        additions += 1;
        added = true;
        break;
      }

      if (!added) break;
    }

    // More growth is likely queued while the frontier still fills a full batch.
    return additions >= config.maxAddsPerStep;
  }

  function updateSlotTransitions(dt) {
    const ease = 1 - Math.exp(-dt / MOTION.slotEaseMs);

    for (const slot of activeSlots) {
      slot.opacity = approach(
        slot.opacity,
        slot.targetOpacity,
        ease,
        MOTION.snapEpsilon,
      );

      if (
        slot.targetOpacity === 0 &&
        slot.opacity < MOTION.clearOpacity &&
        slot.occupant
      ) {
        slot.occupant.assignedSlot = null;
        slot.occupant = null;
        slot.opacity = 0;
      }
    }
  }

  function assignTargets(now) {
    const influencing = isInfluencing(now);
    const interval = Math.max(
      8,
      Number(config.assignmentInterval) || DEFAULTS.assignmentInterval,
    );

    if (now - lastAssignmentTime < interval) return false;
    lastAssignmentTime = now;
    pendingInput = false;

    if (influencing) {
      growthActive = growAssembly();
      return growthActive;
    }

    growthActive = false;
    releaseDistantSlots();
    // When interaction ends, the whole patch retreats by the same path.
    for (const slot of activeSlots) slot.targetOpacity = 0;
    return false;
  }

  function updateParticles(dt) {
    // Advance slot transitions first: when a tile is cleared back to the free
    // field on this frame, `sourceAlpha` below already accounts for it, so the
    // free copy is drawn in the same frame the tile leaves the slot.
    updateSlotTransitions(dt);

    for (const particle of particles) {
      // Render a particle either at its resting source position or as its slot
      // occupant. Switch layers immediately; never cross-fade the same tile.
      // Synthetic local arrivals remain invisible when free and are discarded
      // after release.
      particle.sourceAlpha =
        particle.assignedSlot || particle.synthetic ? 0 : 1;

      particle.targetX = particle.restX;
      particle.targetY = particle.restY;
      particle.x = particle.restX;
      particle.y = particle.restY;

      const orientationEase = 1 - Math.exp(-dt / MOTION.orientationEaseMs);
      particle.rx = approach(particle.rx, particle.homeRx, orientationEase);
      particle.ry = approach(particle.ry, particle.homeRy, orientationEase);
      particle.roll = approach(
        particle.roll,
        particle.homeRoll,
        orientationEase,
      );
      particle.depth = approach(
        particle.depth,
        particle.homeDepth,
        orientationEase,
      );
      particle.focusMix = 0;
    }

    const beforeCount = particles.length;
    particles = particles.filter(
      (particle) => !particle.synthetic || particle.assignedSlot,
    );
    if (particles.length !== beforeCount) particleOrderDirty = true;
  }

  function drawSlotTriangle(slot) {
    if (!slot.occupant) return;

    const target = slotScreenPosition(slot);
    const source = slot.occupant;

    // The tile travels from its source position into the permanent slot and
    // retraces that path on release. Opacity is not tied to transition progress.
    const center = {
      x: lerp(source.restX, target.x, slot.opacity),
      y: lerp(source.restY, target.y, slot.opacity),
    };

    // Up- and down-pointing facets differ by a half turn in the plane. Keep the
    // source shape and spin it into the slot orientation instead of swapping
    // geometry in a single frame when the tile arrives or leaves.
    const halfTurn = source.kind === slot.kind ? 0 : Math.PI;

    const tile = {
      ...source,
      kind: source.kind,
      spin: halfTurn,
      x: center.x,
      y: center.y,
      restX: center.x,
      restY: center.y,
      rx: lerp(source.homeRx, 0, slot.opacity),
      ry: lerp(source.homeRy, 0, slot.opacity),
      roll: lerp(source.homeRoll, 0, slot.opacity),
      depth: lerp(source.homeDepth, 0, slot.opacity),
      focusMix: slot.opacity,
      sourceAlpha: 1,
      planeDepth: 0,
    };

    // Match the free-facet alpha at the start of the transition and reach full
    // opacity as the tile settles, so assignment never produces a brightness pop.
    drawTriangle(
      tile,
      MOTION.freeAlpha + slot.opacity * (1 - MOTION.freeAlpha),
    );
  }

  function projectRestingVertex(particle, point) {
    // Rotate each local vertex independently in 3D, then perspective-project it
    // around the unrotated viewport. This creates per-tile depth, not a tilted canvas.
    const local = rotate3D(
      point,
      particle.homeRx,
      particle.homeRy,
      particle.homeRoll,
    );
    const absoluteX = particle.homeX + local.x;
    const absoluteY = particle.homeY + local.y;
    const z = particle.homeDepth + local.z;
    const perspective =
      CAMERA / Math.max(MIN_PERSPECTIVE_DEPTH, CAMERA - z);

    return {
      x: width / 2 + (absoluteX - width / 2) * perspective,
      y: height / 2 + (absoluteY - height / 2) * perspective,
      z,
    };
  }

  function getProjectedVertices(particle) {
    const points = canonical[particle.kind];
    const focus = clamp(particle.focusMix, 0, 1);

    // Free facets never change shape: skip the second 3D pass (and the spin
    // blend) entirely. This covers almost the whole field on every frame.
    if (focus <= 0 && !particle.spin) {
      return points.map((point) => projectRestingVertex(particle, point));
    }

    const projected = points.map((point) => {
      const resting = projectRestingVertex(particle, point);
      const rotated = rotate3D(
        point,
        particle.rx,
        particle.ry,
        particle.roll,
      );
      const z = rotated.z + particle.depth;
      const perspective =
        CAMERA / Math.max(MIN_PERSPECTIVE_DEPTH, CAMERA - z);
      const targetOffsetX = rotated.x * perspective;
      const targetOffsetY = rotated.y * perspective;

      return {
        // Particle motion moves the center once; the local shape morphs from
        // the exact resting perspective to a flat, edge-aligned triangle.
        x: particle.x + lerp(resting.x - particle.restX, targetOffsetX, focus),
        y: particle.y + lerp(resting.y - particle.restY, targetOffsetY, focus),
        z: lerp(resting.z, z, focus),
      };
    });

    // Up/down facets are half a turn apart in the plane. Unwind that turn
    // gradually as the tile leaves the slot and apply it as it settles, so the
    // silhouette never flips between two frames.
    const spin = (particle.spin ?? 0) * focus;
    if (spin === 0) return projected;

    const cos = Math.cos(spin);
    const sin = Math.sin(spin);

    return projected.map((vertex) => {
      const dx = vertex.x - particle.x;
      const dy = vertex.y - particle.y;

      return {
        x: particle.x + dx * cos - dy * sin,
        y: particle.y + dx * sin + dy * cos,
        z: vertex.z,
      };
    });
  }

  function faceLighting(particle) {
    const normal = rotate3D(
      { x: 0, y: 0, z: 1 },
      particle.rx,
      particle.ry,
      particle.roll,
    );
    const diffuse = Math.max(
      0,
      normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z,
    );
    const specularDot = Math.max(
      0,
      normal.x * HALF_LIGHT.x +
        normal.y * HALF_LIGHT.y +
        normal.z * HALF_LIGHT.z,
    );
    const specular =
      Math.pow(specularDot, LIGHTING.specularPower) *
      (LIGHTING.specularBase + particle.focusMix * LIGHTING.specularFocus);
    // Rotation is what gives the resting field its texture, so the depth term
    // is deliberately noticeable instead of a near-invisible nudge.
    const depthFactor = clamp(
      1 + particle.depth * LIGHTING.depthScale,
      LIGHTING.depthMin,
      LIGHTING.depthMax,
    );

    return { diffuse, specular, depthFactor };
  }

  function facadeColors(particle) {
    const { diffuse, specular, depthFactor } = faceLighting(particle);
    const base = mixRgb(PALETTE.far, PALETTE.near, particle.focusMix);
    const ambient = LIGHTING.ambient + diffuse * LIGHTING.diffuse;
    const lit = mulRgb(
      base,
      ambient * depthFactor,
      LIGHTING.litLift + specular * LIGHTING.litSpecular,
    );
    const mid = mulRgb(
      base,
      (LIGHTING.midBase + diffuse * LIGHTING.midDiffuse) * depthFactor,
      LIGHTING.midLift + specular * LIGHTING.midSpecular,
    );
    const dark = mulRgb(
      base,
      (LIGHTING.darkBase + diffuse * LIGHTING.darkDiffuse) * depthFactor,
      LIGHTING.darkLift,
    );

    return { lit, mid, dark, specular };
  }

  // Free facets never move or change orientation, so their projected path,
  // gradient and colour strings can be built once and reused. This removes the
  // per-frame 3D projection, lighting math and gradient allocation for the bulk
  // of the field, which is what makes the effect cheap on weak devices.
  function buildFacetCache(particle) {
    const vertices = canonical[particle.kind].map((point) =>
      projectRestingVertex(particle, point),
    );
    const [a, b, c] = vertices;

    const body = new Path2D();
    body.moveTo(a.x, a.y);
    body.lineTo(b.x, b.y);
    body.lineTo(c.x, c.y);
    body.closePath();

    // Highlight the edge that faces the light.
    const edges = [
      { p: a, q: b },
      { p: b, q: c },
      { p: c, q: a },
    ];
    let highlighted = edges[0];
    let bestLightScore = Infinity;

    for (const edge of edges) {
      const mx = (edge.p.x + edge.q.x) / 2 - particle.x;
      const my = (edge.p.y + edge.q.y) / 2 - particle.y;
      const score = mx * LIGHT.x + my * LIGHT.y;

      if (score < bestLightScore) {
        bestLightScore = score;
        highlighted = edge;
      }
    }

    const bevel = new Path2D();
    bevel.moveTo(highlighted.p.x, highlighted.p.y);
    bevel.lineTo(highlighted.q.x, highlighted.q.y);

    const { lit, mid, dark, specular } = facadeColors({
      rx: particle.rx,
      ry: particle.ry,
      roll: particle.roll,
      depth: particle.depth,
      focusMix: 0,
    });

    // Stronger diagonal facet gradient follows the upper-left light direction.
    const lightX = LIGHT.x * side * RENDER.lightReachRatioX;
    const lightY = LIGHT.y * triHeight * RENDER.lightReachRatioY;
    const gradient = ctx.createLinearGradient(
      particle.x + lightX,
      particle.y + lightY,
      particle.x - lightX,
      particle.y - lightY,
    );
    gradient.addColorStop(0, colorRgb(lit));
    gradient.addColorStop(
      RENDER.gradientColorStop,
      colorRgb(mixRgb(lit, mid, RENDER.gradientColorStop)),
    );
    gradient.addColorStop(RENDER.gradientMidStop, colorRgb(mid));
    gradient.addColorStop(1, colorRgb(dark));

    particle.facet = {
      body,
      bevel,
      gradient,
      contour: `rgba(${RENDER.contourRgb}, ${RENDER.contourAlphaBase})`,
      bevelContour: `rgba(${PALETTE.edge.join(', ')}, ${
        RENDER.bevelAlphaBase + specular * RENDER.bevelAlphaSpecular
      })`,
      rx: particle.rx,
      ry: particle.ry,
      roll: particle.roll,
      depth: particle.depth,
    };

    return particle.facet;
  }

  function drawCachedFacet(particle, opacityOverride) {
    const cache =
      particle.facet &&
      particle.facet.rx === particle.rx &&
      particle.facet.ry === particle.ry &&
      particle.facet.roll === particle.roll &&
      particle.facet.depth === particle.depth
        ? particle.facet
        : buildFacetCache(particle);

    ctx.save();
    ctx.globalAlpha =
      opacityOverride === null
        ? MOTION.freeAlpha * (particle.sourceAlpha ?? 1)
        : opacityOverride;
    ctx.fillStyle = cache.gradient;
    ctx.fill(cache.body);

    // The contour remains subdued. The light-facing edge has a separate,
    // restrained bevel so the pieces read as small facets instead of flat icons.
    ctx.lineJoin = 'round';
    ctx.lineWidth = RENDER.contourWidth;
    ctx.strokeStyle = cache.contour;
    ctx.stroke(cache.body);
    ctx.lineWidth = RENDER.bevelWidth;
    ctx.strokeStyle = cache.bevelContour;
    ctx.stroke(cache.bevel);
    ctx.restore();
  }

  function drawTriangle(particle, opacityOverride = null) {
    const focus = clamp(particle.focusMix, 0, 1);

    if (focus === 0 && !particle.spin) {
      drawCachedFacet(particle, opacityOverride);
      return;
    }

    const projected = getProjectedVertices(particle);
    const [a, b, c] = projected;
    const { lit, mid, dark, specular } = facadeColors(particle);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();

    // Stronger diagonal facet gradient follows the upper-left light direction.
    const lightX = LIGHT.x * side * RENDER.lightReachRatioX;
    const lightY = LIGHT.y * triHeight * RENDER.lightReachRatioY;
    const gradient = ctx.createLinearGradient(
      particle.x + lightX,
      particle.y + lightY,
      particle.x - lightX,
      particle.y - lightY,
    );
    gradient.addColorStop(0, colorRgb(lit));
    gradient.addColorStop(
      RENDER.gradientColorStop,
      colorRgb(mixRgb(lit, mid, RENDER.gradientColorStop)),
    );
    gradient.addColorStop(RENDER.gradientMidStop, colorRgb(mid));
    gradient.addColorStop(1, colorRgb(dark));

    ctx.save();
    const tileAlpha =
      opacityOverride === null
        ? (MOTION.freeAlpha +
            particle.focusMix * (1 - MOTION.freeAlpha)) *
          (particle.sourceAlpha ?? 1)
        : opacityOverride;
    ctx.globalAlpha = tileAlpha;

    if (effects === 'glow' && particle.focusMix > RENDER.shadowThreshold) {
      ctx.shadowColor = `rgba(${RENDER.shadowRgb}, ${
        RENDER.shadowAlphaBase + particle.focusMix * RENDER.shadowAlphaFocus
      })`;
      ctx.shadowBlur = RENDER.shadowBlur * particle.focusMix;
      ctx.shadowOffsetY = RENDER.shadowOffsetY * particle.focusMix;
    }

    ctx.fillStyle = gradient;
    ctx.fill();

    // As the tile reaches its slot, cover the free-field gradient with the flat
    // assembled colour. The overlay is tied to focus, so at focus 0 the tile is
    // still pixel-identical to the free facet it replaces and nothing pops.
    if (focus > 0) {
      ctx.globalAlpha = tileAlpha * focus;
      ctx.fillStyle = ASSEMBLED.fill;
      ctx.fill();
      ctx.globalAlpha = tileAlpha;
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // The subdued contour and bevel belong to free facets; they fade out as the
    // glowing assembled edge fades in.
    ctx.lineJoin = 'round';
    if (focus < 1) {
      ctx.globalAlpha = tileAlpha * (1 - focus);
      ctx.lineWidth = RENDER.contourWidth;
      ctx.strokeStyle = `rgba(${RENDER.contourRgb}, ${
        RENDER.contourAlphaBase + particle.focusMix * RENDER.contourAlphaFocus
      })`;
      ctx.stroke();
      ctx.globalAlpha = tileAlpha;
    }

    const edges = [
      { p: a, q: b },
      { p: b, q: c },
      { p: c, q: a },
    ];

    let highlighted = edges[0];
    let bestLightScore = Infinity;

    for (const edge of edges) {
      const mx = (edge.p.x + edge.q.x) / 2 - particle.x;
      const my = (edge.p.y + edge.q.y) / 2 - particle.y;
      const score = mx * LIGHT.x + my * LIGHT.y;

      if (score < bestLightScore) {
        bestLightScore = score;
        highlighted = edge;
      }
    }

    if (focus < 1) {
      ctx.globalAlpha = tileAlpha * (1 - focus);
      ctx.beginPath();
      ctx.moveTo(highlighted.p.x, highlighted.p.y);
      ctx.lineTo(highlighted.q.x, highlighted.q.y);
      ctx.lineWidth = RENDER.bevelWidth;
      ctx.strokeStyle = `rgba(${PALETTE.edge.join(', ')}, ${
        RENDER.bevelAlphaBase +
        particle.focusMix * RENDER.bevelAlphaFocus +
        specular * RENDER.bevelAlphaSpecular
      })`;
      ctx.stroke();
      ctx.globalAlpha = tileAlpha;
    }

    // Light contour reserved for assembled tiles. In 'glow' mode it is blurred
    // through a shadow pass; in 'flat' mode the same line is drawn with an
    // opaque colour and no shadow, which is the cheap path for weak devices.
    // Shared edges of neighbouring tiles reinforce each other, so the mesh
    // reads as one lit wireframe rather than a set of separate icons.
    if (focus > 0) {
      ctx.globalAlpha = tileAlpha * focus;
      ctx.lineWidth = ASSEMBLED.edgeWidth;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();

      if (effects === 'flat') {
        ctx.strokeStyle = ASSEMBLED.flatEdgeColor;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = ASSEMBLED.edgeColor;
        ctx.shadowColor = ASSEMBLED.glowColor;
        ctx.shadowBlur = ASSEMBLED.glowBlur;
      }

      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function draw(now) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = config.background;
    ctx.fillRect(0, 0, width, height);

    // Background facets remain where they started. Assigned sources are hidden
    // immediately; the corresponding tile travels into its fixed slot. The
    // ordering is static, so it is cached instead of re-sorted every frame.
    if (particleOrderDirty) {
      particleOrder = particles
        .slice()
        .sort((a, b) => a.planeDepth - b.planeDepth);
      particleOrderDirty = false;
    }

    for (const particle of particleOrder) {
      if ((particle.sourceAlpha ?? 1) > MOTION.visibleOpacity) {
        drawTriangle(particle);
      }
    }

    // The assembled mosaic is drawn in two passes. Tiles that are still
    // travelling (arriving or leaving) stay below fully settled tiles, so a
    // free facet can never cover the connected mesh during detach or pass-through.
    const settling = [];
    const settled = [];

    for (const slot of activeSlots) {
      // Every occupied slot is drawn, including the first and last frames of a
      // transition where opacity is near zero. At that point the tile is
      // geometrically identical to its free source, so removing an opacity
      // gate here closes the gap where neither the tile nor the free facet was
      // painted (the visible "blink" on detach).
      if (!slot.occupant) continue;

      if (
        slot.targetOpacity > 0 &&
        slot.opacity >= MOTION.settledOpacity
      ) {
        settled.push(slot);
      } else {
        settling.push(slot);
      }
    }

    // Stable, geometry-based ordering keeps the static field from shimmering
    // and makes overlapping edges resolve the same way on every frame.
    settling.sort(
      (a, b) =>
        a.occupant.planeDepth - b.occupant.planeDepth ||
        a.y - b.y ||
        a.x - b.x,
    );
    settled.sort((a, b) => a.y - b.y || a.x - b.x);

    for (const slot of settling) drawSlotTriangle(slot);
    for (const slot of settled) drawSlotTriangle(slot);

    if (isInfluencing(now)) {
      const glow = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        assemblyRadius * GLOW.radiusFactor,
      );
      glow.addColorStop(0, GLOW.centerColor);
      glow.addColorStop(GLOW.midStop, GLOW.midColor);
      glow.addColorStop(1, GLOW.edgeColor);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // A settled scene is a still image: nothing moves once all tiles have reached
  // their targets and no new growth is queued. Keep animating only while there
  // is actual work, then park the RAF loop and wake on input or on the next
  // time-based state change (touch hold / pointer leave grace). This keeps a
  // stationary page at zero animation frames instead of repainting an identical
  // canvas forever.
  function needsFrame() {
    // Input waiting to be processed, or a growth batch that may still be
    // filling, keeps the loop alive. Otherwise only moving tiles matter.
    if (pendingInput || growthActive) return true;

    for (const slot of activeSlots) {
      if (slot.occupant && slot.opacity !== slot.targetOpacity) return true;
    }

    return false;
  }

  function scheduleWake(now) {
    if (wakeTimer) return;

    let until = Infinity;
    if (touchHoldUntil > now) until = Math.min(until, touchHoldUntil);
    if (pointerGraceUntil > now) until = Math.min(until, pointerGraceUntil);
    if (until === Infinity) return;

    wakeTimer = window.setTimeout(
      () => {
        wakeTimer = 0;
        start();
      },
      Math.max(16, until - now),
    );
  }

  /**
   * Drop the glow for the rest of the session. This is intentionally one-way:
   * a measured slowdown is a better signal than a lucky fast patch later, and
   * flipping effects mid-animation would be visible.
   */
  function downgradeEffects() {
    if (effects === 'flat') return;

    effects = 'flat';
    perfProbe.gaps.length = 0;
    perfProbe.sinceCheck = 0;

    if (typeof config.onEffectsChange === 'function') {
      try {
        config.onEffectsChange(effects);
      } catch (error) {
        // A broken observer must not stop the animation.
        console.error('Не удалось применить режим эффектов:', error);
      }
    }
  }

  /**
   * Median frame gap over a short rolling window. Frame gaps (not dt) are the
   * cheapest honest signal: they include compositing and any main-thread work
   * the scene itself cannot see, and they cost nothing beyond a few numbers.
   */
  function noteFrameGap(now, gap) {
    if (effects !== 'glow' || !gap || gap > PERF.maxGapMs) return;
    if (now - perfProbe.armedAt < PERF.armAfterMs) return;

    perfProbe.gaps.push(gap);
    if (perfProbe.gaps.length > PERF.window) perfProbe.gaps.shift();
    if (perfProbe.gaps.length < PERF.window) return;

    perfProbe.sinceCheck += 1;
    if (perfProbe.sinceCheck < PERF.checkEvery) return;
    perfProbe.sinceCheck = 0;

    const sorted = perfProbe.gaps.slice().sort((x, y) => x - y);
    const median = sorted[sorted.length >> 1];
    if (median > PERF.slowFrameMs) downgradeEffects();
  }

  function frame(now) {
    if (destroyed) return;
    rafId = 0;

    if (apiPaused || document.hidden) {
      lastFrameTime = 0;
      return;
    }

    const gap = lastFrameTime ? now - lastFrameTime : 0;
    const dt = lastFrameTime
      ? clamp(now - lastFrameTime, 0, 40)
      : 16.7;

    lastFrameTime = now;
    noteFrameGap(now, gap);
    assignTargets(now);
    updateParticles(dt);
    draw(now);

    if (needsFrame()) {
      rafId = window.requestAnimationFrame(frame);
    } else {
      lastFrameTime = 0;
      scheduleWake(now);
    }
  }

  function onPointerMove(event) {
    // Touch is tracked through TouchEvents below: PointerEvents are cancelled
    // by the browser as soon as a swipe starts scrolling, which would stop the
    // build point from following the finger.
    if (event.pointerType === 'touch') return;

    if (event.pointerType === 'pen') {
      if (!touchDown) return;

      const inside = updatePointerFromEvent(event);
      if (inside) pointerGraceUntil = 0;
      start();
      return;
    }

    const inside = updatePointerFromEvent(event);

    if (inside) {
      mouseInside = true;
      pointerGraceUntil = 0;
    } else if (mouseInside) {
      mouseInside = false;
      pointerGraceUntil = performance.now() + config.leaveGraceMs;
    }

    // The render loop parks when the scene is still; any pointer event may
    // schedule new growth or release, so wake it up.
    start();
  }

  function onPointerDown(event) {
    if (event.pointerType === 'touch') return;

    const inside = updatePointerFromEvent(event);
    if (!inside) return;

    pointerGraceUntil = 0;

    if (event.pointerType === 'pen') {
      touchDown = true;
      touchHoldUntil = performance.now() + config.touchHoldMs;
    } else {
      mouseInside = true;
    }

    start();
  }

  function onPointerUp(event) {
    if (event.pointerType === 'pen') {
      updatePointerFromEvent(event);
      touchDown = false;
      touchHoldUntil = performance.now() + config.touchHoldMs;
      start();
    }
  }

  function onPointerCancel(event) {
    if (event.pointerType === 'pen') {
      touchDown = false;
      touchHoldUntil =
        performance.now() + Math.min(280, config.leaveGraceMs);
      start();
    }
  }

  function findTouch(list, id) {
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  }

  function onTouchStart(event) {
    if (activeTouchId !== null) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const inside = setPointerPosition(touch.clientX, touch.clientY);
    if (!inside) return;

    activeTouchId = touch.identifier;
    touchDown = true;
    touchHoldUntil = performance.now() + config.touchHoldMs;
    pointerGraceUntil = 0;
    start();
  }

  function onTouchMove(event) {
    if (activeTouchId === null) return;

    const touch = findTouch(event.touches, activeTouchId);
    if (!touch) return;

    // Passive touch events keep firing while the page scrolls, so the build
    // point follows a swipe exactly like a cursor.
    if (setPointerPosition(touch.clientX, touch.clientY)) {
      pointerGraceUntil = 0;
    }
    start();
  }

  function onTouchEnd(event) {
    if (activeTouchId === null) return;

    const touch = findTouch(event.changedTouches, activeTouchId);
    if (!touch) return;

    setPointerPosition(touch.clientX, touch.clientY);
    activeTouchId = null;
    touchDown = false;
    touchHoldUntil = performance.now() + config.touchHoldMs;
    start();
  }

  function onTouchCancel(event) {
    if (activeTouchId === null) return;

    const touch = findTouch(event.changedTouches, activeTouchId);
    if (touch) setPointerPosition(touch.clientX, touch.clientY);

    activeTouchId = null;
    touchDown = false;
    touchHoldUntil =
      performance.now() + Math.min(280, config.leaveGraceMs);
    start();
  }

  // Window-level listeners are intentional: the canvas is often a background
  // layer behind links and buttons, so events may target the page content rather
  // than the canvas. Coordinates are still checked against the canvas rectangle.
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerCancel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchCancel, { passive: true });

  function start() {
    if (wakeTimer) {
      window.clearTimeout(wakeTimer);
      wakeTimer = 0;
    }
    // Any wake means state may have changed (pointer, touch, resize, timers).
    pendingInput = true;
    if (destroyed || apiPaused || document.hidden || rafId || reduceMotion) {
      return;
    }
    lastFrameTime = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    if (wakeTimer) window.clearTimeout(wakeTimer);
    rafId = 0;
    wakeTimer = 0;
    lastFrameTime = 0;
  }

  /** Pause the loop from application code (route change, menu, etc.). */
  function pause() {
    apiPaused = true;
    stop();
  }

  /** Resume only if the page is visible; hidden tabs stay suspended. */
  function resume() {
    apiPaused = false;
    if (!reduceMotion) start();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop();
    } else if (!apiPaused && !reduceMotion) {
      start();
    }
  }

  function dispose() {
    if (destroyed) return;

    destroyed = true;
    stop();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchCancel);
    window.removeEventListener('resize', resize);

    if (resizeObserver) resizeObserver.disconnect();
    clearAssignments();
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener('resize', resize, { passive: true });
  }

  resize();
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (!reduceMotion) start();

  return {
    resize,
    pause,
    resume,
    destroy: dispose,
    dispose,
  };
}

// Expose a global as well for callers that load this ES module with
// <script type="module">. Bundler-based projects should prefer the named import.
if (typeof window !== 'undefined') {
  window.createTriangleScene = createTriangleScene;
}
