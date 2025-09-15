"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const WABinary_1 = require("../WABinary")

class LIDMappingStore {
	constructor(keys, onWhatsAppFunc, logger) {
		this.keys = keys
		this.logger = logger
		this.onWhatsAppFunc = onWhatsAppFunc // needed to get LID from PN if not found
	}
	/**
     * Store LID-PN mapping - USER LEVEL
     */
    async storeLIDPNMapping(lid, pn) {
        return this.storeLIDPNMappings([{ lid, pn }]);
    }
	/**
     * Store LID-PN mapping - USER LEVEL
     */
    async storeLIDPNMappings(pairs) {
        // Validate inputs
        const pairMap = {}
        for (const { lid, pn } of pairs) {
            if (!((WABinary_1.isLidUser(lid) && WABinary_1.isJidUser(pn)) || (WABinary_1.isJidUser(lid) && WABinary_1.isLidUser(pn)))) {
                this.logger.warn(`Invalid LID-PN mapping: ${lid}, ${pn}`)
                continue
            }
            
            const [lidJid, pnJid] = WABinary_1.isLidUser(lid) ? [lid, pn] : [pn, lid]
            const lidDecoded = WABinary_1.jidDecode(lidJid)
            const pnDecoded = WABinary_1.jidDecode(pnJid)
            
            if (!lidDecoded || !pnDecoded)
                return
                
            const pnUser = pnDecoded.user
            const lidUser = lidDecoded.user
            pairMap[pnUser] = lidUser
        }
        this.logger.trace({ pairMap }, `Storing ${Object.keys(pairMap).length} pn mappings`)
        await this.keys.transaction(async () => {
            for (const [pnUser, lidUser] of Object.entries(pairMap)) {
                await this.keys.set({
                    'lid-mapping': {
                        [pnUser]: lidUser, // "554396160286" -> "102765716062358"
                        [`${lidUser}_reverse`]: pnUser // "102765716062358_reverse" -> "554396160286"
                    }
                })
            }
        }, 'lid-mapping')
    }
    /**
     * Get LID for PN - Returns device-specific LID based on user mapping
     */
    async getLIDForPN(pn) {
        if (!WABinary_1.isJidUser(pn))
            return null
            
        const decoded = WABinary_1.jidDecode(pn)
        if (!decoded)
            return null
            
        // Look up user-level mapping (whatsmeow approach)
        const pnUser = decoded.user
        const stored = await this.keys.get('lid-mapping', [pnUser])
        let lidUser = stored[pnUser]
        
        if (!lidUser) {
            this.logger.trace(`No LID mapping found for PN user ${pnUser}; getting from USync`)
            const { exists, lid } = (await this.onWhatsAppFunc?.(pn))?.[0]
            if (exists) {
                lidUser = WABinary_1.jidDecode(lid)?.user
            }
            else {
                return null
            }
        }
        
        if (typeof lidUser !== 'string')
            return null
            
        // Push the PN device ID to the LID to maintain device separation
        const pnDevice = decoded.device !== undefined ? decoded.device : 0
        const deviceSpecificLid = `${lidUser}:${pnDevice}@lid`
        this.logger.trace(`getLIDForPN: ${pn} → ${deviceSpecificLid} (user mapping with device ${pnDevice})`)
        return deviceSpecificLid
    }
    /**
     * Get PN for LID - USER LEVEL with device construction
     */
     async getPNForLID(lid) {
     	if (!WABinary_1.isLidUser(lid)) return null
     
        const decoded = WABinary_1.jidDecode(lid)
        
        if (!decoded) return null
        
        // Look up reverse user mapping
        const lidUser = decoded.user
        const stored = await this.keys.get('lid-mapping', [`${lidUser}_reverse`])
        const pnUser = stored[`${lidUser}_reverse`]
        
        if (!pnUser || typeof pnUser !== 'string') {
            this.logger.trace(`No reverse mapping found for LID user: ${lidUser}`)
            return null
        }
        
        // Construct device-specific PN JID
        const lidDevice = decoded.device !== undefined ? decoded.device : 0
        const pnJid = `${pnUser}:${lidDevice}@s.whatsapp.net`
        this.logger.trace(`Found reverse mapping: ${lid} → ${pnJid}`)
        return pnJid
    }
}

module.exports = {
  LIDMappingStore
}