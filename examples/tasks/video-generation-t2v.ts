import { decart } from "@decartai/ai-sdk-provider";
import { experimental_generateVideo } from "ai";

export const modelId = "lucy-pro-t2v";

export async function run() {
	const result = await experimental_generateVideo({
		model: decart.video("lucy-pro-t2v"),
		prompt: "A man is riding a horse in a field",
	});
	return result;
}
