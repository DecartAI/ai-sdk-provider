import { type Experimental_VideoModelV3, type ImageModelV2, NoSuchModelError, type ProviderV2 } from "@ai-sdk/provider";
import { type FetchFunction, loadApiKey, withoutTrailingSlash, withUserAgentSuffix } from "@ai-sdk/provider-utils";
import { DecartImageModel } from "./decart-image-model";
import type { DecartImageModelId } from "./decart-image-settings";
import { DecartVideoModel } from "./decart-video-model";
import type { DecartVideoModelId } from "./decart-video-settings";
import { VERSION } from "./version";

export interface DecartProviderSettings {
	apiKey?: string;
	baseURL?: string;
	headers?: Record<string, string>;
	fetch?: FetchFunction;
}

export interface DecartProvider extends ProviderV2 {
	image(modelId: DecartImageModelId): ImageModelV2;
	imageModel(modelId: DecartImageModelId): ImageModelV2;
	video(modelId: DecartVideoModelId): Experimental_VideoModelV3;
	videoModel(modelId: DecartVideoModelId): Experimental_VideoModelV3;
}

const defaultBaseURL = "https://api.decart.ai";

export function createDecart(options: DecartProviderSettings = {}): DecartProvider {
	const baseURL = withoutTrailingSlash(options.baseURL ?? defaultBaseURL);
	const getHeaders = () =>
		withUserAgentSuffix(
			{
				"X-API-KEY": loadApiKey({
					apiKey: options.apiKey,
					environmentVariableName: "DECART_API_KEY",
					description: "Decart",
				}),
				...options.headers,
			},
			`ai-sdk/decart/${VERSION}`,
		);

	const createImageModel = (modelId: DecartImageModelId) =>
		new DecartImageModel(modelId, {
			provider: "decart.image",
			url: ({ path, modelId }) => `${baseURL}/${path}/${modelId}`,
			baseURL: baseURL ?? defaultBaseURL,
			headers: getHeaders,
			fetch: options.fetch,
		});

	const createVideoModel = (modelId: DecartVideoModelId) =>
		new DecartVideoModel(modelId, {
			provider: "decart.video",
			url: ({ path, modelId }) => `${baseURL}/${path}/${modelId}`,
			baseURL: baseURL ?? defaultBaseURL,
			headers: getHeaders,
			fetch: options.fetch,
		});

	return {
		image: createImageModel,
		imageModel: createImageModel,
		video: createVideoModel,
		videoModel: createVideoModel,
		languageModel: (modelId: string) => {
			throw new NoSuchModelError({
				modelId,
				modelType: "languageModel",
			});
		},
		textEmbeddingModel: (modelId: string) => {
			throw new NoSuchModelError({
				modelId,
				modelType: "embeddingModel",
			});
		},
	};
}

export const decart = createDecart();
