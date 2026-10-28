import { sswa, resetSSWA } from '@lyncxteams/baileys'

const handler = async (m, { conn, args, usedPrefix, command }) => {
  const sub = (args[0] || '').toLowerCase()

  try {
    if (sub === 'reset') {
      await resetSSWA()
      return m.reply(`Sesi WhatsApp Web berhasil direset.\nKetik *${usedPrefix}${command} login* untuk login kembali.`)
    }

    await m.reply('Tunggu sebentar...')
    const result = await sswa(conn, m, sub === 'home' ? 'home' : sub === 'login' ? 'login' : 'chat', { usedPrefix, command })

    if (result.message) return m.reply(result.message)
    return conn.sendMessage(m.chat, { image: result.image, caption: result.caption }, { quoted: m })
  } catch (error) {
    console.error('[sswa]', error)
    return m.reply('Gagal: ' + (error?.message || String(error)))
  }
}

handler.help = ['sswa', 'sswa home', 'sswa login', 'sswa reset']
handler.tags = ['owner']
handler.command = /^(sswa|sswaweb)$/i
handler.owner = true

export default handler
