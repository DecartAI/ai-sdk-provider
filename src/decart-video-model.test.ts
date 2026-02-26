import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { describe, expect, it, vi } from "vitest";
import { DecartVideoModel } from "./decart-video-model";
import { createDecart } from "./decart-provider";

vi.mock("./version", () => ({ VERSION: "0.0.0-test" }));

const prompt = "An astronaut riding a horse on Mars";
const testJobId = "test-job-123";
const provider = createDecart({ apiKey: "test-api-key" });
const model = provider.video("lucy-pro-t2v");

const server = createTestServer({
	"https://api.decart.ai/v1/jobs/lucy-pro-t2v": {},
	"https://api.decart.ai/v1/jobs/lucy-pro-i2v": {},
	[`https://api.decart.ai/v1/jobs/${testJobId}`]: {},
	[`https://api.decart.ai/v1/jobs/${testJobId}/content`]: {},
});

function prepareResponses(submitHeaders?: Record<string, string>) {
	server.urls["https://api.decart.ai/v1/jobs/lucy-pro-t2v"].response = {
		type: "json-value",
		headers: submitHeaders,
		body: { job_id: testJobId, status: "pending" },
	};
	server.urls["https://api.decart.ai/v1/jobs/lucy-pro-i2v"].response = {
		type: "json-value",
		body: { job_id: testJobId, status: "pending" },
	};
	server.urls[`https://api.decart.ai/v1/jobs/${testJobId}`].response = {
		type: "json-value",
		body: { job_id: testJobId, status: "completed" },
	};
	server.urls[`https://api.decart.ai/v1/jobs/${testJobId}/content`].response = {
		type: "binary",
		body: Buffer.from("test-video-data"),
	};
}

type GenerateOptions = Parameters<typeof model.doGenerate>[0];

function generate(overrides: Partial<GenerateOptions> = {}, targetModel = model) {
	return targetModel.doGenerate({
		prompt,
		n: 1,
		aspectRatio: undefined,
		resolution: undefined,
		duration: undefined,
		fps: undefined,
		seed: undefined,
		image: undefined,
		providerOptions: {},
		...overrides,
	} as GenerateOptions);
}

describe("doGenerate", () => {
	it("should pass the prompt in FormData", async () => {
		prepareResponses();
		await generate();

		expect(await server.calls[0].requestBodyMultipart).toStrictEqual({ prompt });
	});

	it("should pass seed in FormData", async () => {
		prepareResponses();
		await generate({ seed: 42 });

		expect(await server.calls[0].requestBodyMultipart).toStrictEqual({ prompt, seed: "42" });
	});

	it("should convert aspectRatio 16:9 to landscape orientation", async () => {
		prepareResponses();
		await generate({ aspectRatio: "16:9" });

		expect(await server.calls[0].requestBodyMultipart).toStrictEqual({
			prompt,
			orientation: "landscape",
		});
	});

	it("should convert aspectRatio 9:16 to portrait orientation", async () => {
		prepareResponses();
		await generate({ aspectRatio: "9:16" });

		expect(await server.calls[0].requestBodyMultipart).toStrictEqual({
			prompt,
			orientation: "portrait",
		});
	});

	it("should convert resolution to 720p/480p format", async () => {
		prepareResponses();
		await generate({ resolution: "1280x720" });

		expect(await server.calls[0].requestBodyMultipart).toStrictEqual({
			prompt,
			resolution: "720p",
		});
	});

	it("should pass headers from provider and request", async () => {
		prepareResponses();
		const customProvider = createDecart({
			apiKey: "test-api-key",
			headers: { "Custom-Provider-Header": "provider-header-value" },
		});

		await generate(
			{ headers: { "Custom-Request-Header": "request-header-value" } },
			customProvider.video("lucy-pro-t2v"),
		);

		expect(server.calls[0].requestHeaders).toMatchObject({
			"x-api-key": "test-api-key",
			"custom-provider-header": "provider-header-value",
			"custom-request-header": "request-header-value",
		});
		expect(server.calls[0].requestUserAgent).toContain("ai-sdk/decart/0.0.0-test");
	});

	it("should return video as binary with correct metadata", async () => {
		const testDate = new Date("2024-03-15T12:00:00Z");
		prepareResponses({ "x-request-id": "test-request-id" });

		const customModel = new DecartVideoModel("lucy-pro-t2v", {
			provider: "test-provider",
			baseURL: "https://api.decart.ai",
			url: ({ path, modelId }) => `https://api.decart.ai/${path}/${modelId}`,
			headers: () => ({ "x-api-key": "test-key" }),
			_internal: { currentDate: () => testDate },
		});

		const result = await generate({}, customModel);

		expect(result.videos).toHaveLength(1);
		expect(result.videos[0]).toStrictEqual({
			type: "binary",
			data: expect.any(Uint8Array),
			mediaType: "video/mp4",
		});
		expect(result.response).toStrictEqual({
			timestamp: testDate,
			modelId: "lucy-pro-t2v",
			headers: expect.objectContaining({ "x-request-id": "test-request-id" }),
		});
	});

	it("should return warnings for unsupported settings", async () => {
		prepareResponses();
		const result = await generate({
			aspectRatio: "4:3",
			resolution: "1920x1080",
			duration: 5,
			fps: 30,
		});

		expect(result.warnings).toStrictEqual([
			{ type: "unsupported", feature: "aspectRatio", details: "Only 16:9 and 9:16 aspect ratios are supported." },
			{ type: "unsupported", feature: "resolution", details: "Only 720p and 480p resolutions are supported." },
			{ type: "unsupported", feature: "fps" },
			{ type: "unsupported", feature: "duration" },
		]);
	});

	it("should pass image input for i2v models via URL", async () => {
		prepareResponses();
		await generate(
			{ image: { type: "url", url: "https://example.com/image.jpg" } },
			provider.video("lucy-pro-i2v"),
		);

		expect(await server.calls[0].requestBodyMultipart).toStrictEqual({
			prompt,
			data: "https://example.com/image.jpg",
		});
	});

	it("should pass trajectory via providerOptions for motion model", async () => {
		prepareResponses();
		const trajectory = [
			{ frame: 0, x: 100, y: 200 },
			{ frame: 25, x: 300, y: 400 },
		];

		await generate({
			prompt: undefined,
			image: { type: "url", url: "https://example.com/image.jpg" },
			providerOptions: { decart: { trajectory } },
		});

		expect(await server.calls[0].requestBodyMultipart).toStrictEqual({
			data: "https://example.com/image.jpg",
			trajectory: JSON.stringify(trajectory),
		});
	});

	it("should allow orientation override via providerOptions", async () => {
		prepareResponses();
		await generate({
			aspectRatio: "16:9",
			providerOptions: { decart: { orientation: "portrait" } },
		});

		expect(await server.calls[0].requestBodyMultipart).toStrictEqual({
			prompt,
			orientation: "portrait",
		});
	});
});

describe("constructor", () => {
	it("should expose correct provider and model information", () => {
		expect(model.provider).toBe("decart.video");
		expect(model.modelId).toBe("lucy-pro-t2v");
		expect(model.specificationVersion).toBe("v3");
		expect(model.maxVideosPerCall).toBe(1);
	});
});
