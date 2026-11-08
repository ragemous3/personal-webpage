export interface PendingChatGeneration {
  text: string;
  onText(text: string): void;
  resolve(text: string): void;
  reject(error: Error): void;
}
