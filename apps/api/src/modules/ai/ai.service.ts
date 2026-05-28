import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TrackEnrichmentInput {
  name: string;
  artist: string;
  album: string;
  year?: number;
}

export interface TrackEnrichmentResult {
  mood_tags: string[];
  mood_category: string;
  energy: number;
  vibe_vector: number[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly model;

  constructor(private readonly config: ConfigService) {
    const genAI = new GoogleGenerativeAI(config.getOrThrow('GEMINI_API_KEY'));
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async enrichTrack(input: TrackEnrichmentInput): Promise<TrackEnrichmentResult> {
    const yearStr = input.year ? ` (${input.year})` : '';
    const prompt = `You are a music taxonomist. Given this track, return ONLY a JSON object — no prose, no markdown.

Track: "${input.name}" by ${input.artist}
Album: "${input.album}"${yearStr}

Return:
{
  "mood_tags": [3-5 evocative one-word tags like "melancholy", "patient", "euphoric"],
  "mood_category": one of ["melancholy", "warm", "peak", "hypnotic", "euphoric", "contemplative"],
  "energy": number 0-10 (10 = peak-time techno, 1 = ambient drone),
  "vibe_vector": array of exactly 8 numbers from -1 to 1 representing the track's position in vibe space
}`;

    const result = await this.model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip markdown code fences if Gemini wraps the response
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    let parsed: TrackEnrichmentResult;
    try {
      parsed = JSON.parse(cleaned) as TrackEnrichmentResult;
    } catch {
      this.logger.error(`Failed to parse Gemini response for "${input.name}": ${raw}`);
      throw new Error('Gemini returned invalid JSON');
    }

    // Basic validation
    if (
      !Array.isArray(parsed.mood_tags) ||
      typeof parsed.mood_category !== 'string' ||
      typeof parsed.energy !== 'number' ||
      !Array.isArray(parsed.vibe_vector) ||
      parsed.vibe_vector.length !== 8
    ) {
      this.logger.error(`Gemini response missing fields for "${input.name}": ${cleaned}`);
      throw new Error('Gemini response missing required fields');
    }

    return parsed;
  }
}
