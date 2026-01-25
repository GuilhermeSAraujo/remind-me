export interface MessageSender {
  id: string;
  name?: string; // Pode ser undefined quando o contato não está salvo
}

export interface MessagePayload {
  event: "onmessage" | "qrcode" | "qrReadSuccess";
  id: string;
  sender: MessageSender;
  body: string;
  from: string;
  urlcode?: string;
  quotedMsgId?: string;
  // Campos adicionais do WPPConnect para contatos não salvos
  notifyName?: string; // Nome do perfil do WhatsApp do remetente
  pushname?: string; // Push name alternativo
  isGroupMsg?: boolean;
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
