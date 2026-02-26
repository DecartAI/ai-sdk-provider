import { decart } from "@decartai/ai-sdk-provider";
import { experimental_generateVideo } from "ai";

export const modelId = "lucy-motion";

export async function run(image: Uint8Array) {
	const result = await experimental_generateVideo({
		model: decart.video("lucy-motion"),
		prompt: {
			image,
			text: "The subject moves along the specified path",
		},
		providerOptions: {
			decart: {
				trajectory: [
					{ frame: 0, x: 0.5, y: 0.5 },
					{ frame: 12, x: 0.7, y: 0.9 },
					{ frame: 25, x: 0.3, y: 0.1 },
				],
			},
		},
	});
	return result;
}
