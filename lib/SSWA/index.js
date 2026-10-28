import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer'

const PROFILE_DIR = resolve(process.env.WWEB_PROFILE || './sessions-wweb')
const IDLE_MS = Number(process.env.WWEB_IDLE_MS || 180000)
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let session = null
let launching = null
let idleTimer = null
let queue = Promise.resolve()
const exclusive = fn => {
  const task = queue.then(fn, fn)
  queue = task.catch(() => {})
  return task
}

async function close() {
  clearTimeout(idleTimer)
  idleTimer = null
  const current = session
  session = null
  if (current?.browser) await current.browser.close().catch(() => {})
}

function scheduleClose() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => exclusive(close).catch(() => {}), IDLE_MS)
  idleTimer.unref?.()
}

async function getSession() {
  clearTimeout(idleTimer)
  if (session?.browser?.connected && session?.page && !session.page.isClosed()) return session
  if (launching) return launching
  launching = (async () => {
    await close()
    mkdirSync(PROFILE_DIR, { recursive: true })
    const browser = await puppeteer.launch({
      headless: true,
      userDataDir: PROFILE_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--lang=id-ID']
    })
    try {
      const page = await browser.newPage()
      await page.setUserAgent(UA)
      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
      page.setDefaultTimeout(15000)
      page.setDefaultNavigationTimeout(60000)
      await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
      session = { browser, page }
      browser.on('disconnected', () => { if (session?.browser === browser) session = null })
      return session
    } catch (error) {
      await browser.close().catch(() => {})
      throw error
    }
  })()
  try {
    return await launching
  } finally {
    launching = null
  }
}

async function state(page, timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await page.evaluate(() => {
      if (document.querySelector('#pane-side, #side, [data-testid="chat-list"]')) return 'ready'
      if (document.querySelector('[data-testid="qrcode"], div[data-ref] canvas, canvas[aria-label*="QR"]')) return 'qr'
      return 'loading'
    }).catch(() => 'loading')
    if (value !== 'loading') return value
    await sleep(500)
  }
  return 'timeout'
}

async function qrBuffer(page) {
  for (const selector of ['[data-testid="qrcode"]', 'div[data-ref]', 'canvas[aria-label*="QR"]', 'canvas']) {
    const el = await page.$(selector).catch(() => null)
    if (el) {
      try { return Buffer.from(await el.screenshot({ type: 'png' })) } catch {}
    }
  }
  return Buffer.from(await page.screenshot({ type: 'png' }))
}

async function ensureLogin(conn, m, page, prefix, command) {
  let current = await state(page)
  if (current === 'timeout') throw new Error('WhatsApp Web gagal dimuat. Periksa koneksi VPS.')
  if (current === 'qr') {
    await conn.sendMessage(m.chat, { image: await qrBuffer(page), caption: 'Scan QR melalui WhatsApp > Perangkat tertaut > Tautkan perangkat.' }, { quoted: m })
    const start = Date.now()
    while (Date.now() - start < 90000) {
      current = await state(page, 2000)
      if (current === 'ready') break
      await sleep(1000)
    }
    if (current !== 'ready') throw new Error(`QR belum dipindai atau kedaluwarsa. Ketik ${prefix}${command} login untuk mencoba lagi.`)
    await sleep(1500)
  }
  return current
}

async function chatName(conn, id) {
  if (id.endsWith('@g.us')) {
    const cached = conn.chats?.[id]?.subject
    if (cached) return cached
    const metadata = await conn.groupMetadata(id).catch(() => ({}))
    return metadata.subject || id.split('@')[0]
  }
  return await conn.getName(id) || id.split('@')[0]
}

