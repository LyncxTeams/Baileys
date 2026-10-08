export type WACallStatus =
  | 'offer'
  | 'preaccept'
  | 'transport'
  | 'relaylatency'
  | 'accept'
  | 'reject'
  | 'terminate'
  | 'timeout'
  | 'ringing'

export interface WACall {
  chatId: string
  from?: string
  callerPn?: string
  id: string
  date: Date
  offline?: boolean
  status: WACallStatus
  type: 'voice' | 'video'
  isVideo: boolean
  isGroup: boolean
  groupJid?: string
  reason?: string
  latencyMs?: number
}
