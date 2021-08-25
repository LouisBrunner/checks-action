import {InputOptions} from '@actions/core';
import * as Inputs from './namespaces/Inputs';
import * as fs from 'fs';

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

/**
 * Formats user-inputted JSON variables into markdown
 * @param {Inputs.Output | undefined} outputJson - the JSON object to transform in to markdown
 * @param {string} [outputStartIndicator] - a pre-defined string to be used in machine-parsing
 * @return {string} - a markdown JSON string
 */
function buildJsonMarkdnown(
  outputJson: Inputs.Output | undefined,
  outputStartIndicator = '---- BEGIN CHECK OUTPUT ----',
): string {
  const prettyOutputJSON = JSON.stringify(outputJson, null, 2);
  const jsonOutputMarkdown = `
# JSON Outputs
\`\`\`json ${outputStartIndicator}
${prettyOutputJSON}
\`\`\``;

  const variablesExist = prettyOutputJSON != '{}';
  const result = variablesExist ? jsonOutputMarkdown : '';
  return result;
}

/**
 * Truncates a string to at most maxChars
 * @param {string} inputString - The string to truncate
 * @param {number} maxChars - How many characters should inputString be truncated to
 * @param {boolean} [removeFromBeginning=true] - Controls whether excess characters should be removed from the beginning or end of the string
 * @param {string} [removalIndicator="..."] - A string to indicate where the truncation of the text occured. Will be substituted in place of truncated text
 * @return {string} a string which is no longer than maxChars in length
 */
function truncateStringChars(
  inputString: string,
  maxChars: number,
  removeFromBeginning = true,
  removalIndicator = '...',
): string {
  const shortEnough = inputString.length <= maxChars;

  if (shortEnough) {
    return inputString;
  }

  // String is too long, we need to trim it
  const seperatorLength = removalIndicator.length;
  const numCharsToKeep = maxChars - seperatorLength;

  if (removeFromBeginning) {
    const startIndex = inputString.length - numCharsToKeep;
    const endIndex = inputString.length;
    const shortendString = removalIndicator + inputString.substring(startIndex, endIndex);
    return shortendString;
  } else {
    const shortendString = inputString.substring(0, numCharsToKeep) + removalIndicator;
    return shortendString;
  }
}

/**
 * Builds output.text_description and output.summary values
 * @param {string} outputSummary - The output summary as provided by the user
 * @param {string} outputTextDescriptionInput - the detailed description as provided by the user
 * @param {string} outputMarkdownFileLocation - the path to a markdown report to be included in the summary
 * @param {Inputs.Output | undefined} outputJsonVars - a JSON object to be added to the report
 * @param {number} [maxChars=65535] - maximum number of characters to be allowed in output.summary and output.text. Defaults to the GitHub's limit
 * @return {string[]} a string array containing values for output.summary and output.text_description
 */
function buildOutputForGitHubCheck(
  outputSummaryInput = '',
  outputTextDescriptionInput = '',
  outputMarkdownFileLocation = '',
  outputJsonVars: Inputs.Output | undefined,
  maxChars = 65535,
): string[] {
  // Get raw values, preferring to read from a file if one is preovided
  const outputDescription = outputMarkdownFileLocation
    ? fs.readFileSync(outputMarkdownFileLocation, 'utf8')
    : outputTextDescriptionInput;
  const jsonVars = buildJsonMarkdnown(outputJsonVars);

  // Truncate report if too long or we need to append JSON variables
  const shortEnough = outputDescription.length + jsonVars.length <= maxChars;
  const truncatedReport = shortEnough
    ? outputDescription
    : truncateStringChars(outputDescription, maxChars - jsonVars.length, true);

  // Collate results. jsonVars may be empty
  const combinedOutputDescription = truncatedReport + jsonVars;
  const summary = truncateStringChars(outputSummaryInput, maxChars, false);

  // [output.summary, output.text_description]
  const result = [summary, combinedOutputDescription];
  return result;
}

export const parseInputs = (getInput: GetInput): Inputs.Args => {
  const repo = getInput('repo');
  const sha = getInput('sha');
  const token = getInput('token', {required: true});
  const outputTextDescriptionFile = getInput('output_text_description_file');

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
  const outputJson = parseJSON<Inputs.Output>(getInput, 'output_json');
  const annotations = parseJSON<Inputs.Annotations>(getInput, 'annotations');
  const images = parseJSON<Inputs.Images>(getInput, 'images');
  const actions = parseJSON<Inputs.Actions>(getInput, 'actions');

  if (!actionURL && (conclusion === Inputs.Conclusion.ActionRequired || actions)) {
    throw new Error(`missing value for 'action_url'`);
  }

  if (output) {
    [output.summary, output.text_description] = buildOutputForGitHubCheck(
      output.summary,
      output.text_description,
      outputTextDescriptionFile,
      outputJson,
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
