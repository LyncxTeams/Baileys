/*
 * WhatsApp Web screenshot helper (conn.wweb).
 * Puppeteer TIDAK menjadi dependency Baileys. Dicari di project bot (process.cwd()),
 * atau disuntik lewat config { puppeteer } / conn.wweb.usePuppeteer(pkg).
 */
import { existsSync, mkdirSync, rmSync } from 'fs'
import { createRequire } from 'module'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const SEARCH_SEL = [
    '#side div[contenteditable="true"][role="textbox"]',
    '#side div[contenteditable="true"]',
    '[data-testid="chat-list-search"]',
    'div[contenteditable="true"][data-tab="3"]',
    'div[aria-label*="Search"][contenteditable="true"]',
    'div[aria-label*="Telusuri"][contenteditable="true"]'
]

export function makeWWeb(sock, config = {}) {
    const PROFILE_DIR = resolve(config.wwebProfile || process.env.WWEB_PROFILE || './sessions-wweb')
    const IDLE_MS = Number(config.wwebIdleMs || process.env.WWEB_IDLE_MS || 3 * 60 * 1000)
    const CHROME_PATHS = [
        config.chromePath,
        process.env.CHROME_PATH,
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome'
    ].filter(Boolean)

    let puppeteerPkg = config.puppeteer || null
    let shared = null
    let idleTimer = null
    let launching = null
    let queue = Promise.resolve()

    const exclusive = fn => {
        const task = queue.then(fn, fn)
        queue = task.catch(() => {})
        return task
    }

    const loadPuppeteer = async () => {
        if (puppeteerPkg) return puppeteerPkg.default || puppeteerPkg
        const req = createRequire(resolve(process.cwd(), 'noop.js'))
        for (const name of ['puppeteer', 'puppeteer-core']) {
            try {
                const mod = await import(pathToFileURL(req.resolve(name)).href)
                puppeteerPkg = mod.default || mod
                return puppeteerPkg
            } catch {}
            try {
                const mod = await import(name)
                puppeteerPkg = mod.default || mod
                return puppeteerPkg
            } catch {}
        }
        throw new Error('Puppeteer belum terpasang di project bot. Jalankan npm install puppeteer')
    }

    const isAlive = async s => {
        if (!s?.browser || !s?.page) return false
        try {
            if (s.page.isClosed()) return false
            await s.browser.pages()
            return true
        } catch {
            return false
        }
    }

    const launch = async () => {
        const puppeteer = await loadPuppeteer()
        mkdirSync(PROFILE_DIR, { recursive: true })
        const executablePath = CHROME_PATHS.find(p => existsSync(p))
        const browser = await puppeteer.launch({
            headless: true,
            userDataDir: PROFILE_DIR,
            ...(executablePath ? { executablePath } : {}),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--lang=id-ID']
        })
        try {
            const page = await browser.newPage()
            await page.setUserAgent(UA)
            await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
            page.setDefaultTimeout(15000)
            page.setDefaultNavigationTimeout(60000)
            await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
            const session = { browser, page }
            browser.on('disconnected', () => { if (shared === session) shared = null })
            return session
        } catch (error) {
            await browser.close().catch(() => {})
            throw error
        }
    }

    const getSession = async () => {
        clearTimeout(idleTimer)
        idleTimer = null
        if (await isAlive(shared)) return shared
        if (launching) return launching
        launching = (async () => {
            const previous = shared
            shared = null
            if (previous?.browser) await previous.browser.close().catch(() => {})
            try {
                shared = await launch()
                return shared
            } catch (error) {
                shared = null
                if (/browser is already running|userDataDir/i.test(error.message || '')) {
                    throw new Error('Chromium masih mengunci sessions-wweb. Restart proses bot sepenuhnya, lalu coba lagi.')
                }
                throw error
            } finally {
                launching = null
            }
        })()
        return launching
    }

    const closeSession = async () => {
        clearTimeout(idleTimer)
        idleTimer = null
        const s = shared
        shared = null
        if (s?.browser) await s.browser.close().catch(() => {})
    }

    const scheduleClose = () => {
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => { exclusive(() => closeSession()).catch(() => {}) }, IDLE_MS)
        idleTimer.unref?.()
    }

    const waitState = async (page, timeout = 60000) => {
        const start = Date.now()
        while (Date.now() - start < timeout) {
            const state = await page.evaluate(() => {
                const qr = document.querySelector('[data-testid="qrcode"], div[data-ref] canvas, canvas[aria-label*="QR"]')
                const loggedIn = document.querySelector('#pane-side, #side, [data-testid="chat-list"]')
                if (loggedIn) return 'ready'
                if (qr) return 'qr'
                return 'loading'
            }).catch(() => 'loading')
            if (state !== 'loading') return state
            await sleep(500)
        }
        return 'timeout'
    }

    const shotQr = async page => {
        for (const selector of ['[data-testid="qrcode"]', 'div[data-ref]', 'canvas[aria-label*="QR"]', 'canvas']) {
            const el = await page.$(selector).catch(() => null)
            if (el) {
                try { return Buffer.from(await el.screenshot({ type: 'png' })) } catch {}
            }
        }
        return Buffer.from(await page.screenshot({ type: 'png' }))
    }

    const findChatRect = (page, needles) => page.evaluate(needles => {
        const norm = v => (v || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
        const digits = v => (v || '').replace(/\D/g, '')
        const elements = [...document.querySelectorAll('#pane-side [title], #side [title], [data-testid="cell-frame-container"] [title]')]
        for (const needle of needles) {
            const normalized = norm(needle)
            const number = digits(needle)
            if (!normalized) continue
            const hit =
                elements.find(e => norm(e.getAttribute('title')) === normalized) ||
                (number.length >= 8 ? elements.find(e => digits(e.getAttribute('title')).includes(number)) : null) ||
                elements.find(e => norm(e.getAttribute('title')).includes(normalized))
            if (!hit) continue
            const row = hit.closest('[role="listitem"], [role="row"], [data-testid="cell-frame-container"]') || hit
            const rect = row.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        }
        return null
    }, needles)

    const openChat = async (page, needles) => {
        let rect = await findChatRect(page, needles)
        if (!rect) {
            let searchBox = null
            for (const selector of SEARCH_SEL) {
                searchBox = await page.$(selector).catch(() => null)
                if (searchBox) break
            }
            if (!searchBox) throw new Error('Kolom pencarian WhatsApp Web tidak ditemukan')
            for (const term of needles.filter(Boolean)) {
                await searchBox.click()
                await page.keyboard.press('Control+A')
                await page.keyboard.press('Backspace')
                await page.keyboard.type(term, { delay: 35 })
                for (let i = 0; i < 15 && !rect; i++) {
                    await sleep(400)
                    rect = await findChatRect(page, [term])
                }
                if (rect) break
            }
        }
        if (!rect) throw new Error('Chat tidak ditemukan. Pastikan chat tersedia di WhatsApp Web')
        await page.mouse.click(rect.x, rect.y)
        await page.waitForFunction(() => Boolean(document.querySelector('#main') || document.querySelector('[data-testid="conversation-panel-wrapper"]')), { timeout: 15000 })
        await sleep(1200)
    }

    const scrollLatest = async page => {
        await page.waitForSelector('#main', { timeout: 15000 })
        await sleep(500)
        for (let i = 0; i < 8; i++) {
            await page.evaluate(() => {
                const main = document.querySelector('#main')
                if (!main) return
                const scrollable = el => {
                    const style = getComputedStyle(el)
                    return el.scrollHeight > el.clientHeight + 20 && ['auto', 'scroll'].includes(style.overflowY)
                }
                let target = null
                for (const selector of ['[data-testid="conversation-panel-messages"]', '.copyable-area', '[data-tab="8"]']) {
                    target = [...main.querySelectorAll(selector)].find(scrollable)
                    if (target) break
                }
                if (!target) {
                    target = [...main.querySelectorAll('*')]
                        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && scrollable(el) })
                        .sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
                }
                if (target) {
                    target.scrollTop = target.scrollHeight
                    target.dispatchEvent(new Event('scroll', { bubbles: true }))
                }
                const messages = main.querySelector('[data-testid="conversation-panel-messages"]')
                if (messages) messages.scrollTop = messages.scrollHeight
            })
            await sleep(350)
        }
        await page.evaluate(() => {
            const main = document.querySelector('#main')
            if (!main) return
            for (const el of [...main.querySelectorAll('*')]) {
                const style = getComputedStyle(el)
                const rect = el.getBoundingClientRect()
                if (!(rect.width > 0 && rect.height > 0 && el.scrollHeight > el.clientHeight + 20 && ['auto', 'scroll'].includes(style.overflowY))) continue
                const gap = el.scrollHeight - el.clientHeight - el.scrollTop
                if (gap > 0 && gap < 10000) el.scrollTop = el.scrollHeight
            }
        })
        await sleep(700)
    }

    const getChatName = async (chatId, name) => {
        if (name) return name
        if (chatId.endsWith('@g.us')) {
            const meta = await sock.groupMetadata(chatId).catch(() => ({}))
            return meta.subject || chatId.split('@')[0]
        }
        return chatId.split('@')[0]
    }

    // ---- API tingkat rendah (mengembalikan Buffer / status) ----

    /** Pastikan login. onQr(buffer) dipanggil saat butuh scan. Return "ready" | "already". */
    const ensureLogin = async (page, onQr, qrTimeoutMs = 90000) => {
        let state = await waitState(page)
        if (state === 'timeout') throw new Error('WhatsApp Web gagal dimuat. Periksa koneksi VPS.')
        if (state === 'ready') return 'already'
        if (onQr) await onQr(await shotQr(page))
        const start = Date.now()
        while (Date.now() - start < qrTimeoutMs) {
            state = await waitState(page, 2000)
            if (state === 'ready') break
            await sleep(1000)
        }
        if (state !== 'ready') throw new Error('QR belum berhasil dipindai atau sudah kedaluwarsa.')
        await sleep(2000)
        return 'ready'
    }

    const screenshotHome = async ({ onQr } = {}) => exclusive(async () => {
        try {
            const { page } = await getSession()
            await ensureLogin(page, onQr)
            await page.waitForSelector('#pane-side, #side', { timeout: 15000 })
            await sleep(1000)
            const home = await page.$('#app')
            return Buffer.from(await (home || page).screenshot({ type: 'png' }))
        } catch (e) {
            await closeSession()
            throw e
        } finally {
            scheduleClose()
        }
    })

    const screenshotChat = async (chatId, { name, onQr } = {}) => exclusive(async () => {
        try {
            const { page } = await getSession()
            await ensureLogin(page, onQr)
            const chatName = await getChatName(chatId, name)
            const needles = [...new Set([chatName, chatId.split('@')[0]].filter(Boolean))]
            await openChat(page, needles)
            await scrollLatest(page)
            const main = (await page.$('#main')) || (await page.$('[data-testid="conversation-panel-wrapper"]'))
            if (!main) throw new Error('Panel percakapan tidak ditemukan')
            return Buffer.from(await main.screenshot({ type: 'png' }))
        } catch (e) {
            await closeSession()
            throw e
        } finally {
            scheduleClose()
        }
    })

    const login = async ({ onQr } = {}) => exclusive(async () => {
        try {
            const { page } = await getSession()
            return await ensureLogin(page, onQr)
        } catch (e) {
            await closeSession()
            throw e
        } finally {
            scheduleClose()
        }
    })

    const reset = async () => exclusive(async () => {
        await closeSession()
        rmSync(PROFILE_DIR, { recursive: true, force: true })
    })

    // ---- API tingkat tinggi: satu panggilan dari plugin ----

    /**
     * conn.wweb.run(m, { mode, usedPrefix, command, name })
     * mode: "chat" (default) | "home" | "login" | "reset"
     * Semua balasan (QR, screenshot, pesan error) dikirim otomatis ke m.chat.
     */
    const run = async (m, { mode = 'chat', usedPrefix = '.', command = 'sswa', name } = {}) => {
        const jid = m.chat
        const say = text => sock.sendMessage(jid, { text }, { quoted: m })
        const sendImg = (image, caption) => sock.sendMessage(jid, { image, caption }, { quoted: m })
        const onQr = buf => sendImg(buf, 'Scan QR melalui WhatsApp > Perangkat tertaut > Tautkan perangkat.')
        mode = String(mode || 'chat').toLowerCase()
        try {
            if (mode === 'reset') {
                await reset()
                return say(`Sesi WhatsApp Web berhasil direset.\nKetik *${usedPrefix + command} login* untuk login kembali.`)
            }
            await say('Tunggu sebentar...')
            if (mode === 'login') {
                const r = await login({ onQr })
                return say(r === 'already' ? 'WhatsApp Web sudah login.' : 'Login WhatsApp Web berhasil. Sesi tersimpan.')
            }
            if (mode === 'home') return sendImg(await screenshotHome({ onQr }), 'Screenshot beranda WhatsApp Web')
            return sendImg(await screenshotChat(jid, { name, onQr }), 'Screenshot live dari web.whatsapp.com')
        } catch (error) {
            sock.logger?.error?.({ err: error }, '[wweb]')
            const msg = error?.message || String(error)
            return say('Gagal: ' + msg + (/QR belum/.test(msg) ? `\nKetik ${usedPrefix + command} login untuk mencoba kembali.` : ''))
        }
    }

    sock.wweb = {
        run,
        screenshotChat,
        screenshotHome,
        login,
        reset,
        close: () => exclusive(() => closeSession()),
        usePuppeteer: pkg => { puppeteerPkg = pkg; return sock.wweb },
        profileDir: PROFILE_DIR
    }
    return sock
}

export default makeWWeb
