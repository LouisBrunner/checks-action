import {GitHub} from '@actions/github';
import * as Inputs from './namespaces/Inputs';

type Ownership = {
  owner: string;
  repo: string;
};

type CreateOptions = {
  completed: boolean;
};

const unpackInputs = (inputs: Inputs.Args): object => {
  let output;
  if (inputs.output) {
    output = {
      summary: inputs.output.summary,
      text: inputs.output.text_description,
      actions: inputs.actions,
      images: inputs.images,
    };
  }
  return {
    status: inputs.status.toString(),
    conclusion: inputs.conclusion.toString(),
    output,
    actions: inputs.actions,
  };
};

const formatDate = (): string => {
  return new Date().toISOString();
};

export const createRun = async (
  octokit: GitHub,
  sha: string,
  ownership: Ownership,
  inputs: Inputs.Args,
  options?: CreateOptions,
): Promise<number> => {
  const dates: {completed_at?: string} = {};
  if (!options || options.completed) {
    dates.completed_at = formatDate();
  }
  const {data} = await octokit.checks.create({
    ...ownership,
    head_sha: sha,
    name: inputs.name,
    started_at: formatDate(),
    ...dates,
    ...unpackInputs(inputs),
  });
  return data.id;
};

export const updateRun = async (
  octokit: GitHub,
  id: number,
  ownership: Ownership,
  inputs: Inputs.Args,
): Promise<void> => {
  await octokit.checks.update({
    ...ownership,
    check_run_id: id,
    completed_at: formatDate(),
    ...unpackInputs(inputs),
  });
};
