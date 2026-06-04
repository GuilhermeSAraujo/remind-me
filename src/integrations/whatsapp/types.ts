export interface MessageSender {
  id: string;
  name?: string; // Pode ser undefined quando o contato não está salvo
}

export interface MessagePayload {
  event: "messages.upsert";
  data: {
    key: {
      // user "id" from whatsapp
      remoteJid: string;
      fromMe: boolean;
      // message id
      id: string
    },
    pushName: string;
    status: string;
    message: {
      conversation: string;
    }
    messageType: 'conversation' | 'reactionMessage';
    contextInfo: {
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

export interface UserData {
  phoneNumber: string;
  name: string;
  messageId: string;
}
