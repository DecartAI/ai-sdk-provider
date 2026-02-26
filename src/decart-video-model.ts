import {
	AISDKError,
	type Experimental_VideoModelV3 as VideoModelV3,
	type Experimental_VideoModelV3CallOptions as VideoModelV3CallOptions,
} from "@ai-sdk/provider";
import {
	combineHeaders,
	createJsonErrorResponseHandler,
	createJsonResponseHandler,
	delay,
	type FetchFunction,
	postFormDataToApi,
} from "@ai-sdk/provider-utils";
import { z } from "zod/v4";
import { type DecartModelConfig, convertAspectRatioToOrientation } from "./decart-config";

export interface DecartVideoProviderOptions {
	/**
	 * Trajectory array for lucy-motion model.
	 * Each point specifies a frame number and x,y coordinates.
	 */
	trajectory?: Array<{ frame: number; x: number; y: number }>;

	/**
	 * Override orientation directly instead of deriving from aspectRatio.
	 * Values: "landscape" or "portrait".
	 */
	orientation?: "landscape" | "portrait";

	/**
	 * Polling interval in milliseconds. Default: 1500.
	 */
	pollIntervalMs?: number;

	/**
	 * Polling timeout in milliseconds. Default: 300000 (5 minutes).
	 */
	pollTimeoutMs?: number;
}


function convertResolution(
	resolution: `${number}x${number}`,
): "720p" | "480p" | undefined {
	const [, height] = resolution.split("x").map(Number);
	if (height === 720) return "720p";
	if (height === 480) return "480p";
	return undefined;
}

function appendFileToFormData(
	formData: FormData,
	fieldName: string,
	file: NonNullable<VideoModelV3CallOptions["image"]>,
): void {
	if (file.type === "url") {
		formData.append(fieldName, file.url);
	} else {
		const data =
			typeof file.data === "string" ? base64ToUint8Array(file.data) : file.data;
		formData.append(fieldName, new Blob([data], { type: file.mediaType }));
	}
}

function base64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

const jobResponseSchema = z.object({
	job_id: z.string(),
	status: z.string(),
});

const jobStatusSchema = z.object({
	job_id: z.string(),
	status: z.string(),
});

export class DecartVideoModel implements VideoModelV3 {
	readonly specificationVersion = "v3";
	readonly maxVideosPerCall = 1;

	get provider(): string {
		return this.config.provider;
	}

	constructor(
		readonly modelId: string,
		private readonly config: DecartModelConfig,
	) {}

