import { decart } from "@decartai/ai-sdk-provider";
import { experimental_generateVideo } from "ai";

export const modelId = "lucy-dev-i2v";

export async function run(image: Uint8Array) {
	const result = await experimental_generateVideo({
		model: decart.video("lucy-dev-i2v"),
		prompt: {
			image,
			text: "Camera slowly zooms in as the scene comes to life",
		},
	});
	return result;
}
