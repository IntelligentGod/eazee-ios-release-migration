export type ChatMessageRole = 'user' | 'assistant' | 'tool';

export type ChatUIMessage = {
  id?: string;
  role: ChatMessageRole;
  content?: string;
  card?: any;
  isStreaming?: boolean;
  deliveryStatus?: 'failed';
  deliveryError?: string;
};

export type ChatSessionListItem = {
  id: string;
  title: string;
  summary?: string;
  titleManuallySet?: boolean;
  titleGeneratedAt?: number;
  pinned: boolean;
  lastMessageAt: number;
  updatedAt: number;
  createdAt: number;
};
