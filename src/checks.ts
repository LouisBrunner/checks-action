import * as core from "@actions/core";
import type { GitHub } from "@actions/github/lib/utils";
import * as Inputs from "./namespaces/Inputs";

type Ownership = {
	owner: string;
	repo: string;
};

const unpackInputs = (
	title: string,
	inputs: Inputs.Args,
): Record<string, unknown> => {
	let output: Record<string, unknown> | undefined;
	if (inputs.output) {
		output = {
			actions: inputs.actions,
			annotations: inputs.annotations,
			images: inputs.images,
			summary: inputs.output.summary,
			text: inputs.output.text_description,
			title: inputs.output.title ?? title,
		};
	}

	let details_url: string | undefined;

	if (
		inputs.conclusion === Inputs.Conclusion.ActionRequired ||
		inputs.actions
	) {
		if (inputs.detailsURL) {
			const reasonList = [];
			if (inputs.conclusion === Inputs.Conclusion.ActionRequired) {
				reasonList.push(`'conclusion' is 'action_required'`);
			}
			if (inputs.actions) {
				reasonList.push(`'actions' was provided`);
			}
			const reasons = reasonList.join(" and ");
			core.info(
				`'details_url' was ignored in favor of 'action_url' because ${reasons} (see documentation for details)`,
			);
		}
		details_url = inputs.actionURL;
	} else if (inputs.detailsURL) {
		details_url = inputs.detailsURL;
	}

	return {
		actions: inputs.actions,
		completed_at:
			inputs.status === Inputs.Status.Completed ? formatDate() : undefined,
		conclusion: inputs.conclusion ? inputs.conclusion.toString() : undefined,
		details_url,
		output,
		status: inputs.status.toString(),
	};
};

const formatDate = (): string => {
	return new Date().toISOString();
};

export const createRun = async (
	octokit: InstanceType<typeof GitHub>,
	name: string,
	sha: string,
	ownership: Ownership,
	inputs: Inputs.Args,
): Promise<number> => {
	const { data } = await octokit.rest.checks.create({
		...ownership,
		head_sha: sha,
		name: name,
		started_at: formatDate(),
		...unpackInputs(name, inputs),
	});
	return data.id;
};

export const updateRun = async (
	octokit: InstanceType<typeof GitHub>,
	id: number,
	ownership: Ownership,
	inputs: Inputs.Args,
): Promise<void> => {
	const previous = await octokit.rest.checks.get({
		...ownership,
		check_run_id: id,
	});
	await octokit.rest.checks.update({
		...ownership,
		check_run_id: id,
		...unpackInputs(previous.data.name, inputs),
	});
};
