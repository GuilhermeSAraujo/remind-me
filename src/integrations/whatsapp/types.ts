export interface MessageSender {
  id: string;
  name: string;
}

export interface MessagePayload {
  event: "onmessage" | "qrcode" | "qrReadSuccess";
  id: string;
  sender: MessageSender;
  body: string;
  from: string;
  urlcode?: string;
  quotedMsgId?: string;
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

