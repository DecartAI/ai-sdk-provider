import type { ImageModelV2, ImageModelV2CallWarning } from "@ai-sdk/provider";
import {
	combineHeaders,
	createBinaryResponseHandler,
	createJsonErrorResponseHandler,
	postFormDataToApi,
} from "@ai-sdk/provider-utils";
import { z } from "zod/v4";
import { type DecartModelConfig, convertAspectRatioToOrientation } from "./decart-config";

export class DecartImageModel implements ImageModelV2 {
	readonly specificationVersion = "v2";
	readonly maxImagesPerCall = 1;

	get provider(): string {
		return this.config.provider;
	}

	constructor(
		readonly modelId: string,
		private readonly config: DecartModelConfig,
	) {}

	async doGenerate({
		prompt,
		n,
		size,
		aspectRatio,
		seed,
		providerOptions,
		headers,
		abortSignal,
	}: Parameters<ImageModelV2["doGenerate"]>[0]): Promise<Awaited<ReturnType<ImageModelV2["doGenerate"]>>> {
		const warnings: Array<ImageModelV2CallWarning> = [];

		if (size != null) {
			warnings.push({ type: "unsupported-setting", setting: "size" });
		}

		let orientation: "portrait" | "landscape" | undefined;
		if (aspectRatio != null) {
			orientation = convertAspectRatioToOrientation(aspectRatio);
			if (orientation === undefined) {
				warnings.push({
					type: "unsupported-setting",
					setting: "aspectRatio",
					details: "Only 16:9 and 9:16 aspect ratios are supported.",
				});
			}
		}

		const currentDate = this.config._internal?.currentDate?.() ?? new Date();

		const url = this.config.url({ path: "v1/generate", modelId: this.modelId });
		const fullHeaders = combineHeaders(this.config.headers(), headers);

		const formData = new FormData();
		formData.append("prompt", prompt);

		if (seed !== undefined) {
			formData.append("seed", seed.toString());
		}

		if (orientation !== undefined) {
			formData.append("orientation", orientation);
		}

		const { value, responseHeaders } = await postFormDataToApi({
			url,
			headers: fullHeaders,
			formData,
			failedResponseHandler: createJsonErrorResponseHandler({
				errorSchema: z.any(),
				errorToMessage: (data) => JSON.stringify(data),
			}),
			successfulResponseHandler: createBinaryResponseHandler(),
			abortSignal,
			fetch: this.config.fetch,
		});

		return {
			images: [value],
			warnings,
			response: {
				modelId: this.modelId,
				timestamp: currentDate,
				headers: responseHeaders,
			},
		};
	}
}
