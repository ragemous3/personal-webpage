import { ChatbotInfra } from '../infra/data.infra';

export class ChatbotService {
  infra: ChatbotInfra;

  constructor(infra: ChatbotInfra = new ChatbotInfra()) {
    this.infra = infra;
  }

  init = async () => this.infra.init();
}
