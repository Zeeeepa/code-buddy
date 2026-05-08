/**
 * Face Recognizer — InsightFace Buffalo_S (ArcFace) via ONNX Runtime Node.
 *
 * Lives in the main process: `onnxruntime-node` is a native binding,
 * the model file (~13 MB) is read from disk, and the embedding is
 * matched against the JSON store next door — none of which the renderer
 * can do.
 *
 * Pipeline expected from a caller:
 *   renderer detects face (MediaPipe)
 *     → renderer crops the bounding box from the video frame to 112×112
 *     → renderer sends the raw RGB Uint8Array via IPC
 *     → main calls `recognizer.encode(rgbBytes)` to get a 512-dim
 *       L2-normalised Float32Array
 *     → main calls `presenceStore.match(embedding)` to find the person
 *
 * Why Buffalo_S over Buffalo_L:
 *   - 13 MB vs 280 MB — bundles cleanly with the Electron app
 *   - Sub-millisecond inference on CPU on modern hardware
 *   - 512-dim ArcFace, same recognition accuracy ceiling as Buffalo_L
 *     for our use case (≤10 enrolled identities, frontal faces, normal
 *     indoor lighting)
 *
 * Model expected at `<userData>/models/buffalo_s.onnx`. If absent on
 * first call, `recognizer.encode` throws — the renderer should surface
 * an "install model" prompt to the user. We don't auto-download to keep
 * the trust boundary explicit; download-on-demand can come in V0.2 if
 * the manual flow turns out to be friction.
 *
 * @module cowork/main/presence/face-recognizer
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { log, logError } from '../utils/logger';
import type { FaceEmbedding } from '../../shared/presence/types';

/** Buffalo_S input tensor shape (NCHW). */
const INPUT_WIDTH = 112;
const INPUT_HEIGHT = 112;
const EMBEDDING_DIM = 512;

/**
 * The ONNX session type — declared minimally so we don't force the
 * `onnxruntime-node` import at top level (lazy import inside `initialize`).
 */
interface OrtSession {
  run: (
    feeds: Record<string, OrtTensor>,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, OrtTensor>>;
  release: () => Promise<void>;
}

interface OrtTensor {
  data: Float32Array;
  dims: number[];
}

export interface FaceRecognizerOptions {
  /** Override path to the Buffalo_S ONNX model file. */
  modelPath?: string;
  /** Number of CPU threads ORT may use. Default: half the cores. */
  intraOpThreads?: number;
}

export class FaceRecognizer {
  private session: OrtSession | null = null;
  private inputName = 'input.1';
  private outputName = '683';
  private readonly options: FaceRecognizerOptions;

  constructor(options: FaceRecognizerOptions = {}) {
    this.options = options;
  }

  /**
   * Default model path — `<userData>/models/buffalo_s.onnx`. Visible so
   * the UI can prompt the user with a stable target path when the file
   * is missing.
   */
  static defaultModelPath(): string {
    const userData = app.isReady() ? app.getPath('userData') : '';
    return path.join(userData, 'models', 'buffalo_s.onnx');
  }

  async initialize(): Promise<void> {
    if (this.session !== null) return;
    const modelPath = this.options.modelPath ?? FaceRecognizer.defaultModelPath();

    try {
      await fs.access(modelPath);
    } catch {
      throw new Error(
        `Buffalo_S model not found at ${modelPath}. Download it from ` +
          `https://github.com/deepinsight/insightface/tree/master/python-package ` +
          `(buffalo_s.zip → extract → place buffalo_s.onnx at the path above).`,
      );
    }

    // Lazy import — only paid for when face recognition is actually used.
    const ort = await import('onnxruntime-node');

    const sessionOptions: Record<string, unknown> = {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    };
    if (this.options.intraOpThreads !== undefined) {
      sessionOptions.intraOpNumThreads = this.options.intraOpThreads;
    }

    this.session = (await ort.InferenceSession.create(
      modelPath,
      sessionOptions,
    )) as unknown as OrtSession;

    // Probe the actual I/O names — ArcFace exports vary across releases
    // ("input.1" vs "data" vs "input") and outputs are usually a
    // numeric node id ("683", "frelu_v1") that we'd rather not hardcode.
    const sessionAny = this.session as unknown as {
      inputNames?: string[];
      outputNames?: string[];
    };
    if (sessionAny.inputNames?.[0]) this.inputName = sessionAny.inputNames[0];
    if (sessionAny.outputNames?.[0]) this.outputName = sessionAny.outputNames[0];

    log(
      `[FaceRecognizer] Buffalo_S loaded from ${modelPath} ` +
        `(input=${this.inputName}, output=${this.outputName})`,
    );
  }

