import type { FetchFunction } from "@ai-sdk/provider-utils";

export interface DecartModelConfig {
	provider: string;
	baseURL: string;
	url: (options: { modelId: string; path: string }) => string;
	headers: () => Record<string, string>;
	fetch?: FetchFunction;
	_internal?: {
		currentDate?: () => Date;
	};
}

export function convertAspectRatioToOrientation(
	aspectRatio: `${number}:${number}`,
): "portrait" | "landscape" | undefined {
	if (aspectRatio === "9:16") return "portrait";
	if (aspectRatio === "16:9") return "landscape";
	return undefined;
}
