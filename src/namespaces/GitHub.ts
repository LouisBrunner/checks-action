import type { operations } from "@octokit/openapi-types";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export { OctokitOptions } from "@octokit/core";

export type PullRequest =
	RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];

type ChecksCreate =
	operations["checks/create"]["requestBody"]["content"]["application/json"];

type ChecksCreateParameters =
	RestEndpointMethodTypes["checks"]["create"]["parameters"];

type ChecksUpdateParameters =
	RestEndpointMethodTypes["checks"]["update"]["parameters"];

export type Inputs = Partial<ChecksCreateParameters> &
	Partial<ChecksUpdateParameters>;

type Output = NonNullable<ChecksCreate["output"]>;

export type Annotations = NonNullable<Output["annotations"]>;

export type Images = NonNullable<Output["images"]>;

export type Actions = NonNullable<ChecksCreate["actions"]>;
