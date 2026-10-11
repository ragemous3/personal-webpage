import { type TextGenerationConfig } from '@huggingface/transformers';

import { isBoolean, isNumber, isRecord } from '@/layers/shared/guards/guards';

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(isNumber);

const isNumberPair = (value: unknown): value is [number, number] =>
  isNumberList(value) && value.length === 2;

const isNumberMatrix = (value: unknown): value is number[][] =>
  Array.isArray(value) && value.every(isNumberList);

const validators = new Map<string, (value: unknown) => boolean>([
  ...[
    'max_length',
    'max_new_tokens',
    'min_length',
    'min_new_tokens',
    'max_time',
    'num_beams',
    'num_beam_groups',
    'penalty_alpha',
    'temperature',
    'top_k',
    'top_p',
    'typical_p',
    'epsilon_cutoff',
    'eta_cutoff',
    'diversity_penalty',
    'repetition_penalty',
    'encoder_repetition_penalty',
    'length_penalty',
    'no_repeat_ngram_size',
    'forced_bos_token_id',
    'guidance_scale',
    'num_return_sequences',
    'pad_token_id',
    'bos_token_id',
    'encoder_no_repeat_ngram_size',
    'decoder_start_token_id',
  ].map((key): [string, (value: unknown) => boolean] => [key, isNumber]),
  ...[
    'do_sample',
    'use_cache',
    'renormalize_logits',
    'remove_invalid_values',
    'output_attentions',
    'output_hidden_states',
    'output_scores',
    'return_dict_in_generate',
    'add_special_tokens',
    'return_full_text',
  ].map((key): [string, (value: unknown) => boolean] => [key, isBoolean]),
  ['early_stopping', (value) => isBoolean(value) || value === 'never'],
  ['bad_words_ids', isNumberMatrix],
  [
    'force_words_ids',
    (value) => isNumberMatrix(value) || (Array.isArray(value) && value.every(isNumberMatrix)),
  ],
  ['constraints', Array.isArray],
  ['forced_eos_token_id', (value) => isNumber(value) || isNumberList(value)],
  ['eos_token_id', (value) => isNumber(value) || isNumberList(value)],
  ['exponential_decay_length_penalty', isNumberPair],
  ['suppress_tokens', isNumberList],
  ['begin_suppress_tokens', isNumberList],
  ['forced_decoder_ids', (value) => Array.isArray(value) && value.every(isNumberPair)],
  ['generation_kwargs', (value) => isRecord(value) && !Array.isArray(value)],
]);

export const isGenerationConfig = (value: unknown): value is Partial<TextGenerationConfig> =>
  isRecord(value) &&
  !Array.isArray(value) &&
  Object.entries(value).every(([key, option]) => validators.get(key)?.(option) ?? false);
