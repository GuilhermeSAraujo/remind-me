export interface MessageSender {
  id: string;
  name?: string; // Pode ser undefined quando o contato não está salvo
}

export interface MessageKeyFields {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  remoteJidAlt?: string;
  senderPn?: string;
}

export interface MessagePayload {
  event: "messages.upsert";
  data: {
    key: MessageKeyFields;
    pushName: string;
    status: string;
    senderPn?: string;
    message: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      reactionMessage?: {
        key: { remoteJid: string; fromMe: boolean; id: string };
        text: string;
      };
    }
    messageType: "conversation" | "extendedTextMessage" | "reactionMessage";
    contextInfo?: {
      // answered message id
      stanzaId: string;
      quotedMessage: unknown;
    }
  }
}

export interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface MessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

export interface UserData {
  phoneNumber: string;
  name: string;
  messageId: string;
  messageKey: MessageKey;
}
