export interface ProgressServiceContract<TMessage> {
  connect(callback: (message: TMessage) => void): () => void;
}