  /**
   * Encode a 112×112 RGB face crop into a 512-dim L2-normalised embedding.
   *
   * Caller is responsible for the crop + resize. The renderer can do this
   * cheaply via `<canvas>` `drawImage` then `getImageData`. Sending the
   * raw `Uint8Array` over IPC is fine — 112×112×3 = 37 KB per frame.
   */
  async encode(rgbBytes: Uint8Array): Promise<FaceEmbedding> {
    if (this.session === null) {
      throw new Error('FaceRecognizer not initialized. Call initialize() first.');
    }
    if (rgbBytes.length !== INPUT_WIDTH * INPUT_HEIGHT * 3) {
      throw new Error(
        `FaceRecognizer.encode: expected ${INPUT_WIDTH * INPUT_HEIGHT * 3} bytes ` +
          `(${INPUT_WIDTH}×${INPUT_HEIGHT}×3 RGB), got ${rgbBytes.length}`,
      );
    }

    // Convert HWC uint8 [0..255] → CHW float32 [-1..1] (ArcFace pre-processing).
    const tensorData = new Float32Array(3 * INPUT_HEIGHT * INPUT_WIDTH);
    const channelSize = INPUT_HEIGHT * INPUT_WIDTH;
    for (let y = 0; y < INPUT_HEIGHT; y++) {
      for (let x = 0; x < INPUT_WIDTH; x++) {
        const srcIdx = (y * INPUT_WIDTH + x) * 3;
        const dstIdx = y * INPUT_WIDTH + x;
        tensorData[0 * channelSize + dstIdx] = (rgbBytes[srcIdx] - 127.5) / 128;
        tensorData[1 * channelSize + dstIdx] = (rgbBytes[srcIdx + 1] - 127.5) / 128;
        tensorData[2 * channelSize + dstIdx] = (rgbBytes[srcIdx + 2] - 127.5) / 128;
      }
    }

    const ort = await import('onnxruntime-node');
    const inputTensor = new ort.Tensor('float32', tensorData, [
      1,
      3,
      INPUT_HEIGHT,
      INPUT_WIDTH,
    ]);

    const results = await this.session.run({ [this.inputName]: inputTensor as unknown as OrtTensor });
    const output = results[this.outputName];
    if (!output || output.data.length !== EMBEDDING_DIM) {
      throw new Error(
        `FaceRecognizer.encode: unexpected output shape ${output?.data.length ?? 'undefined'} ` +
          `(expected ${EMBEDDING_DIM})`,
      );
    }

    return l2Normalise(output.data);
  }

  async dispose(): Promise<void> {
    if (this.session !== null) {
      try {
        await this.session.release();
      } catch (err) {
        logError(`[FaceRecognizer] Error releasing session: ${(err as Error).message}`);
      }
      this.session = null;
    }
  }

  /** True once `initialize()` has succeeded. Renderer uses this to gate the UI. */
  isReady(): boolean {
    return this.session !== null;
  }
}

/**
 * Normalise a vector to unit length. ArcFace expects normalised
 * embeddings for the cosine similarity in `presence-store.match` to
 * behave as designed (the dot product *is* the cosine for unit vectors).
 */
function l2Normalise(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

let singleton: FaceRecognizer | null = null;
export function getFaceRecognizer(): FaceRecognizer {
  if (singleton === null) singleton = new FaceRecognizer();
  return singleton;
}
