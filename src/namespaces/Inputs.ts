import {RestEndpointMethodTypes} from '@octokit/rest';

interface ArgsBase {
  repo?: string;
  sha?: string;
  token: string;
  conclusion?: Conclusion;
  status: Status;

  actionURL?: string;
  detailsURL?: string;

  output?: Output;
  annotations?: Annotations;
  images?: Images;
  actions?: Actions;
}

export interface ArgsCreate extends ArgsBase {
  name: string;
}

export interface ArgsUpdate extends ArgsBase {
  checkID: number;
}

export type Args = ArgsCreate | ArgsUpdate;

// @octokit/rest > Endpoints.d.ts > ChecksCreateParamsOutputAnnotations[]
export type Annotations = NonNullable<
  NonNullable<RestEndpointMethodTypes['checks']['create']['parameters']['output']>['annotations']
>;

// @octokit/rest > Endpoints.d.ts > ChecksCreateParamsOutputImages[]
export type Images = NonNullable<
  NonNullable<RestEndpointMethodTypes['checks']['create']['parameters']['output']>['images']
>;

// @octokit/rest > Endpoints.d.ts > ChecksCreateParamsActions[]
export type Actions = NonNullable<
  RestEndpointMethodTypes['checks']['create']['parameters']['actions']
>;

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
