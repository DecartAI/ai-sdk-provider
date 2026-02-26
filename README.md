# AI SDK - Decart Provider

The **Decart provider** for the [AI SDK](https://ai-sdk.dev/docs) contains support for [Decart](https://decart.ai)'s image and video generation models.

## Setup

The Decart provider is available in the `@decartai/ai-sdk-provider` module. You can install it with:

```bash
npm i @decartai/ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `decart` from `@decartai/ai-sdk-provider`:

```ts
import { decart } from '@decartai/ai-sdk-provider';
```

If you need a customized setup, you can import `createDecart` and create a provider instance with your settings:

```ts
import { createDecart } from '@decartai/ai-sdk-provider';

const decart = createDecart({
  apiKey: 'your-api-key', // optional, defaults to DECART_API_KEY environment variable
  baseURL: 'custom-url', // optional
  headers: {
    /* custom headers */
  }, // optional
});
```

You can use the following optional settings to customize the Decart provider instance:

- **baseURL** _string_

  Use a different URL prefix for API calls, e.g. to use proxy servers.
  The default prefix is `https://api.decart.ai`.

- **apiKey** _string_

  API key that is being sent using the `X-API-KEY` header.
  It defaults to the `DECART_API_KEY` environment variable.

- **headers** _Record&lt;string,string&gt;_

  Custom headers to include in the requests.

- **fetch** _(input: RequestInfo, init?: RequestInit) => Promise&lt;Response&gt;_

  Custom [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) implementation.
  You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.

## Image Models

You can create Decart image models using the `.image()` factory method.
For more on image generation with the AI SDK see [generateImage()](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image).

### Basic Usage

```ts
import { decart } from '@decartai/ai-sdk-provider';
import { generateImage } from 'ai';
import fs from 'fs';

const { image } = await generateImage({
  model: decart.image('lucy-pro-t2i'),
  prompt: 'Three dogs playing in the snow',
});

const filename = `image-${Date.now()}.png`;
fs.writeFileSync(filename, image.uint8Array);
console.log(`Image saved to ${filename}`);
```

### Model Capabilities

Decart currently offers:

| Model          | Description                                 |
| -------------- | ------------------------------------------- |
| `lucy-pro-t2i` | High-quality text-to-image generation model |

The model supports the following aspect ratios:

- 16:9 (landscape)
- 9:16 (portrait)

<Note>
  Other aspect ratios will generate a warning and fall back to the default
  behavior.
</Note>

### Image Model Settings

You can customize the generation behavior with optional settings:

```ts
const { image } = await generateImage({
  model: decart.image('lucy-pro-t2i'),
  prompt: 'Three dogs playing in the snow',
  aspectRatio: '16:9',
  seed: 42,
});
```

Supported settings:

- **aspectRatio** _string_

  Control the aspect ratio of the generated image. Supported values: `16:9` (landscape) and `9:16` (portrait).

- **seed** _number_

  Set a seed value for reproducible results.

## Video Models

You can create Decart video models using the `.video()` factory method.
For more on video generation with the AI SDK see [experimental_generateVideo()](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-video).

### Text-to-Video

```ts
import { decart } from '@decartai/ai-sdk-provider';
import { experimental_generateVideo as generateVideo } from 'ai';
import fs from 'fs';

const { videos } = await generateVideo({
  model: decart.video('lucy-pro-t2v'),
  prompt: 'A man is riding a horse in a field',
});

fs.writeFileSync('video.mp4', videos[0].uint8Array);
```

### Image-to-Video

Pass an image to animate it into a video:

```ts
const { videos } = await generateVideo({
  model: decart.video('lucy-pro-i2v'),
  prompt: {
    image: imageData, // Uint8Array from a previous generateImage call
    text: 'The subject begins to walk forward slowly',
  },
});
```

### Motion Control

Use `lucy-motion` with a trajectory to control camera or subject movement:

```ts
const { videos } = await generateVideo({
  model: decart.video('lucy-motion'),
  prompt: {
    image: imageData,
    text: 'The subject moves along the specified path',
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
```

### Model Capabilities

| Model          | Description                                          |
| -------------- | ---------------------------------------------------- |
| `lucy-pro-t2v` | Text-to-video generation                             |
| `lucy-pro-i2v` | Image-to-video generation                            |
| `lucy-dev-i2v` | Image-to-video generation (dev)                      |
| `lucy-motion`  | Image-to-video with trajectory-based motion control  |

### Video Model Settings

```ts
const { videos } = await generateVideo({
  model: decart.video('lucy-pro-t2v'),
  prompt: 'A sunset over the ocean',
  aspectRatio: '16:9',
  seed: 42,
});
```

Supported settings:

- **aspectRatio** _string_

  Control the aspect ratio. Supported values: `16:9` (landscape) and `9:16` (portrait).

- **seed** _number_

  Set a seed value for reproducible results.

- **resolution** _string_

  Video resolution. Supported values: `1280x720` (720p) and `854x480` (480p).

### Provider Options

Pass Decart-specific options via `providerOptions.decart`:

- **trajectory** _Array<{ frame: number; x: number; y: number }>_

  Motion path for `lucy-motion`. Each point specifies a frame number and normalized x,y coordinates.

- **orientation** _"landscape" | "portrait"_

  Override orientation directly instead of deriving from `aspectRatio`.

## Learn More

For more details about Decart's capabilities and features, visit [Decart AI](https://decart.ai).
