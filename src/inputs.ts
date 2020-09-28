import {InputOptions} from '@actions/core';
import * as Inputs from './namespaces/Inputs';

type GetInput = (name: string, options?: InputOptions | undefined) => string;

const parseJSON = <T>(getInput: GetInput, property: string): T | undefined => {
  const value = getInput(property);
  if (!value) {
    return;
  }
  try {
    return JSON.parse(value) as T;
  } catch (e) {
    const error = e as Error;
    throw new Error(`invalid format for '${property}: ${error.toString()}`);
  }
};

export const parseInputs = (getInput: GetInput): Inputs.Args => {
  const repo = getInput('repo');
  const sha = getInput('sha');
  const token = getInput('token', {required: true});

  const name = getInput('name');
  const checkIDStr = getInput('check_id');

  const status = getInput('status', {required: true}) as Inputs.Status;
  let conclusion = getInput('conclusion') as Inputs.Conclusion;

  const actionURL = getInput('action_url');
  const detailsURL = getInput('details_url');

  if (repo && repo.split('/').length != 2) {
    throw new Error('repo needs to be in the {owner}/{repository} format');
  }

  if (name && checkIDStr) {
    throw new Error(`can only provide 'name' or 'check_id'`);
  }

  if (!name && !checkIDStr) {
    throw new Error(`must provide 'name' or 'check_id'`);
  }

  const checkID = checkIDStr ? parseInt(checkIDStr) : undefined;

  if (!Object.values(Inputs.Status).includes(status)) {
    throw new Error(`invalid value for 'status': '${status}'`);
  }

  if (conclusion) {
    conclusion = conclusion.toLowerCase() as Inputs.Conclusion;
    if (!Object.values(Inputs.Conclusion).includes(conclusion)) {
      throw new Error(`invalid value for 'conclusion': '${conclusion}'`);
    }
  }

  if (status === Inputs.Status.Completed) {
    if (!conclusion) {
      throw new Error(`'conclusion' is required when 'status' is 'completed'`);
    }
  } else {
    if (conclusion) {
      throw new Error(`can't provide a 'conclusion' with a non-'completed' 'status'`);
    }
  }

  const output = parseJSON<Inputs.Output>(getInput, 'output');
  const annotations = parseJSON<Inputs.Annotations>(getInput, 'annotations');
  const images = parseJSON<Inputs.Images>(getInput, 'images');
  const actions = parseJSON<Inputs.Actions>(getInput, 'actions');

  if (!actionURL && (conclusion === Inputs.Conclusion.ActionRequired || actions)) {
    throw new Error(`missing value for 'action_url'`);
  }

  if ((!output || !output.summary) && (annotations || images)) {
    throw new Error(`missing value for 'output.summary'`);
  }

  return {
    repo,
    sha,
    name,
    token,
    status,
    conclusion,

    checkID,

    actionURL,
    detailsURL,

    output,
    annotations,
    images,
    actions,
  };
};
