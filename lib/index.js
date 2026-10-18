import makeWASocket from './Socket/index.js';
export * from '../WAProto/index.js';
export * from './Utils/index.js';
export * from './Types/index.js';
export * from './Store/index.js';
export * from './Defaults/index.js';
export * from './WABinary/index.js';
export * from './WAM/index.js';
export * from './WAUSync/index.js';
export { makeWASocket };
export default makeWASocket;
//# sourceMappingURL=index.js.map
export * from './Voip/index.js';
// Pure-JS VoIP (no WASM). The audio codec inside loads lazily, only when a call starts.
export { default as CylicVoipJs } from './VoipJS/index.js';
export const loadVoipJS = () => import('./VoipJS/index.js');
