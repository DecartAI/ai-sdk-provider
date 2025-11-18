import "dotenv/config";
import { presentImages } from "./lib/present-image";

export async function runAll() {
	const tasks = [await import("./tasks/image-generation")];

	for (const task of tasks) {
		const result = await task.run();
		await presentImages(result.images);
	}
}

runAll().catch(console.error);
