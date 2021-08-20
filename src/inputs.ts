import {InputOptions} from '@actions/core';
import * as Inputs from './namespaces/Inputs';
import * as fs from 'fs';

type GetInput = (name: string, options?: InputOptions | undefined) => string;

// getBinarySize and truncateToBinarySize were adapted from unlicensed work here:
// https://github.com/lemonde/utf8-binary-cutter/blob/master/lib/utf8-binary-cutter.js
function getBinarySize(s: string): number {
  // Get binary size of a UTF8 string
  return Buffer.byteLength(s || '', 'utf8');
}

function truncateToBinarySize(string: string, binaryMaxSize: number): string {
  // Truncate a UTF8 string to less than or equal to binaryMaxSize
  const DEFAULT_TRUNCATE_STRING = '...';
  const DEFAULT_TRUNCATE_STRING_BINARY_SIZE = Buffer.byteLength(DEFAULT_TRUNCATE_STRING, 'utf8');

  string = string || '';
  if (getBinarySize(string) <= binaryMaxSize) return string; // OK

  // we'll use buffer.write to truncate,
  // since it doesn't overflow neither write partial UTF-8 characters.
  const truncatingBuffer = Buffer.alloc(binaryMaxSize - DEFAULT_TRUNCATE_STRING_BINARY_SIZE);
  const writtenBinaryLength = truncatingBuffer.write(string, 'utf8');
  const truncatedString =
    truncatingBuffer.toString('utf8', 0, writtenBinaryLength) + DEFAULT_TRUNCATE_STRING;
  return truncatedString;
}

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

function reverseString(input_string: string): string {
  return input_string.split('').reverse().join('');
}

function buildOutputDescription(
  output_description_md: string,
  json_vars: string,
  max_allowed_bytes: number,
): string {
  // DESCRIPTION:
  // Builds the output.text parameter of the GitHub Check, prioritizing the JSON variables when the
  // file size is over GitHub's allowed maximum
  // INPUTS:
  // output_description_md: a string of the description file
  // json_vars: a markdown string of the JSON variables we want to append
  // max_allowed_bytes: how many bytes should be allowed
  // RETURNS:
  // a formatted output description file of no more than max_allowed_bytes

  const output_file_size = getBinarySize(output_description_md);
  const json_output_markdown_size = getBinarySize(json_vars);

  if (output_file_size + json_output_markdown_size <= max_allowed_bytes) {
    // everything is within bounds, carry on
    return output_description_md + json_vars;
  } else {
    // size is too large, truncate the report, preserving the ending (tail)
    const leftover_space = max_allowed_bytes - json_output_markdown_size;

    const reversed_description = reverseString(output_description_md);
    const truncated_description = truncateToBinarySize(reversed_description, leftover_space);
    const corrected_description = reverseString(truncated_description);

    return corrected_description + json_vars;
  }
  // TODO: Handle edge case where JSON is larger than max_limit
}

export const parseInputs = (getInput: GetInput): Inputs.Args => {
  const repo = getInput('repo');
  const sha = getInput('sha');
  const token = getInput('token', {required: true});
  const output_text_description_file = getInput('output_text_description_file');
  const outputs_start_indicator = '---- BEGIN CHECK OUTPUT ----';
  const GITHUB_CHECK_DESCRIPTION_MAX_SIZE_BYTES = 65536; // 64 KiB

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
  const output_json = parseJSON<Inputs.Output>(getInput, 'output_json');
  const annotations = parseJSON<Inputs.Annotations>(getInput, 'annotations');
  const images = parseJSON<Inputs.Images>(getInput, 'images');
  const actions = parseJSON<Inputs.Actions>(getInput, 'actions');

  if (!actionURL && (conclusion === Inputs.Conclusion.ActionRequired || actions)) {
    throw new Error(`missing value for 'action_url'`);
  }

  const pretty_output_json = JSON.stringify(output_json, null, 2);
  const json_output_markdown = `
# JSON Outputs
\`\`\`json ${outputs_start_indicator}
${pretty_output_json}
\`\`\``;

  const should_append_json = pretty_output_json != '{}';

  if (output && output_text_description_file && should_append_json) {
    // we have a summary file and JSON variables to append
    const output_file_md = fs.readFileSync(output_text_description_file, 'utf8');
    output.text_description = buildOutputDescription(
      output_file_md,
      json_output_markdown,
      GITHUB_CHECK_DESCRIPTION_MAX_SIZE_BYTES,
    );
  } else if (output && output_text_description_file && !should_append_json) {
    // we only have the description file
    const output_file_md = fs.readFileSync(output_text_description_file, 'utf8');
    output.text_description = buildOutputDescription(
      output_file_md,
      '',
      GITHUB_CHECK_DESCRIPTION_MAX_SIZE_BYTES,
    );
  } else if (output && should_append_json && !output_text_description_file) {
    // we only have JSON
    output.text_description = buildOutputDescription(
      '',
      json_output_markdown,
      GITHUB_CHECK_DESCRIPTION_MAX_SIZE_BYTES,
    );
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
