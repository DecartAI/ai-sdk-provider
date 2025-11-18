import { decart } from "@decartai/ai-sdk-provider";
import { experimental_generateImage as generateImage } from "ai";

export async function run() {
	const result = await generateImage({
		model: decart.image("lucy-pro-t2i"),
		prompt: "Three dogs playing in the snow",
	});
	return result;
}
