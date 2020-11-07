import {RestEndpointMethodTypes} from '@octokit/rest';

// @octokit/rest > Endpoints.d.ts > PullsGetResponseData
export type PullRequest = RestEndpointMethodTypes['pulls']['get']['response']['data'];
