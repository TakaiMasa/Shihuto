/**
 * PWA アイコン生成スクリプト
 * Node.js 組み込みの zlib を使って PNG を生成する（追加パッケージ不要）
 *
 * デザイン: 濃紺背景 (#1e293b) + 白いラーメンどんぶりアイコン
 */

import { createWriteStream, mkdirSync } from 'fs'
import { deflateSync, crc32 } from 'zlib'
import { join } from 'path'

// ─── PNG ビルダ ──────────────────────────────────────────
function buildPng(width, height, pixelFn) {
  // pixelFn(x, y) → [r, g, b, a]
  const channels = 4
  // フィルタバイト (0 = None) を各行先頭に挿入した生データ
  const raw = Buffer.alloc(height * (1 + width * channels))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * channels)] = 0 // filter = None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height)
      const offset = y * (1 + width * channels) + 1 + x * channels
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
      raw[offset + 3] = a
    }
  }

  const compressed = deflateSync(raw)

  const chunks = []

  // PNG シグネチャ
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  // IHDR
  chunks.push(makeChunk('IHDR', (() => {
    const b = Buffer.alloc(13)
    b.writeUInt32BE(width, 0)
    b.writeUInt32BE(height, 4)
    b[8] = 8  // bit depth
    b[9] = 6  // color type: RGBA
    b[10] = 0 // compression
    b[11] = 0 // filter
    b[12] = 0 // interlace
    return b
  })()))

  // IDAT
  chunks.push(makeChunk('IDAT', compressed))

  // IEND
  chunks.push(makeChunk('IEND', Buffer.alloc(0)))

  return Buffer.concat(chunks)
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBytes = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBytes, data])
  const crcValue = crc32(crcInput) >>> 0  // unsigned 32-bit
  const crcBytes = Buffer.alloc(4)
  crcBytes.writeUInt32BE(crcValue, 0)
  return Buffer.concat([len, typeBytes, data, crcBytes])
}

// ─── ピクセル描画 ────────────────────────────────────────
// 背景色 (#1e293b)
const BG = [0x1e, 0x29, 0x3b, 255]
// 白
const WHITE = [255, 255, 255, 255]
const TRANS = [0, 0, 0, 0]

/**
 * ラーメンどんぶりを描画するピクセル関数
 * - 外周に角丸正方形の背景
 * - 中央にシンプルな丼シルエット（楕円 + 台形）
 */
function ramenPixel(x, y, w, h) {
  const cx = w / 2
  const cy = h / 2
  const size = Math.min(w, h)

  // 正規化座標 (-1 〜 1)
  const nx = (x - cx) / (size / 2)
  const ny = (y - cy) / (size / 2)

  // 角丸正方形マスク (背景)
  const r = 0.75
  const corner = 0.18
  function inRoundedRect(px, py) {
    const qx = Math.abs(px) - r + corner
    const qy = Math.abs(py) - r + corner
    return Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - corner
  }

  const bgSdf = inRoundedRect(nx, ny)
  if (bgSdf > 0.02) return TRANS // 背景の外

  // ─── どんぶりアイコン（白） ───
  // スープ面: 上半楕円
  const bowlCY = -0.05
  const soupRx = 0.48
  const soupRy = 0.28
  const soupD = (nx / soupRx) ** 2 + ((ny - bowlCY) / soupRy) ** 2

  // 丼本体: 下半台形（楕円でシミュレート）
  const bodyRx = 0.44
  const bodyRyTop = 0.25
  const bodyRyBot = 0.20
  const bodyBottom = 0.46

  // 上縁の楕円
  const inBowlTop = (nx / soupRx) ** 2 + ((ny - bowlCY) / soupRy) ** 2 <= 1

  // 台形 body: y が bowlCY 〜 bodyBottom の間
  const ty = ny - bowlCY
  const fracY = ty / (bodyBottom - bowlCY)
  const bodyRxAtY = soupRx - (soupRx - 0.28) * fracY
  const inBody = fracY >= 0 && fracY <= 1 && Math.abs(nx) <= bodyRxAtY

  // 縁 (高台): 最下部の長方形
  const inBase = ny > 0.38 && ny < 0.50 && Math.abs(nx) < 0.18

  // 湯気 (3本の波線)
  function steamLine(offsetX) {
    const sx = nx - offsetX
    const steamY = ny + 0.45
    const wave = Math.sin(sx * 14) * 0.04
    const dist = Math.abs((steamY + wave) - 0)
    return steamY > -0.62 && steamY < -0.28 && dist < 0.04 && Math.abs(sx) < 0.06
  }
  const inSteam = steamLine(-0.18) || steamLine(0) || steamLine(0.18)

  // 麺 (スープの中の線)
  const inNoodle1 = Math.abs(nx * 1.6 + Math.sin(ny * 10) * 0.08) < 0.04 &&
                    ny > bowlCY - 0.08 && ny < bowlCY + 0.16 &&
                    Math.abs(nx) < soupRx * 0.8
  const inNoodle2 = Math.abs(nx * 1.2 - 0.1 + Math.sin(ny * 8 + 1) * 0.06) < 0.04 &&
                    ny > bowlCY - 0.05 && ny < bowlCY + 0.16 &&
                    Math.abs(nx) < soupRx * 0.75

  // スープ楕円の上半分 + 本体 + 縁 を白で塗る
  if (inSteam || inBowlTop || inBody || inBase) return WHITE

  return BG
}

/**
 * マスカブルアイコン用ピクセル関数
 * セーフゾーン 80%（全体の10%が余白）
 */
function maskablePixel(x, y, w, h) {
  const cx = w / 2
  const cy = h / 2
  const size = Math.min(w, h)

  // 全体を背景色で塗る
  const nx = (x - cx) / (size / 2)
  const ny = (y - cy) / (size / 2)

  // セーフゾーン 80% 内だけアイコン描画
  const scale = 0.8
  const sx = nx / scale
  const sy = ny / scale

  const bgSdf = Math.max(Math.abs(sx), Math.abs(sy)) - 0.75
  if (bgSdf > 0) return BG // セーフゾーン外は背景のみ

  return ramenPixel(
    (sx + 1) / 2 * w,
    (sy + 1) / 2 * h,
    w,
    h,
  )
}

// ─── 生成 ────────────────────────────────────────────────

// process.cwd() = プロジェクトルート (スクリプトは scripts/ から実行)
const PROJECT_ROOT = process.cwd()

const iconsDir = join(PROJECT_ROOT, 'public', 'icons')
mkdirSync(iconsDir, { recursive: true })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  const png = buildPng(size, size, ramenPixel)
  const filePath = join(PROJECT_ROOT, 'public', 'icons', `icon-${size}x${size}.png`)
  createWriteStream(filePath).write(png)
  console.log(`Generated: ${filePath}`)
}

// maskable icons
for (const size of [192, 512]) {
  const png = buildPng(size, size, maskablePixel)
  const filePath = join(PROJECT_ROOT, 'public', `icon-maskable-${size}x${size}.png`)
  createWriteStream(filePath).write(png)
  console.log(`Generated: ${filePath}`)
}

console.log('All icons generated!')
