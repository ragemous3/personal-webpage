import { sysPrompt } from '../constants/prompts';
import { ChatMessage } from '../models/models';

/* 
   1. Use this as a message Storage and mediator
   2?. Implement peristance state layer here?
*/
const messages: ChatMessage[] = [sysPrompt];
onconnect = (msg: MessageEvent<string>): void => {};
