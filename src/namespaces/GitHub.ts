import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods';
import {operations} from '@octokit/openapi-types';

export type PullRequest = RestEndpointMethodTypes['pulls']['get']['response']['data'];

type ChecksCreate = operations['checks/create']['requestBody']['content']['application/json'];

type Output = NonNullable<ChecksCreate['output']>;

export type Annotations = NonNullable<Output['annotations']>;

export type Images = NonNullable<Output['images']>;

export type Actions = NonNullable<ChecksCreate['actions']>;
