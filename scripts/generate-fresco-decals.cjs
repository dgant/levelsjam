const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')

const outDir = path.resolve(__dirname, '..', 'public', 'textures', 'decals')
const size = 1024
const palette = {
  black: [42, 32, 26],
  blue: [54, 82, 122],
  cream: [196, 166, 116],
  gold: [184, 128, 49],
  red: [132, 54, 39],
  teal: [52, 112, 101],
  white: [218, 198, 157]
}

const scenes = [
  {
    file: 'minoan-labyrinth-toss.png',
    figures: [
      { x: 260, y: 570, color: palette.blue, pose: 'fall' },
      { x: 450, y: 500, color: palette.red, pose: 'arc' },
      { x: 650, y: 590, color: palette.teal, pose: 'stand' }
    ],
    maze: true,
    sun: false
  },
  {
    file: 'minoan-cowering-minotaur.png',
    figures: [
      { x: 300, y: 610, color: palette.blue, pose: 'cower' },
      { x: 470, y: 620, color: palette.gold, pose: 'cower' },
      { x: 680, y: 500, color: palette.red, pose: 'minotaur' }
    ],
    maze: true
  },
  {
    file: 'minoan-blue-flame-altar.png',
    figures: [
      { x: 360, y: 530, color: palette.teal, pose: 'hero' },
      { x: 570, y: 600, color: palette.gold, pose: 'altar' },
      { x: 700, y: 410, color: palette.blue, pose: 'torch' }
    ],
    bowl: true
  },
  {
    file: 'minoan-slaying-minotaur.png',
    figures: [
      { x: 370, y: 520, color: palette.blue, pose: 'sword' },
      { x: 640, y: 540, color: palette.red, pose: 'minotaur-fall' }
    ],
    maze: true
  },
  {
    file: 'minoan-wolf-hunt.png',
    figures: [
      { x: 330, y: 560, color: palette.teal, pose: 'run' },
      { x: 580, y: 600, color: palette.black, pose: 'wolf' },
      { x: 760, y: 570, color: palette.black, pose: 'wolf' }
    ],
    maze: false
  },
  {
    file: 'minoan-gated-minotaur.png',
    figures: [
      { x: 300, y: 560, color: palette.blue, pose: 'run' },
      { x: 640, y: 540, color: palette.red, pose: 'minotaur' }
    ],
    gate: true
  },
  {
    file: 'minoan-throne-skulls.png',
    figures: [
      { x: 520, y: 450, color: palette.gold, pose: 'throne' },
      { x: 350, y: 670, color: palette.teal, pose: 'court' },
      { x: 680, y: 670, color: palette.blue, pose: 'court' }
    ],
    skulls: true
  }
]

function setPixel(png, x, y, rgba) {
  if (x < 0 || x >= size || y < 0 || y >= size) {
    return
  }
  const index = ((Math.floor(y) * size) + Math.floor(x)) * 4
  png.data[index] = rgba[0]
  png.data[index + 1] = rgba[1]
  png.data[index + 2] = rgba[2]
  png.data[index + 3] = rgba[3]
}

function drawDisc(png, cx, cy, radius, color, alpha = 230) {
  const minX = Math.floor(cx - radius)
  const maxX = Math.ceil(cx + radius)
  const minY = Math.floor(cy - radius)
  const maxY = Math.ceil(cy + radius)
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x - cx, y - cy)
      if (distance <= radius) {
        setPixel(png, x, y, [...color, Math.round(alpha * (1 - Math.max(0, distance - radius + 2) / 2))])
      }
    }
  }
}

function drawLine(png, x0, y0, x1, y1, width, color, alpha = 230) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2))
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    drawDisc(
      png,
      x0 + ((x1 - x0) * t),
      y0 + ((y1 - y0) * t),
      width,
      color,
      alpha
    )
  }
}

function drawRect(png, x, y, width, height, color, alpha = 220) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(png, xx, yy, [...color, alpha])
    }
  }
}

