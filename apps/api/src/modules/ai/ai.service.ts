import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ArchetypeNamingInput {
  peakHour: number;
  peakDayOfWeek: number;
  dominantMoods: string[];
  topTracks: string[];
  playCount: number;
}

export interface ArchetypeNamingResult {
  name: string;
  description: string;
  color: string;
  icon: string;
}

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

  async nameArchetype(
    input: ArchetypeNamingInput,
  ): Promise<ArchetypeNamingResult> {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const hourLabel =
      input.peakHour < 12
        ? `${input.peakHour === 0 ? 12 : input.peakHour}am`
        : input.peakHour === 12
          ? '12pm'
          : `${input.peakHour - 12}pm`;

    const prompt = `You are a perceptive music observer. Below is a cluster of one listener's plays. Generate a persona.

Cluster summary:
- Peak hour: ${hourLabel}
- Peak day: ${days[input.peakDayOfWeek]}
- Dominant moods: ${input.dominantMoods.join(', ')}
- Top tracks: ${input.topTracks.slice(0, 5).join('; ')}
- Total plays: ${input.playCount}

Return JSON only — no prose, no markdown:
{
  "name": "The [3-6 words, evocative, specific — not generic vibes]",
  "description": "[1-2 sentences in second person, like 'sad indie played late after a heavy day']",
  "color": "#hex (a single color that captures the mood)",
  "icon": "tabler-icon-name (e.g. 'moon', 'coffee', 'bolt', 'vinyl', 'headphones', 'music', 'flame', 'wave-sine', 'cloud', 'star')"
}

Examples of good names: "The 11pm wound-licker", "The Sunday morning archivist", "The Thursday DJ".
Examples of bad names: "Late night vibes", "Sad music lover", "Energy boost playlist".`;

    const result = await this.model.generateContent(prompt);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    let parsed: ArchetypeNamingResult;
    try {
      parsed = JSON.parse(cleaned) as ArchetypeNamingResult;
    } catch {
      this.logger.error(`Failed to parse Gemini archetype response: ${raw}`);
      throw new Error('Gemini returned invalid JSON for archetype naming');
    }

    if (
      typeof parsed.name !== 'string' ||
      typeof parsed.description !== 'string' ||
      typeof parsed.color !== 'string' ||
      typeof parsed.icon !== 'string'
    ) {
      throw new Error('Gemini archetype response missing required fields');
    }

    return parsed;
  }
}
