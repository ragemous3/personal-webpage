import { StandardCommunication } from '@/layers/data/abstracts/standard-communication.abstract';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';

export class Chat extends StandardCommunication<LmConfig> {}