	async doGenerate(
		options: Parameters<VideoModelV3["doGenerate"]>[0],
	): Promise<Awaited<ReturnType<VideoModelV3["doGenerate"]>>> {
		const currentDate = this.config._internal?.currentDate?.() ?? new Date();
		const warnings: Array<{
			type: "unsupported";
			feature: string;
			details?: string;
		}> = [];

		const decartOptions = (options.providerOptions?.decart ??
			{}) as DecartVideoProviderOptions;

		// Convert aspectRatio → orientation
		let orientation: "portrait" | "landscape" | undefined =
			decartOptions.orientation;
		if (!orientation && options.aspectRatio != null) {
			orientation = convertAspectRatioToOrientation(options.aspectRatio);
			if (orientation === undefined) {
				warnings.push({
					type: "unsupported",
					feature: "aspectRatio",
					details: "Only 16:9 and 9:16 aspect ratios are supported.",
				});
			}
		}

		// Convert resolution
		let resolution: "720p" | "480p" | undefined;
		if (options.resolution != null) {
			resolution = convertResolution(options.resolution);
			if (resolution === undefined) {
				warnings.push({
					type: "unsupported",
					feature: "resolution",
					details: "Only 720p and 480p resolutions are supported.",
				});
			}
		}

		// Warn on unsupported standard options
		if (options.fps != null) {
			warnings.push({ type: "unsupported", feature: "fps" });
		}
		if (options.duration != null) {
			warnings.push({ type: "unsupported", feature: "duration" });
		}

		// Build FormData
		const formData = new FormData();

		if (options.prompt != null) {
			formData.append("prompt", options.prompt);
		}

		if (options.seed != null) {
			formData.append("seed", options.seed.toString());
		}

		if (resolution != null) {
			formData.append("resolution", resolution);
		}

		if (orientation != null) {
			formData.append("orientation", orientation);
		}

		if (options.image != null) {
			appendFileToFormData(formData, "data", options.image);
		}

		// Trajectory (for motion model)
		if (decartOptions.trajectory != null) {
			formData.append("trajectory", JSON.stringify(decartOptions.trajectory));
		}

		// Submit job
		const submitUrl = this.config.url({
			path: "v1/jobs",
			modelId: this.modelId,
		});
		const fullHeaders = combineHeaders(this.config.headers(), options.headers);

		const { value: submitResponse, responseHeaders } = await postFormDataToApi({
			url: submitUrl,
			headers: fullHeaders,
			formData,
			failedResponseHandler: createJsonErrorResponseHandler({
				errorSchema: z.any(),
				errorToMessage: (data) => JSON.stringify(data),
			}),
			successfulResponseHandler: createJsonResponseHandler(jobResponseSchema),
			abortSignal: options.abortSignal,
			fetch: this.config.fetch,
		});

		const jobId = submitResponse.job_id;

		// Poll for completion
		const pollIntervalMs = decartOptions.pollIntervalMs ?? 1500;
		const pollTimeoutMs = decartOptions.pollTimeoutMs ?? 300_000;
		const startTime = Date.now();
		const statusUrl = `${this.config.baseURL}/v1/jobs/${jobId}`;

		while (true) {
			await delay(pollIntervalMs);

			if (options.abortSignal?.aborted) {
				throw new AISDKError({
					name: "AI_APICallError",
					message: "Video generation request was aborted",
				});
			}

			if (Date.now() - startTime > pollTimeoutMs) {
				throw new AISDKError({
					name: "AI_APICallError",
					message: `Video generation timed out after ${pollTimeoutMs}ms`,
				});
			}

			const { value: statusData } = await getJsonFromApi({
				url: statusUrl,
				headers: fullHeaders,
				schema: jobStatusSchema,
				abortSignal: options.abortSignal,
				fetch: this.config.fetch,
			});

			if (statusData.status === "completed") {
				break;
			}

			if (statusData.status === "failed") {
				throw new AISDKError({
					name: "AI_APICallError",
					message: `Video generation job ${jobId} failed`,
				});
			}
		}

		// Download video content
		const contentUrl = `${this.config.baseURL}/v1/jobs/${jobId}/content`;
		const videoData = await downloadBinary({
			url: contentUrl,
			headers: fullHeaders,
			abortSignal: options.abortSignal,
			fetch: this.config.fetch,
		});

		return {
			videos: [
				{
					type: "binary",
					data: videoData,
					mediaType: "video/mp4",
				},
			],
			warnings,
			response: {
				timestamp: currentDate,
				modelId: this.modelId,
				headers: responseHeaders,
			},
		};
	}
}

/**
 * Performs a GET request and parses the JSON response.
 */
async function getJsonFromApi<T>({
	url,
	headers,
	schema,
	abortSignal,
	fetch: fetchFn,
}: {
	url: string;
	headers: Record<string, string | undefined>;
	schema: z.ZodType<T>;
	abortSignal?: AbortSignal;
	fetch?: FetchFunction;
}): Promise<{ value: T; responseHeaders: Record<string, string> }> {
	const f = fetchFn ?? fetch;
	const response = await f(url, {
		method: "GET",
		headers: headers as Record<string, string>,
		signal: abortSignal,
	});

	const responseHeaders = Object.fromEntries(response.headers.entries());

	if (!response.ok) {
		const body = await response.text();
		throw new AISDKError({
			name: "AI_APICallError",
			message: `GET ${url} failed with status ${response.status}: ${body}`,
		});
	}

	const json = await response.json();
	const parsed = schema.parse(json);

	return { value: parsed, responseHeaders };
}

/**
 * Downloads binary content from a URL.
 */
async function downloadBinary({
	url,
	headers,
	abortSignal,
	fetch: fetchFn,
}: {
	url: string;
	headers: Record<string, string | undefined>;
	abortSignal?: AbortSignal;
	fetch?: FetchFunction;
}): Promise<Uint8Array> {
	const f = fetchFn ?? fetch;
	const response = await f(url, {
		method: "GET",
		headers: headers as Record<string, string>,
		signal: abortSignal,
	});

	if (!response.ok) {
		const body = await response.text();
		throw new AISDKError({
			name: "AI_APICallError",
			message: `Failed to download video: ${response.status} ${body}`,
		});
	}

	return new Uint8Array(await response.arrayBuffer());
}