function drawFigure(png, figure) {
  const { x, y, color, pose } = figure
  if (pose === 'minotaur' || pose === 'minotaur-fall') {
    drawDisc(png, x, y - 150, 46, palette.black)
    drawLine(png, x - 44, y - 172, x - 110, y - 210, 10, palette.black)
    drawLine(png, x + 44, y - 172, x + 110, y - 210, 10, palette.black)
    drawLine(png, x, y - 105, x, y + 25, 32, color)
    drawLine(png, x, y - 70, x - 78, y - 10, 16, color)
    drawLine(png, x, y - 70, x + 86, y - 20, 16, color)
    drawLine(png, x, y + 25, x - 58, y + 120, 18, color)
    drawLine(png, x, y + 25, x + 58, y + 118, 18, color)
    return
  }
  if (pose === 'wolf') {
    drawLine(png, x - 90, y, x + 75, y - 35, 34, color)
    drawDisc(png, x + 112, y - 58, 30, color)
    drawLine(png, x - 38, y + 6, x - 70, y + 78, 10, color)
    drawLine(png, x + 24, y - 8, x + 42, y + 68, 10, color)
    drawLine(png, x + 134, y - 64, x + 176, y - 82, 8, color)
    return
  }
  if (pose === 'altar') {
    drawRect(png, x - 95, y - 30, 190, 70, color, 210)
    drawDisc(png, x, y - 56, 58, palette.red)
    return
  }
  if (pose === 'torch') {
    drawLine(png, x, y - 110, x, y + 80, 9, palette.black)
    drawDisc(png, x, y - 130, 40, palette.blue, 220)
    return
  }
  if (pose === 'throne') {
    drawRect(png, x - 92, y - 40, 184, 220, palette.red, 205)
    drawDisc(png, x, y - 110, 34, palette.black)
    drawLine(png, x, y - 70, x, y + 45, 26, color)
    drawLine(png, x + 38, y - 64, x + 118, y - 160, 10, color)
    drawLine(png, x + 118, y - 160, x + 118, y - 230, 8, palette.white)
    return
  }
  const headY = y - 125
  drawDisc(png, x, headY, 30, palette.black)
  drawLine(png, x, y - 86, x, y + 20, 22, color)
  const armY = y - 48
  const legY = y + 20
  if (pose === 'cower') {
    drawLine(png, x, armY, x - 60, armY + 52, 12, color)
    drawLine(png, x, armY, x + 54, armY + 56, 12, color)
    drawLine(png, x, legY, x - 46, y + 82, 12, color)
    drawLine(png, x, legY, x + 48, y + 80, 12, color)
  } else if (pose === 'sword' || pose === 'hero') {
    drawLine(png, x, armY, x + 96, armY - 76, 12, color)
    drawLine(png, x + 96, armY - 76, x + 156, armY - 142, 5, palette.white)
    drawLine(png, x, armY, x - 62, armY + 18, 12, color)
    drawLine(png, x, legY, x - 38, y + 112, 12, color)
    drawLine(png, x, legY, x + 48, y + 104, 12, color)
  } else if (pose === 'fall' || pose === 'arc') {
    drawLine(png, x - 84, y - 78, x + 86, y + 30, 22, color)
    drawLine(png, x - 40, y - 50, x - 120, y - 118, 12, color)
    drawLine(png, x + 42, y + 5, x + 122, y + 74, 12, color)
  } else {
    drawLine(png, x, armY, x - 64, armY + 10, 12, color)
    drawLine(png, x, armY, x + 66, armY + 4, 12, color)
    drawLine(png, x, legY, x - 44, y + 112, 12, color)
    drawLine(png, x, legY, x + 44, y + 112, 12, color)
  }
}

function edgeAlpha(x, y) {
  const dx = Math.min(x, size - 1 - x)
  const dy = Math.min(y, size - 1 - y)
  const d = Math.min(dx, dy)
  const wave = 20 * Math.sin((x * 0.021) + (y * 0.017)) + 12 * Math.sin(y * 0.047)
  return Math.max(0, Math.min(1, (d + wave - 42) / 110))
}

function generate(scene) {
  const png = new PNG({ width: size, height: size })

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const grain = ((x * 13 + y * 17 + ((x ^ y) * 7)) % 31) - 15
      const alpha = Math.round(205 * edgeAlpha(x, y))
      setPixel(png, x, y, [
        Math.max(0, Math.min(255, palette.cream[0] + grain)),
        Math.max(0, Math.min(255, palette.cream[1] + grain)),
        Math.max(0, Math.min(255, palette.cream[2] + grain)),
        alpha
      ])
    }
  }

  if (scene.maze) {
    for (let i = 0; i < 5; i += 1) {
      const x = 180 + (i * 150)
      drawLine(png, x, 300, x + 70, 240, 12, palette.red, 160)
      drawLine(png, x + 70, 240, x + 135, 310, 12, palette.blue, 150)
    }
  }
  if (scene.gate) {
    for (let x = 515; x <= 740; x += 45) {
      drawLine(png, x, 250, x, 760, 8, palette.black, 210)
    }
    for (let y = 310; y <= 700; y += 90) {
      drawLine(png, 500, y, 760, y, 8, palette.black, 210)
    }
  }
  if (scene.bowl) {
    drawLine(png, 475, 515, 690, 515, 16, palette.black, 185)
    drawDisc(png, 585, 525, 88, palette.red, 140)
  }
  if (scene.skulls) {
    for (let i = 0; i < 7; i += 1) {
      drawDisc(png, 340 + (i * 58), 790 + ((i % 2) * 24), 24, palette.white, 190)
    }
  }

  for (const figure of scene.figures) {
    drawFigure(png, figure)
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const chip = Math.sin(x * 0.091) + Math.sin(y * 0.073) + Math.sin((x + y) * 0.037)
      if (chip > 2.42 || ((x * 101 + y * 37) % 997) < 5) {
        const index = ((y * size) + x) * 4
        png.data[index + 3] = Math.floor(png.data[index + 3] * 0.2)
      }
    }
  }

  return png
}

fs.mkdirSync(outDir, { recursive: true })
for (const scene of scenes) {
  fs.writeFileSync(path.join(outDir, scene.file), PNG.sync.write(generate(scene)))
}