async function findChat(page, terms) {
  return page.evaluate(terms => {
    const norm = value => (value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
    const digits = value => (value || '').replace(/\D/g, '')
    const els = [...document.querySelectorAll('#pane-side [title], #side [title], [data-testid="cell-frame-container"] [title]')]
    for (const term of terms) {
      const n = norm(term), d = digits(term)
      if (!n) continue
      const hit = els.find(e => norm(e.getAttribute('title')) === n) ||
        (d.length >= 8 ? els.find(e => digits(e.getAttribute('title')).includes(d)) : null) ||
        els.find(e => norm(e.getAttribute('title')).includes(n))
      if (!hit) continue
      const row = hit.closest('[role="listitem"], [role="row"], [data-testid="cell-frame-container"]') || hit
      const r = row.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }
    return null
  }, terms)
}

async function openChat(page, terms) {
  let rect = await findChat(page, terms)
  if (!rect) {
    const selectors = ['#side div[contenteditable="true"][role="textbox"]', '#side div[contenteditable="true"]', '[data-testid="chat-list-search"]', 'div[contenteditable="true"][data-tab="3"]', 'div[aria-label*="Search"][contenteditable="true"]', 'div[aria-label*="Telusuri"][contenteditable="true"]']
    let box = null
    for (const selector of selectors) {
      box = await page.$(selector).catch(() => null)
      if (box) break
    }
    if (!box) throw new Error('Kolom pencarian WhatsApp Web tidak ditemukan')
    for (const term of terms.filter(Boolean)) {
      await box.click()
      await page.keyboard.press('Control+A')
      await page.keyboard.press('Backspace')
      await page.keyboard.type(term, { delay: 30 })
      for (let i = 0; i < 15 && !rect; i++) {
        await sleep(400)
        rect = await findChat(page, [term])
      }
      if (rect) break
    }
  }
  if (!rect) throw new Error('Chat tidak ditemukan. Pastikan chat tersedia di WhatsApp Web.')
  await page.mouse.click(rect.x, rect.y)
  await page.waitForFunction(() => Boolean(document.querySelector('#main') || document.querySelector('[data-testid="conversation-panel-wrapper"]')), { timeout: 15000 })
  await sleep(800)
}

async function scrollLatest(page) {
  await page.waitForSelector('#main', { timeout: 15000 })
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      const main = document.querySelector('#main')
      if (!main) return
      const candidates = [...main.querySelectorAll('*')].filter(el => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && el.scrollHeight > el.clientHeight + 20 && ['auto', 'scroll'].includes(s.overflowY)
      }).sort((a, b) => b.scrollHeight - a.scrollHeight)
      for (const el of candidates) {
        el.scrollTop = el.scrollHeight
        el.dispatchEvent(new Event('scroll', { bubbles: true }))
      }
    })
    await sleep(300)
  }
  await sleep(500)
}

export async function sswa(conn, m, action = 'chat', options = {}) {
  return exclusive(async () => {
    const s = await getSession()
    const page = s.page
    try {
      const current = await ensureLogin(conn, m, page, options.usedPrefix || '.', options.command || 'sswa')
      if (action === 'login') return { message: current === 'ready' ? 'Login WhatsApp Web berhasil. Sesi tersimpan.' : 'WhatsApp Web sudah login.' }
      if (action === 'home') {
        await page.waitForSelector('#pane-side, #side', { timeout: 15000 })
        const el = await page.$('#app')
        return { image: Buffer.from(await (el || page).screenshot({ type: 'png' })), caption: 'Screenshot beranda WhatsApp Web' }
      }
      const name = await chatName(conn, m.chat)
      const number = m.chat.split('@')[0]
      await openChat(page, [...new Set([name, number].filter(Boolean))])
      await scrollLatest(page)
      const main = await page.$('#main') || await page.$('[data-testid="conversation-panel-wrapper"]')
      if (!main) throw new Error('Panel percakapan tidak ditemukan')
      return { image: Buffer.from(await main.screenshot({ type: 'png' })), caption: 'Screenshot live dari web.whatsapp.com' }
    } finally {
      scheduleClose()
    }
  })
}

export async function resetSSWA() {
  return exclusive(async () => {
    await close()
    rmSync(PROFILE_DIR, { recursive: true, force: true })
    return true
  })
}
