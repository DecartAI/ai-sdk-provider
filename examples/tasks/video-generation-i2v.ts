import { decart } from "@decartai/ai-sdk-provider";
import { experimental_generateVideo } from "ai";

export const modelId = "lucy-pro-i2v";

export async function run(image: Uint8Array) {
	const result = await experimental_generateVideo({
		model: decart.video("lucy-pro-i2v"),
		prompt: {
			image,
			text: "The subject begins to walk forward slowly",
		},
	});
	return result;
}
