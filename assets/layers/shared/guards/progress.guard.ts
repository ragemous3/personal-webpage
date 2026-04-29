import {
  InitiateProgressInfo,
  DownloadProgressInfo,
  ProgressStatusInfo,
  DoneProgressInfo,
  ReadyProgressInfo,
  ProgressInfo,
  FileProgressBase,
} from '../models/progress.model';
import { isRecord, isString, isNumber } from './guards';

export const hasFileProgressBase = (
  value: Record<string, unknown>,
): value is Record<string, unknown> & FileProgressBase =>
  isString(value.name) && isString(value.file);

export const isInitiateProgressInfo = (value: unknown): value is InitiateProgressInfo =>
  isRecord(value) && value.status === 'initiate' && hasFileProgressBase(value);

export const isDownloadProgressInfo = (value: unknown): value is DownloadProgressInfo =>
  isRecord(value) && value.status === 'download' && hasFileProgressBase(value);

export const isProgressStatusInfo = (value: unknown): value is ProgressStatusInfo =>
  isRecord(value) &&
  value.status === 'progress' &&
  hasFileProgressBase(value) &&
  isNumber(value.progress) &&
  isNumber(value.loaded) &&
  isNumber(value.total) &&
  value.progress >= 0 &&
  value.progress <= 100 &&
  value.loaded >= 0 &&
  value.total >= 0;

export const isDoneProgressInfo = (value: unknown): value is DoneProgressInfo =>
  isRecord(value) && value.status === 'done' && hasFileProgressBase(value);

export const isReadyProgressInfo = (value: unknown): value is ReadyProgressInfo =>
  isRecord(value) && value.status === 'ready' && isString(value.task) && isString(value.model);

export const isProgressInfo = (value: unknown): value is ProgressInfo =>
  isInitiateProgressInfo(value) ||
  isDownloadProgressInfo(value) ||
  isProgressStatusInfo(value) ||
  isDoneProgressInfo(value) ||
  isReadyProgressInfo(value);
