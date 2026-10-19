// Pixel art for the wok of lomo saltado and the progress bar, drawn as Raster cells.
// Pure functions: no engine calls, so the same code renders a PNG preview in Node.

/** A pixel nothing paints: the terminal's own background shows through. */
export const CLEAR = -1

/** Raster's "terminal default" colour (bit 24 alone). */
const DEFAULT = 0x01000000

const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584

export type WokLook = {
  /** 0 raw beef in a hot wok, 1 served with fries and parsley. */
  doneness: number
  /** Animation step; one per tick. */
  frame: number
  /** Flames, tossing and smoke on. */
  isCooking: boolean
}

type Rgb = [number, number, number]

// Carbon steel, blackened by years of wok hei.
const RIM = 0x4a4a52
const RIM_LIGHT = 0x8e8e9a
const RIM_DARK = 0x1e1e24
const WALL = 0x2c2c32
const STEEL: Rgb = [52, 50, 56]
const HANDLE = 0x7a4a26
const HANDLE_DARK = 0x55331a
const HANDLE_LIGHT = 0xa0683a
const FLAME = [0xffe04a, 0xffa21f, 0xf0641e, 0xc8361a]

// What goes into the wok, in order: the lomo first, then onion, tomato, ají
// amarillo and the fries; parsley only once it is served.
const BEEF_RAW: Rgb = [178, 52, 58]
const BEEF_SEARED: Rgb = [112, 56, 30]
const ONION_RAW: Rgb = [128, 46, 118]
const ONION_SOFT: Rgb = [186, 108, 156]
const TOMATO: Rgb = [222, 54, 40]
const AJI: Rgb = [246, 182, 38]
const FRIES: Rgb = [242, 208, 112]
const FRIES_EDGE: Rgb = [214, 160, 64]
const SAUCE: Rgb = [92, 40, 18]
const PARSLEY = [0x5fb548, 0x3f9a36]

/** Each ingredient: when it goes in, and its share of the pile. */
const PILE: { name: 'beef' | 'onion' | 'tomato' | 'aji' | 'fries'; at: number; share: number }[] = [
  { name: 'beef', at: 0, share: 0.42 },
  { name: 'onion', at: 0.2, share: 0.16 },
  { name: 'tomato', at: 0.4, share: 0.12 },
  { name: 'aji', at: 0.55, share: 0.08 },
  { name: 'fries', at: 0.75, share: 0.16 },
]

/** Frames between two tosses of the wok: the pile jumps and lands somewhere else. */
const TOSS_EVERY = 10
/** Frames between two flambé bursts, and how long one lasts. */
const FLARE_EVERY = 28
const FLARE_FOR = 4

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

const pack = ([r, g, b]: Rgb): number =>
  (Math.max(0, Math.min(255, Math.round(r))) << 16) |
  (Math.max(0, Math.min(255, Math.round(g))) << 8) |
  Math.max(0, Math.min(255, Math.round(b)))

/** A stable pseudo-random number in [0, 1) for a pixel and a seed. */
const hash = (x: number, y: number, seed = 0): number => {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n ^= n >>> 16
  return (n >>> 0) / 4294967296
}

/** The colour of one piece of an ingredient, at a doneness, lit a little by `shade` (0..1). */
function pieceColour(name: (typeof PILE)[number]['name'], doneness: number, shade: number, isEdge: boolean): Rgb {
  const light = (rgb: Rgb) => mix(rgb, [255, 245, 230], (shade - 0.5) * 0.25)
  switch (name) {
    case 'beef':
      // Seared fast: red to brown in the first half, glazed darker with the soy and vinegar after.
      return light(mix(BEEF_RAW, BEEF_SEARED, Math.min(1, doneness * 1.8)))
    case 'onion':
      return light(mix(ONION_RAW, ONION_SOFT, Math.min(1, (doneness - 0.2) * 2)))
    case 'tomato':
      return light(TOMATO)
    case 'aji':
      return light(AJI)
    case 'fries':
      return light(isEdge ? FRIES_EDGE : FRIES)
  }
}

/**
 * The wok as a grid of pixels, `width` by `height` (even), row-major: a round
 * wok seen from above at an angle, a helper loop on the left and a long wooden
 * handle on the right, smoke rising over it, flames licking its lower edge and,
 * every few seconds, the flambé that makes a lomo saltado.
 */
