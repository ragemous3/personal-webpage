import { type TextGenerationConfig } from '@huggingface/transformers';

import { isBoolean, isNumber, isRecord } from '@/layers/shared/guards/guards';

const isNonnegativeInteger = (value: unknown): value is number =>
  isNumber(value) && Number.isSafeInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  isNonnegativeInteger(value) && value > 0;

const isPositiveNumber = (value: unknown): value is number => isNumber(value) && value > 0;
const isNonnegativeNumber = (value: unknown): value is number => isNumber(value) && value >= 0;
const isProbability = (value: unknown): value is number =>
  isNumber(value) && value > 0 && value <= 1;
const isCutoff = (value: unknown): value is number => isNumber(value) && value >= 0 && value < 1;

const isTokenList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(isNonnegativeInteger);

const isNonemptyTokenList = (value: unknown): value is number[] =>
  isTokenList(value) && value.length > 0;

const isTokenPair = (value: unknown): value is [number, number] =>
  isTokenList(value) && value.length === 2;

const isTokenMatrix = (value: unknown): value is number[][] =>
  Array.isArray(value) && value.every(isNonemptyTokenList);

const validators = new Map<string, (value: unknown) => boolean>([
  ...['max_length', 'max_new_tokens', 'num_beams', 'num_beam_groups', 'num_return_sequences'].map(
    (key): [string, (value: unknown) => boolean] => [key, isPositiveInteger],
  ),
  ...[
    'min_length',
    'min_new_tokens',
    'top_k',
    'no_repeat_ngram_size',
    'forced_bos_token_id',
    'pad_token_id',
    'bos_token_id',
    'encoder_no_repeat_ngram_size',
    'decoder_start_token_id',
  ].map((key): [string, (value: unknown) => boolean] => [key, isNonnegativeInteger]),
  ...['max_time', 'temperature', 'repetition_penalty', 'encoder_repetition_penalty'].map(
    (key): [string, (value: unknown) => boolean] => [key, isPositiveNumber],
  ),
  ...['penalty_alpha', 'diversity_penalty', 'guidance_scale'].map(
    (key): [string, (value: unknown) => boolean] => [key, isNonnegativeNumber],
  ),
  ...['top_p', 'typical_p'].map((key): [string, (value: unknown) => boolean] => [
    key,
    isProbability,
  ]),
  ...['epsilon_cutoff', 'eta_cutoff'].map((key): [string, (value: unknown) => boolean] => [
    key,
    isCutoff,
  ]),
  ['length_penalty', isNumber],
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
  ['bad_words_ids', isTokenMatrix],
  [
    'force_words_ids',
    (value) =>
      isTokenMatrix(value) ||
      (Array.isArray(value) && value.every((group) => isTokenMatrix(group) && group.length > 0)),
  ],
  ['constraints', Array.isArray],
  ['forced_eos_token_id', (value) => isNonnegativeInteger(value) || isNonemptyTokenList(value)],
  ['eos_token_id', (value) => isNonnegativeInteger(value) || isNonemptyTokenList(value)],
  [
    'exponential_decay_length_penalty',
    (value) =>
      Array.isArray(value) &&
      value.length === 2 &&
      isNonnegativeInteger(value[0]) &&
      isPositiveNumber(value[1]),
  ],
  ['suppress_tokens', isTokenList],
  ['begin_suppress_tokens', isTokenList],
  ['forced_decoder_ids', (value) => Array.isArray(value) && value.every(isTokenPair)],
  ['generation_kwargs', (value) => isRecord(value) && !Array.isArray(value)],
]);

export const isGenerationConfig = (value: unknown): value is Partial<TextGenerationConfig> => {
  if (
    !isRecord(value) ||
    Array.isArray(value) ||
    !Object.entries(value).every(([key, option]) => validators.get(key)?.(option) ?? false)
  ) {
    return false;
  }

  try {
    structuredClone(value);
    return true;
  } catch {
    return false;
  }
};
