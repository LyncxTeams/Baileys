import { proto } from '../../WAProto'
import { GroupMetadata, ParticipantAction, SocketConfig, ContactAction, WAPrivacyValue, WAPrivacyOnlineValue, WAPrivacyCallValue, WAReadReceiptsValue, WAPrivacyGroupAddValue, WABusinessProfile, WAMessageStubType, MessageUpsertType, WAPresence, WAMediaUpload, USyncQuery, USyncQueryResult, USyncQueryResultList } from '../Types'
import { BinaryNode } from '../WABinary'
import { BaileysEventEmitter, AuthenticationCreds, SignalKeyStoreWithTransaction, SignalRepository, Contact, ChatModification, LabelActionBody } from '../Types'

export declare const makeGroupsSocket: (config: SocketConfig) => {
    groupQuery: (jid: string, type: string, content: BinaryNode) => Promise<BinaryNode>
    groupMetadata: (jid: string) => Promise<GroupMetadata>
    groupCreate: (subject: string, participants: string[]) => Promise<GroupMetadata>
    groupLeave: (id: string) => Promise<void>
    groupUpdateSubject: (jid: string, subject: string) => Promise<void>
    groupRequestParticipantsList: (jid: string) => Promise<{
        [key: string]: string
    }[]>
    groupRequestParticipantsUpdate: (jid: string, participants: string[], action: 'approve' | 'reject') => Promise<{
        status: string
        jid: string
    }[]>
    groupParticipantsUpdate: (jid: string, participants: string[], action: ParticipantAction) => Promise<{
        status: string
        jid: string
        content: BinaryNode
    }[]>
    groupUpdateDescription: (jid: string, description?: string) => Promise<void>
    groupInviteCode: (jid: string) => Promise<string | undefined>
    groupRevokeInvite: (jid: string) => Promise<string | undefined>
    groupAcceptInvite: (code: string) => Promise<string | undefined>
    groupRevokeInviteV4: (groupJid: string, invitedJid: string) => Promise<boolean>
    groupAcceptInviteV4: (key: string | proto.IMessageKey, inviteMessage: proto.Message.IGroupInviteMessage) => Promise<string>
    groupGetInviteInfo: (code: string) => Promise<GroupMetadata>
    groupToggleEphemeral: (jid: string, ephemeralExpiration: number) => Promise<void>
    groupSettingUpdate: (jid: string, setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked') => Promise<void>
    groupMemberAddMode: (jid: string, mode: 'admin_add' | 'all_member_add') => Promise<void>
    groupJoinApprovalMode: (jid: string, mode: 'on' | 'off') => Promise<void>
    groupFetchAllParticipating: () => Promise<{
        [_: string]: GroupMetadata
    }>
    processingMutex: {
        mutex<T>(code: () => T | Promise<T>): Promise<T>
    }
    fetchPrivacySettings: (force?: boolean) => Promise<{
        [_: string]: string
    }>
    upsertMessage: (msg: proto.IWebMessageInfo, type: MessageUpsertType) => Promise<void>
    appPatch: (patchCreate: WAPatchCreate) => Promise<void>
    sendPresenceUpdate: (type: WAPresence, toJid?: string) => Promise<void>
    presenceSubscribe: (toJid: string, tcToken?: Buffer) => Promise<void>
    getLidUser: (jid: string) => Promise<{
        lid: string
        id: string
    }[] | undefined>
    onWhatsApp: (...jids: string[]) => Promise<{
        jid: string
        exists: boolean
    }[] | undefined>
    fetchBlocklist: () => Promise<string[]>
    fetchStatus: (...jids: string[]) => Promise<USyncQueryResultList[] | undefined>
    fetchDisappearingDuration: (...jids: string[]) => Promise<USyncQueryResultList[] | undefined>
    updateProfilePicture: (jid: string, content: WAMediaUpload) => Promise<void>
    removeProfilePicture: (jid: string) => Promise<void>
    updateProfileStatus: (status: string) => Promise<void>
    updateProfileName: (name: string) => Promise<void>
    updateBlockStatus: (jid: string, action: "block" | "unblock") => Promise<void>
    updateCallPrivacy: (value: WAPrivacyCallValue) => Promise<void>
    updateLastSeenPrivacy: (value: WAPrivacyValue) => Promise<void>
    updateOnlinePrivacy: (value: WAPrivacyOnlineValue) => Promise<void>
    updateProfilePicturePrivacy: (value: WAPrivacyValue) => Promise<void>
    updateStatusPrivacy: (value: WAPrivacyValue) => Promise<void>
    updateReadReceiptsPrivacy: (value: WAReadReceiptsValue) => Promise<void>
    updateGroupsAddPrivacy: (value: WAPrivacyGroupAddValue) => Promise<void>
    updateDefaultDisappearingMode: (duration: number) => Promise<void>
    getBusinessProfile: (jid: string) => Promise<void | WABusinessProfile>
    resyncAppState: (collections: readonly ("critical_block" | "critical_unblock_low" | "regular_high" | "regular_low" | "regular")[], isInitialSync: boolean) => Promise<void>
    chatModify: (mod: ChatModification, jid: string) => Promise<void>
    cleanDirtyBits: (type: "account_sync" | "groups", fromTimestamp?: string | number) => Promise<void>
    addLabel: (jid: string, labels: LabelActionBody) => Promise<void>
    addChatLabel: (jid: string, labelId: string) => Promise<void>
    removeChatLabel: (jid: string, labelId: string) => Promise<void>
    addMessageLabel: (jid: string, messageId: string, labelId: string) => Promise<void>
    removeMessageLabel: (jid: string, messageId: string, labelId: string) => Promise<void>
    clearMessage: (jid: string, key: proto.IMessageKey, timeStamp: number | Long) => Promise<void>
    star: (jid: string, messages: {
        id: string
        fromMe?: boolean
    }[], star: boolean) => Promise<void>
    addOrEditContact: (jid: string, contact: ContactAction) => Promise<void>
    removeContact: (jid: string) => Promise<void>
    executeUSyncQuery: (usyncQuery: USyncQuery) => Promise<USyncQueryResult | undefined>
    
    // Socket properties
    type: "md"
    ws: any // WebSocketClient type would need to be imported/defined
    ev: BaileysEventEmitter & {
        process(handler: (events: Partial<BaileysEventMap>) => void | Promise<void>): () => void
        buffer(): void
        createBufferedFunction<A extends any[], T>(work: (...args: A) => Promise<T>): (...args: A) => Promise<T>
        flush(force?: boolean): boolean
        isBuffering(): boolean
    }
    authState: {
        creds: AuthenticationCreds
        keys: SignalKeyStoreWithTransaction
    }
    signalRepository: SignalRepository
    user: Contact | undefined
    generateMessageTag: () => string
    query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
    waitForMessage: <T>(msgId: string, timeoutMs?: number) => Promise<T>
    waitForSocketOpen: () => Promise<void>
    sendRawMessage: (data: Uint8Array | Buffer) => Promise<void>
    sendNode: (frame: BinaryNode) => Promise<void>
    logout: (msg?: string) => Promise<void>
    end: (error: Error | undefined) => void
    onUnexpectedError: (err: Error | Boom<any>, msg: string) => void
    uploadPreKeys: (count?: number) => Promise<void>
    uploadPreKeysToServerIfRequired: () => Promise<void>
    requestPairingCode: (phoneNumber: string, code?: string) => Promise<string>
    waitForConnectionUpdate: (check: (u: Partial<ConnectionState>) => boolean | undefined, timeoutMs?: number) => Promise<void>
    sendWAMBuffer: (wamBuffer: Buffer) => Promise<BinaryNode>
}

export declare const extractGroupMetadata: (result: BinaryNode) => GroupMetadata