export function wokPixels(width: number, height: number, look: WokLook): Int32Array {
  const pixels = new Int32Array(width * height).fill(CLEAR)
  const set = (x: number, y: number, colour: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) pixels[y * width + x] = colour
  }
  const get = (x: number, y: number) => (x >= 0 && x < width && y >= 0 && y < height ? pixels[y * width + x] : CLEAR)
  const doneness = Math.max(0, Math.min(1, look.doneness))
  const smokeRows = height >= 16 ? 3 : 1
  const panRows = height - smokeRows - 1 // one row under the wok for the flames
  const helper = width >= 26 ? 2 : 1
  const handle = width >= 26 ? 7 : 4
  const ry = panRows / 2
  const rx = Math.min(ry * 1.3, (width - helper - handle) / 2 - 0.5)
  const cx = (width - 1 - (handle - helper)) / 2
  const cy = smokeRows + (panRows - 1) / 2
  // Distance from the centre in units of the ellipse: 1 on its edge.
  const reach = (x: number, y: number, ax: number, ay: number) => Math.hypot((x - cx) / ax, (y - cy) / ay)
  const irx = rx - 1.15
  const iry = ry - 1.05
  const toss = look.isCooking ? Math.floor(look.frame / TOSS_EVERY) : 0
  // Right after a toss the pile is still in the air: it sits a pixel higher.
  const lift = look.isCooking && look.frame % TOSS_EVERY < 2 ? 1 : 0
  const isFlaring = look.isCooking && look.frame % FLARE_EVERY < FLARE_FOR
  const open = PILE.filter(piece => doneness >= piece.at)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (reach(x, y, rx, ry) > 1) continue
      const inner = reach(x, y, irx, iry)
      if (inner > 1) {
        // The rim, lit from the upper left.
        const nx = (x - cx) / rx
        const ny = (y - cy) / ry
        const light = (-0.55 * nx - 0.85 * ny) / Math.max(0.001, Math.hypot(nx, ny))
        set(x, y, light > 0.45 ? RIM_LIGHT : light < -0.35 ? RIM_DARK : RIM)
        continue
      }
      // The far inner wall shows as a thin dark band along the top.
      if (y < cy && reach(x, y + 1, irx, iry) > 1) {
        set(x, y, WALL)
        continue
      }
      // The bottom of the wok: steel, glossed with the juice as it cooks.
      let floor = mix(STEEL, SAUCE, doneness * 0.85)
      floor = mix(floor, [255, 240, 220], 0.1 * (1 - inner) + (hash(x, y, 3) > 0.9 ? 0.15 : 0))
      // Strips two pixels long, rows offset like bricks: the beef and the fries are sticks.
      const sy = y + lift
      const strip = Math.floor((x + (sy % 2)) / 2)
      const isEdge = (x + (sy % 2)) % 2 === 1
      let roll = hash(strip, sy, toss + 11)
      // The pile heaps in the middle and thins toward the wall.
      roll += Math.max(0, inner - 0.75) * 0.6
      let colour: Rgb = floor
      for (const piece of open) {
        if (roll < piece.share) {
          colour = pieceColour(piece.name, doneness, hash(x, y, toss + 5), isEdge)
          break
        }
        roll -= piece.share
      }
      set(x, y, pack(colour))
    }
  }

  if (doneness >= 1) {
    // Served: chopped parsley over the top.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (reach(x, y, irx, iry) > 0.85 || get(x, y) === WALL) continue
        const roll = hash(x, y, 21)
        if (roll > 0.86) set(x, y, PARSLEY[roll > 0.93 ? 1 : 0]!)
      }
    }
  }

  // The helper loop on the left: a short steel tab.
  const handleY = Math.round(cy)
  let leftEdge = 0
  while (leftEdge < width && reach(leftEdge, handleY, rx, ry) > 1) leftEdge++
  let rightEdge = width - 1
  while (rightEdge >= 0 && reach(rightEdge, handleY, rx, ry) > 1) rightEdge--
  for (let i = 1; i <= helper; i++) set(leftEdge - i, handleY, i === helper ? RIM_LIGHT : RIM)
  // The long wooden handle on the right, after a steel socket, rising a little.
  set(rightEdge + 1, handleY, RIM_LIGHT)
  for (let i = 2; i <= handle; i++) {
    const y = handleY - (handle >= 6 && i > handle / 2 + 1 ? 1 : 0)
    set(rightEdge + i, y, i === handle ? HANDLE_LIGHT : HANDLE)
    if (handle >= 6) set(rightEdge + i, y + 1, HANDLE_DARK)
  }

  if (look.isCooking) {
    // Flames lick the lower half of the wok from outside its edge; in a flambé they climb the sides.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (get(x, y) !== CLEAR) continue
        const isLowHalf = y >= cy + ry * 0.45
        if (!isLowHalf && !isFlaring) continue
        const out = isFlaring ? reach(x, y, rx + 2, ry + 2) : reach(x, y, rx + 1.4, ry + 1.2)
        if (out > 1 || reach(x, y, rx, ry) <= 1) continue
        if (!isLowHalf && y < cy - ry * 0.2) continue
        const roll = hash(x, y, look.frame + 7)
        const isLow = y >= height - 1
        if (roll < (isLow ? 0.2 : 0.35)) continue
        set(x, y, FLAME[Math.min(3, Math.floor(roll * 4.2 - (isLow ? 0 : 0.8)))] ?? FLAME[0]!)
      }
    }
  }

  if (isFlaring) {
    // The flambé: the wok catches and fire tongues rise over the food and into the air above it.
    for (let y = 0; y < Math.round(cy); y++) {
      for (let x = 0; x < width; x++) {
        if (reach(x, y, irx + 0.5, iry + smokeRows) > 1) continue
        if (get(x, y) !== CLEAR && reach(x, y, irx, iry) > 1) continue
        const roll = hash(x, y, look.frame + 13)
        const height01 = (cy - y) / (cy + 1)
        if (roll < 0.35 + height01 * 0.4) continue
        set(x, y, FLAME[Math.min(3, Math.floor(height01 * 3 + roll * 1.2))] ?? FLAME[0]!)
      }
    }
  } else if (look.isCooking || doneness >= 1) {
    // Smoke: loose puffs that rise off the wok, drift and fade; never a column.
    const wisps = width >= 26 ? 3 : 2
    for (let w = 0; w < wisps; w++) {
      const baseX = cx + ((w + 0.5) / wisps - 0.5) * rx * 1.2
      for (let y = 0; y < smokeRows; y++) {
        const phase = (look.frame * 0.3 + w * 1.7 + (smokeRows - y)) % 2.4
        if (phase > 1) continue
        const drift = Math.round(Math.sin(look.frame * 0.15 + w * 2.1 + y) * 1.2)
        const fade = (y + 1) / (smokeRows + 1)
        set(Math.round(baseX) + drift, y, pack(mix([62, 62, 68], [150, 150, 158], fade * (1 - phase * 0.5))))
      }
    }
  }

  return pixels
}

