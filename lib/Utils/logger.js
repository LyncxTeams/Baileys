/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
import P from 'pino';
export default P({ timestamp: () => `,"time":"${new Date().toJSON()}"` });
