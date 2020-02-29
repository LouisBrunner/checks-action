import {Octokit} from '@octokit/rest';

export type Args = {
  name: string;
  token: string;
  conclusion: Conclusion;
  status: Status;

  actionURL: string;

  output?: Output;
  annotations?: Annotations;
  images?: Images;
  actions?: Actions;
};

export type Annotations = Octokit.ChecksCreateParamsOutputAnnotations[];

export type Images = Octokit.ChecksCreateParamsOutputImages[];

export type Actions = Octokit.ChecksCreateParamsActions[];

export type Output = {
  summary: string;
  text_description?: string;
};

export enum Conclusion {
  Success = 'success',
  Failure = 'failure',
  Neutral = 'neutral',
  Cancelled = 'cancelled',
  TimedOut = 'timed_out',
  ActionRequired = 'action_required',
}

export enum Status {
  Queued = 'queued',
  InProgress = 'in_progress',
  Completed = 'completed',
}