/** Two stacked pixels per cell, drawn with half blocks: `width` columns, `height / 2` rows. */
export function pixelsToCells(pixels: Int32Array, width: number, height: number): Uint32Array {
  const rows = Math.ceil(height / 2)
  const words = new Uint32Array(width * rows * 3)
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < width; x++) {
      const top = pixels[row * 2 * width + x] ?? CLEAR
      const bottom = row * 2 + 1 < height ? (pixels[(row * 2 + 1) * width + x] ?? CLEAR) : CLEAR
      const at = (row * width + x) * 3
      if (top === CLEAR && bottom === CLEAR) words.set([0x20, DEFAULT, DEFAULT], at)
      else if (top === CLEAR) words.set([LOWER_HALF, bottom, DEFAULT], at)
      else words.set([UPPER_HALF, top, bottom === CLEAR ? DEFAULT : bottom], at)
    }
  }
  return words
}

export type BarLook = {
  /** 0..1 for a known share of the plan done; null when there is no plan. */
  fraction: number | null
  frame: number
  isCooking: boolean
  hasErrors?: boolean
}

// The bar fills like the beef sears: from red to a glazed brown-gold.
const BAR_FROM: Rgb = [176, 70, 60]
const BAR_TO: Rgb = [236, 176, 70]
const TRACK = 0x3a3a40
const LINE = 0x2501
const HALF_LINE = 0x2578

/**
 * One row of cells: a thin bar that fills from red to gold. With no plan it
 * is a pulse sweeping the track while cooking, so it never claims a share it
 * does not know.
 */
export function barCells(columns: number, look: BarLook): Uint32Array {
  const words = new Uint32Array(columns * 3)
  const colourAt = (x: number) => pack(mix(BAR_FROM, BAR_TO, columns > 1 ? x / (columns - 1) : 1))
  const put = (x: number, code: number, fg: number) => words.set([code, fg, DEFAULT], x * 3)

  if (look.fraction === null) {
    const span = Math.max(3, Math.round(columns / 6))
    const travel = columns + span
    const head = look.isCooking ? (look.frame % travel) - span : -span - 1
    for (let x = 0; x < columns; x++) {
      const into = x - head
      const isLit = into >= 0 && into < span
      put(x, LINE, isLit ? pack(mix(BAR_FROM, BAR_TO, 1 - Math.abs(into - span / 2) / span)) : TRACK)
    }
    return words
  }

  const halves = Math.round(Math.max(0, Math.min(1, look.fraction)) * columns * 2)
  const shine = look.isCooking ? look.frame % Math.max(1, columns + 8) : -10
  for (let x = 0; x < columns; x++) {
    const filled = halves - x * 2
    let fg = colourAt(x)
    if (Math.abs(x - shine) <= 1 && filled > 0) fg = pack(mix(BAR_TO, [255, 250, 220], 0.7))
    if (look.hasErrors && filled > 0 && x === Math.floor((halves - 1) / 2)) fg = 0x5a8fe0
    if (filled >= 2) put(x, LINE, fg)
    else if (filled === 1) put(x, HALF_LINE, fg)
    else put(x, LINE, TRACK)
  }
  return words
}

/** Raster's `cells`: the words as little-endian bytes, base64. */
export function encodeCells(words: Uint32Array): string {
  // The runtime has Uint8Array#toBase64; lib es2023 does not declare it yet.
  const bytes = new Uint8Array(words.buffer, words.byteOffset, words.byteLength) as Uint8Array & { toBase64(): string }
  return bytes.toBase64()
}
