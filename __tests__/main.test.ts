/** biome-ignore-all lint/style/useNamingConvention: GH & env names */
// biome-ignore lint/correctness/noUnresolvedImports: bun:test is a Bun built-in Biome doesn't resolve
import { describe, expect, test } from "bun:test";
import { type ExecSyncOptions, spawn } from "node:child_process";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";

enum Conclusion {
	Success = "success",
	Failure = "failure",
	Neutral = "neutral",
	Cancelled = "cancelled",
	TimedOut = "timed_out",
	ActionRequired = "action_required",
	Skipped = "skipped",
}

enum Status {
	Queued = "queued",
	InProgress = "in_progress",
	Completed = "completed",
}

type ErrorWithStdout = Error & { stdout: Buffer | string };

// A spawnSync which is actually usable
const actualSpawnSync = async (
	command: string,
	args: string[],
	options: ExecSyncOptions,
): Promise<string> =>
	new Promise<string>((resolve, reject) => {
		let replied = false;

		const node = spawn(command, args, options);

		if (node.stdout === null) {
			reject(new Error("stdout is null"));
			return;
		}

		let stdout = "";

		node.on("error", (err: ErrorWithStdout) => {
			if (stdout !== "") {
				err.stdout = stdout;
			}
			reject(err);
			replied = true;
		});

		node.on("exit", (code, signal) => {
			if (replied) {
				return;
			}

			let err: ErrorWithStdout | undefined;
			if (signal !== null) {
				err = new Error(
					`Action failed with signal: ${signal}`,
				) as ErrorWithStdout;
			} else if (code !== 0) {
				err = new Error(`Action failed with code: ${code}`) as ErrorWithStdout;
			}

			if (err === undefined) {
				return;
			}
			if (stdout !== "") {
				err.stdout = stdout;
			}
			reject(err);
			replied = true;
		});

		node.stdout.on("data", (data) => {
			stdout += data;
		});

		node.on("close", () => {
			if (replied) {
				return;
			}

			resolve(stdout);
			replied = true;
		});
	});

