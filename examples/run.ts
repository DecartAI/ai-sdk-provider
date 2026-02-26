import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { presentImages } from "./lib/present-image";

const OUTPUT_DIR = path.resolve(__dirname, "./output");

function saveVideo(modelId: string, data: Uint8Array): string {
	mkdirSync(OUTPUT_DIR, { recursive: true });
	const filePath = path.join(OUTPUT_DIR, `video-${modelId}-${Date.now()}.mp4`);
	writeFileSync(filePath, data);
	console.log(`  Saved -> ${filePath}`);
	return filePath;
}

export async function runAll() {
	console.log("\n[image] lucy-pro-t2i");
	const imageTask = await import("./tasks/image-generation");
	const imageResult = await imageTask.run();
	await presentImages(imageResult.images);
	const imageData = imageResult.images[0].uint8Array;

	console.log("\n[video] lucy-pro-t2v");
	const t2vTask = await import("./tasks/video-generation-t2v");
	const t2vResult = await t2vTask.run();
	saveVideo(t2vTask.modelId, t2vResult.videos[0].uint8Array);

	const i2vTasks = [
		await import("./tasks/video-generation-i2v"),
		await import("./tasks/video-generation-dev-i2v"),
		await import("./tasks/video-generation-motion"),
	] as const;

	for (const task of i2vTasks) {
		console.log(`\n[video] ${task.modelId}`);
		try {
			const result = await task.run(imageData);
			saveVideo(task.modelId, result.videos[0].uint8Array);
		} catch (error) {
			console.error(`  Failed ${task.modelId}:`, error);
		}
	}
}

runAll().catch(console.error);
