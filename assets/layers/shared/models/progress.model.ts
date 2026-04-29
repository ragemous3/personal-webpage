// @huggingface/transformers/src/utils/core.js
// Same type as in this one aboveabove  - copied over since i like it.
export type FileProgressBase = {
  name: string;
  file: string;
};

export type InitiateProgressInfo = FileProgressBase & {
  status: 'initiate';
};

export type DownloadProgressInfo = FileProgressBase & {
  status: 'download';
};

export type ProgressStatusInfo = FileProgressBase & {
  status: 'progress';
  progress: number;
  loaded: number;
  total: number;
};

export type DoneProgressInfo = FileProgressBase & {
  status: 'done';
};

export type ReadyProgressInfo = {
  status: 'ready';
  task: string;
  model: string;
};

export type ProgressInfo =
  | InitiateProgressInfo
  | DownloadProgressInfo
  | ProgressStatusInfo
  | DoneProgressInfo
  | ReadyProgressInfo;