describe("run action", () => {
	const mockEventFile = async (
		event: Record<string, unknown>,
		scope: (filename: string) => Promise<void>,
	): Promise<void> => {
		const directory = mkdtempSync(join(tmpdir(), "checks-actions-"));
		const filename = join(directory, "github_event.json");
		writeFileSync(filename, JSON.stringify(event));
		try {
			await scope(filename);
		} finally {
			unlinkSync(filename);
			rmdirSync(directory);
		}
	};

	type RequestHandler = (
		method: string | undefined,
		url: string | undefined,
		headers: IncomingHttpHeaders,
		body: Record<string, unknown> | undefined,
	) => {
		status: number;
		headers: Record<string, string>;
		reply: Record<string, unknown>;
	};

	const mockHTTPServer = async (
		handler: RequestHandler,
		scope: (port: string) => Promise<void>,
	): Promise<void> => {
		const server = createServer((req, res) => {
			let body = "";
			req.on("data", (chunk) => {
				body += chunk;
			});
			req.on("end", () => {
				// biome-ignore lint/suspicious/noConsole: local test server debug logging
				console.debug("request", req.method, req.url, req.headers, body);
				const { status, headers, reply } = handler(
					req.method,
					req.url,
					req.headers,
					body === ""
						? undefined
						: (JSON.parse(body) as Record<string, unknown>),
				);
				for (const [key, value] of Object.entries(headers)) {
					res.setHeader(key, value);
				}
				res.statusCode = status;
				res.end(JSON.stringify(reply));
			});
		});

		const serverStartTimeoutMs = 1000;
		const portPromise = new Promise<string>((resolve, reject) => {
			const handle = setTimeout(() => {
				reject(new Error("Timeout while starting mock HTTP server"));
			}, serverStartTimeoutMs);

			server.listen(0, "localhost", () => {
				clearTimeout(handle);

				let port = "INVALID";
				const address = server.address();
				if (address !== null) {
					if (typeof address === "string") {
						port = address;
					} else {
						port = address.port.toString();
					}
				}

				resolve(port);
			});
		});

		try {
			await scope(await portPromise);
		} finally {
			server.close();
		}
	};

	const parseOutput = (
		output: string,
	): {
		error: string | undefined;
		checkID: number | undefined;
		output: string;
	} => {
		let error: string | undefined;
		let checkID: number | undefined;
		for (const line of output.split("\n")) {
			if (line.startsWith("::error::")) {
				error = line.split("::error::")[1];
			}
			if (line.startsWith("::set-output name=check_id::")) {
				checkID = Number.parseInt(
					line.split("::set-output name=check_id::")[1],
					10,
				);
			}
		}
		return { checkID, error, output };
	};

	const buildOptionalEnv = ({
		githubAPIURL,
		repo,
		sha,
		name,
		id,
		eventName,
		eventPath,
	}: {
		githubAPIURL: string | undefined;
		repo: string | undefined;
		sha: string | undefined;
		name: string | undefined;
		id: string | undefined;
		eventName: string | undefined;
		eventPath: string | undefined;
	}): Record<string, unknown> => {
		const optional: Record<string, unknown> = {};
		if (githubAPIURL !== undefined) {
			optional.INPUT_GITHUB_API_URL = githubAPIURL;
		}
		if (repo !== undefined) {
			optional.INPUT_REPO = repo;
		}
		if (sha !== undefined) {
			optional.INPUT_SHA = sha;
		}
		if (name !== undefined) {
			optional.INPUT_NAME = name;
		}
		if (id !== undefined) {
			optional.INPUT_CHECK_ID = id;
		}
		if (eventName !== undefined) {
			optional.GITHUB_EVENT_NAME = eventName;
		}
		if (eventPath !== undefined) {
			optional.GITHUB_EVENT_PATH = eventPath;
		}
		return optional;
	};

	const runAction = async ({
		githubAPIURL,
		repo,
		sha,
		token = "ABC",
		name,
		id,
		eventName,
		eventPath,
		status,
		conclusion,
		testPort,
	}: {
		githubAPIURL: string | undefined;
		repo: string | undefined;
		sha: string | undefined;
		token: string | undefined;
		id: string | undefined;
		name: string | undefined;
		eventName: string | undefined;
		eventPath: string | undefined;
		status: string;
		conclusion: string;
		testPort: string;
	}): Promise<{
		error: string | undefined;
		checkID: number | undefined;
		output: string;
	}> => {
		const entry = join(import.meta.dirname, "..", "dist", "index.js");
		const optional = buildOptionalEnv({
			eventName,
			eventPath,
			githubAPIURL,
			id,
			name,
			repo,
			sha,
		});
		const options: ExecSyncOptions = {
			env: {
				...env,
				GITHUB_EVENT_NAME: "",
				GITHUB_EVENT_PATH: "",
				GITHUB_REPOSITORY: "LB/ABC",
				GITHUB_SHA: "SHA1",
				INPUT_CONCLUSION: conclusion,
				INPUT_STATUS: status,
				INPUT_TOKEN: token,
				...optional,
				GITHUB_OUTPUT: "",
				INTERNAL_TESTING_MODE_HTTP_LOCAL_PORT: testPort,
			},
			timeout: 1500,
		};
		try {
			const actionOutput = await actualSpawnSync("node", [entry], options);
			return parseOutput(actionOutput);
		} catch (e) {
			const error = e as ErrorWithStdout;
			if (error.stdout === undefined) {
				throw error;
			}
			try {
				return parseOutput(error.stdout.toString());
			} catch (parseError) {
				throw new Error(
					`Action failed with error: ${error.message} and output: ${error.stdout.toString()}`,
					{ cause: parseError },
				);
			}
		}
	};

	type LoggedRequest = {
		body?: Record<string, unknown>;
		method: string | undefined;
		url: string | undefined;
	};

	type Case = {
		checkID?: string;
		checkName?: string;
		conclusion: Conclusion;
		eventName?: string;
		eventRecord?: Record<string, unknown>;
		expectedCheckID?: number;
		expectedError?: string;
		expectedRequests?: LoggedRequest[];
		githubAPIURL?: string;
		name: string;
		repo?: string;
		sha?: string;
		status: Status;
		token?: string;
	};

	const cases = ((): Case[] => {
		return [
			{
				checkName: "testo",
				conclusion: Conclusion.Success,
				expectedCheckID: 456,
				expectedRequests: [
					{
						body: {
							conclusion: "success",
							head_sha: "SHA1",
							name: "testo",
							status: "completed",
						},
						method: "POST",
						url: "/api/v3/repos/LB/ABC/check-runs",
					},
				],
				githubAPIURL: "https://ghe.example.com/api/v3",
				name: "creation using custom github api url",
				status: Status.Completed,
			},
			{
				checkName: "testo",
				conclusion: Conclusion.Success,
				expectedCheckID: 456,
				expectedRequests: [
					{
						body: {
							conclusion: "success",
							head_sha: "SHA1",
							name: "testo",
							status: "completed",
						},
						method: "POST",
						url: "/repos/LB/ABC/check-runs",
					},
				],
				name: "creation",
				status: Status.Completed,
			},
			{
				checkID: "123",
				conclusion: Conclusion.Success,
				expectedRequests: [
					{
						body: undefined,
						method: "GET",
						url: "/repos/LB/ABC/check-runs/123",
					},
					{
						body: {
							conclusion: "success",
							status: "completed",
						},
						method: "PATCH",
						url: "/repos/LB/ABC/check-runs/123",
					},
				],
				name: "update",
				status: Status.Completed,
			},
			{
				checkName: "testo",
				conclusion: Conclusion.Success,
				expectedCheckID: 456,
				expectedRequests: [
					{
						body: {
							conclusion: "success",
							head_sha: "DEF",
							name: "testo",
							status: "completed",
						},
						method: "POST",
						url: "/repos/remote/repo/check-runs",
					},
				],
				name: "creation on remote repository",
				repo: "remote/repo",
				sha: "DEF",
				status: Status.Completed,
			},
			{
				checkID: "123",
				conclusion: Conclusion.Success,
				expectedRequests: [
					{
						body: undefined,
						method: "GET",
						url: "/repos/remote/repo/check-runs/123",
					},
					{
						body: {
							conclusion: "success",
							status: "completed",
						},
						method: "PATCH",
						url: "/repos/remote/repo/check-runs/123",
					},
				],
				name: "update on remote repository",
				repo: "remote/repo",
				sha: "DEF",
				status: Status.Completed,
			},
			{
				checkID: "123",
				conclusion: Conclusion.Success,
				expectedError: "repo needs to be in the {owner}/{repository} format",
				name: "fails with invalid repo",
				repo: "invalid",
				sha: "DEF",
				status: Status.Completed,
			},
			{
				checkName: "testo",
				conclusion: Conclusion.Success,
				eventName: "pull_request",
				eventRecord: {
					pull_request: {
						head: {
							sha: "123",
						},
					},
				},
				expectedCheckID: 456,
				expectedRequests: [
					{
						body: {
							conclusion: "success",
							head_sha: "123",
							name: "testo",
							status: "completed",
						},
						method: "POST",
						url: "/repos/LB/ABC/check-runs",
					},
				],
				name: "creation from pull_request",
				status: Status.Completed,
			},
			// TODO: add more
		];
	})();

	const runCase = async ({
		expectedError,
		expectedRequests,
		expectedCheckID,
		...rest
	}: Case) => {
		const requests: LoggedRequest[] = [];

		await mockHTTPServer(
			(reqMethod, reqURL, _reqHeaders, reqBody) => {
				if (reqBody !== undefined) {
					reqBody.completed_at = undefined;
					reqBody.started_at = undefined;
				}
				requests.push({ body: reqBody, method: reqMethod, url: reqURL });
				let reply = {};
				if (expectedCheckID !== undefined) {
					reply = { id: expectedCheckID };
				}
				return {
					headers: {
						"content-type": "application/json",
					},
					reply,
					status: 200,
				};
			},
			async (port) => {
				await mockEventFile(rest.eventRecord || {}, async (filename) => {
					const props = {
						conclusion: rest.conclusion.toString(),
						eventName: rest.eventName,
						eventPath: rest.eventRecord ? filename : undefined,
						githubAPIURL: rest.githubAPIURL,
						id: rest.checkID,
						name: rest.checkName,
						repo: rest.repo,
						sha: rest.sha,
						status: rest.status.toString(),
						testPort: port,
						token: rest.token,
					};

					const { error, checkID } = await runAction(props);

					expect(error).toBe(expectedError);
					expect(checkID).toBe(expectedCheckID);
					if (expectedRequests === undefined) {
						expect(requests).toEqual([]);
					} else {
						expect(requests).toEqual(expectedRequests);
					}
				});
			},
		);
	};

	test.each(cases)("with $name", runCase);
});
