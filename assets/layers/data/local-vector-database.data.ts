import { StandardCommunication } from '@/layers/data/abstracts/standard-communication.abstract';
import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';

export class DB extends StandardCommunication<DatabaseConfig> {}
