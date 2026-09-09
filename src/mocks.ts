import { env } from "node:process";

const replaceURL = (url: URL, port: string): URL => {
	url.host = "localhost";
	url.port = port;
	url.protocol = "http";
	return url;
};

// biome-ignore lint/complexity/useLiteralKeys: bracket access required by noPropertyAccessFromIndexSignature
// biome-ignore lint/style/noProcessEnv: test-only local server redirect, needs direct process.env access
const localPort = env["INTERNAL_TESTING_MODE_HTTP_LOCAL_PORT"];

export const useLocalFetcher = localPort !== undefined;

export const localFetcher = (
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> => {
	if (!localPort) {
		throw new Error("INTERNAL_TESTING_MODE_HTTP_LOCAL_PORT is not defined");
	}

	// biome-ignore lint/suspicious/noConsole: local testing mode debug logging
	console.debug("localFetcher::before", input);
	let request: RequestInfo | URL;
	if (typeof input === "string") {
		request = replaceURL(new URL(input), localPort).toString();
	} else if (input instanceof URL) {
		request = replaceURL(input, localPort);
	} else {
		request = {
			...input,
			url: replaceURL(new URL(input.url), localPort).toString(),
		};
	}
	// biome-ignore lint/suspicious/noConsole: local testing mode debug logging
	console.debug("localFetcher::after", request);

	return fetch(request, init);
};
