import {InputOptions} from '@actions/core';
import * as Inputs from './namespaces/Inputs';

type GetInput = (name: string, options?: InputOptions | undefined) => string;

const parseJSON = <T>(getInput: GetInput, property: string): T | undefined => {
  const value = getInput(property);
  if (!value) {
    return;
  }
  try {
    const obj = JSON.parse(value);
    return obj as T;
  } catch (e) {
    throw new Error(`invalid format for '${property}: ${e.toString()}`);
  }
};

export const parseInputs = (getInput: GetInput): Inputs.Args => {
  const token = getInput('token', {required: true});
  const name = getInput('name', {required: true});
  const statusStr = getInput('status', {required: true});
  const conclusionStr = getInput('conclusion', {required: true});

  if (!(statusStr in Inputs.Status)) {
    throw new Error(`invalid value for 'status': '${statusStr}'`);
  }
  const status = statusStr as Inputs.Status;

  if (!(conclusionStr in Inputs.Conclusion)) {
    throw new Error(`invalid value for 'conclusion': '${conclusionStr}'`);
  }
  const conclusion = conclusionStr as Inputs.Conclusion;

  const output = parseJSON<Inputs.Output>(getInput, 'output');
  const annotations = parseJSON<Inputs.Annotations>(getInput, 'annotations');
  const images = parseJSON<Inputs.Images>(getInput, 'images');
  const actions = parseJSON<Inputs.Actions>(getInput, 'actions');

  return {
    name,
    token,
    status,
    conclusion,

    output,
    annotations,
    images,
    actions,
  };
};
