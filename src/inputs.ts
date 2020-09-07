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
  const token = getInput('token', {required: true});
  const name = getInput('name', {required: true});
  const status = getInput('status', {required: true}) as Inputs.Status;
  const conclusion = getInput('conclusion', {required: true}).toLowerCase() as Inputs.Conclusion;
  const actionURL = getInput('action_url');

  if (!Object.values(Inputs.Status).includes(status)) {
    throw new Error(`invalid value for 'status': '${status}'`);
  }

  if (!Object.values(Inputs.Conclusion).includes(conclusion)) {
    throw new Error(`invalid value for 'conclusion': '${conclusion}'`);
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
    name,
    token,
    status,
    conclusion,

    actionURL,

    output,
    annotations,
    images,
    actions,
  };
};
