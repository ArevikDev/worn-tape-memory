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
  style_tags: string[];
  similar_artists: string[];
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
  genre_tags: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly groqApiKey: string | null;
  private readonly geminiModel: ReturnType<
    InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']
  > | null;

  constructor(private readonly config: ConfigService) {
    this.groqApiKey = config.get<string>('GROQ_API_KEY') ?? null;

    const geminiKey = config.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      this.geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite',
      });
    } else {
      this.geminiModel = null;
    }

    const providers = [this.groqApiKey ? 'Groq' : null, this.geminiModel ? 'Gemini' : null]
      .filter(Boolean)
      .join(' → ');
    this.logger.log(`AI providers: ${providers || 'none (rule-based fallback only)'}`);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async enrichTrack(input: TrackEnrichmentInput): Promise<TrackEnrichmentResult> {
    const yearStr = input.year ? ` (${input.year})` : '';
    const prompt = `You are a music taxonomist. Given this track, return ONLY a JSON object — no prose, no markdown.

Track: "${input.name}" by ${input.artist}
Album: "${input.album}"${yearStr}

Return:
{
  "mood_tags": [3-5 evocative one-word tags like "melancholy", "patient", "euphoric"],
  "mood_category": one of ["melancholy", "warm", "peak", "hypnotic", "euphoric", "contemplative", "nostalgic", "dreamy", "tense", "serene", "raw", "bittersweet", "electric", "tender", "brooding"],
  "energy": number 0-10 (10 = peak-time techno, 1 = ambient drone),
  "vibe_vector": array of exactly 8 numbers from -1 to 1 representing the track's position in vibe space,
  "genre_tags": [2-4 genre/style keywords, lowercase, specific — e.g. "darkwave", "trip-hop", "minimal techno", "post-punk", "shoegaze", "lo-fi hip-hop", "jazz fusion"]
}`;

    const raw = await this.generateText(prompt);
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    let parsed: TrackEnrichmentResult;
    try {
      parsed = JSON.parse(cleaned) as TrackEnrichmentResult;
    } catch {
      this.logger.error(`Failed to parse AI response for "${input.name}": ${raw}`);
      throw new Error('AI returned invalid JSON for enrichment');
    }

    if (
      !Array.isArray(parsed.mood_tags) ||
      typeof parsed.mood_category !== 'string' ||
      typeof parsed.energy !== 'number' ||
      !Array.isArray(parsed.vibe_vector) ||
      parsed.vibe_vector.length !== 8
    ) {
      this.logger.error(`AI response missing fields for "${input.name}": ${cleaned}`);
      throw new Error('AI response missing required fields');
    }

    // genre_tags is optional — default to empty if AI omits it
    if (!Array.isArray(parsed.genre_tags)) parsed.genre_tags = [];

    return parsed;
  }

  async nameArchetype(input: ArchetypeNamingInput): Promise<ArchetypeNamingResult> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hourLabel =
      input.peakHour < 12
        ? `${input.peakHour === 0 ? 12 : input.peakHour}am`
        : input.peakHour === 12
          ? '12pm'
          : `${input.peakHour - 12}pm`;

    const prompt = `You are a sharp music writer. A listener has a distinct listening cluster. Describe it like a good friend who's noticed the habit — grounded, specific, a little wry.

Cluster:
- Peak hour: ${hourLabel}
- Peak day: ${days[input.peakDayOfWeek]}
- Dominant moods: ${input.dominantMoods.join(', ')}
- Top tracks: ${input.topTracks.slice(0, 5).join('; ')}
- Total plays: ${input.playCount}

RULES for the description — one sentence, second person:
- Name the actual genre, sound, or texture — not abstract feelings
- Reference the time/day if it's distinctive
- BANNED: "find solace", "as if", "mirror", "amplify", "journey", "cathartic", "soundscape", "speaks to you"
- Good: "Hard techno and industrial past midnight on Saturdays — you're not going to bed yet."
- Good: "Jangly guitars on Monday lunches, the kind that make the afternoon feel manageable."
- Good: "Slow drone and ambient stuff on Sunday nights, volume low, lights off."
- Bad: "You find solace in the dark soundscapes that fuel your introspection."

Return JSON only — no prose, no markdown:
{
  "name": "The [2-4 words. NO day-of-week, NO time-of-day. Combine a genre/style word (shoegaze, IDM, darkwave, dub, breakbeat, drone, motorik, vaporwave, etc — pick from the actual tracks/moods) with either a vivid adjective or a nerdy music-production/DJ term (sidechain, arpeggiator, low-pass, tape hiss, reverb tail, sub-bass, quantize, crossfade). Vary the structure each time — don't force the same word order or pattern across archetypes. Good: 'Murky Shoegaze ', 'Glacial IDM ', 'Acidic Breakbeat ', 'Velvet Dub ', 'Motorik Tape '. BANNED generic vibe words: haze, glow, drift, groove, surge, wave, vibe, flow, pulse, bloom, echo, rewind, unravel — and anything ending in Fan/Listener/Lover/Dreamer]",
  "description": "[one grounded sentence as above]",
  "color": "#hex",
  "icon": "one word from: moon coffee bolt vinyl headphones music flame cloud star sun heart",
  "style_tags": ["2-4 genre/style keywords, lowercase, no # prefix, e.g. darkwave, trip-hop, minimal techno, post-punk"],
  "similar_artists": ["3-4 real artist names whose sound fits this archetype — not artists already in the top tracks"]
}`;

    try {
      const raw = await this.generateText(prompt);
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

      let parsed: ArchetypeNamingResult;
      try {
        parsed = JSON.parse(cleaned) as ArchetypeNamingResult;
      } catch {
        this.logger.warn(`AI returned unparseable JSON for archetype, using fallback`);
        return this.nameArchetypeFallback(input);
      }

      if (
        typeof parsed.name !== 'string' ||
        typeof parsed.description !== 'string' ||
        typeof parsed.color !== 'string' ||
        typeof parsed.icon !== 'string'
      ) {
        return this.nameArchetypeFallback(input);
      }

      // optional fields — default to empty if AI omits them
      if (!Array.isArray(parsed.style_tags)) parsed.style_tags = [];
      if (!Array.isArray(parsed.similar_artists)) parsed.similar_artists = [];

      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`All AI providers failed for naming, using fallback: ${msg.slice(0, 120)}`);
      return this.nameArchetypeFallback(input);
    }
  }

  // ── Core text generation: Groq → Gemini ─────────────────────────────────

  private async generateText(prompt: string): Promise<string> {
    if (this.groqApiKey) {
      try {
        return await this.callGroq(prompt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Groq failed, trying Gemini: ${msg.slice(0, 100)}`);
      }
    }

    if (this.geminiModel) {
      const result = await this.geminiModel.generateContent(prompt);
      return result.response.text().trim();
    }

    throw new Error('No AI provider configured (set GROQ_API_KEY or GEMINI_API_KEY)');
  }

  private async callGroq(prompt: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0].message.content.trim();
  }

  // ── Rule-based fallback (no AI required) ────────────────────────────────

  private nameArchetypeFallback(input: ArchetypeNamingInput): ArchetypeNamingResult {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hourLabel =
      input.peakHour < 12
        ? `${input.peakHour === 0 ? 12 : input.peakHour}am`
        : input.peakHour === 12
          ? '12pm'
          : `${input.peakHour - 12}pm`;

    const mood = input.dominantMoods[0] ?? 'eclectic';

    const MOOD_CONFIGS: Record<string, { tag: string; color: string; icon: string; desc: string }> =
      {
        melancholy: {
          tag: 'wound-licker',
          color: '#6366f1',
          icon: 'moon',
          desc: 'Sad, slow music for processing the day.',
        },
        warm: {
          tag: 'comfort seeker',
          color: '#f59e0b',
          icon: 'coffee',
          desc: 'Familiar warmth. The playlist that feels like home.',
        },
        peak: {
          tag: 'momentum builder',
          color: '#ef4444',
          icon: 'bolt',
          desc: 'High-energy runs. You needed to move.',
        },
        hypnotic: {
          tag: 'trance rider',
          color: '#8b5cf6',
          icon: 'wave-sine',
          desc: 'Repetitive, deep, locked-in. You were somewhere else.',
        },
        euphoric: {
          tag: 'joy chaser',
          color: '#10b981',
          icon: 'flame',
          desc: 'Pure uplift. The music that made you feel it.',
        },
        contemplative: {
          tag: 'slow thinker',
          color: '#64748b',
          icon: 'cloud',
          desc: 'Patient and introspective. You were sitting with something.',
        },
        nostalgic: {
          tag: 'time traveler',
          color: '#c084fc',
          icon: 'vinyl',
          desc: 'Older sounds, music that pulls you back somewhere.',
        },
        dreamy: {
          tag: 'cloud drifter',
          color: '#38bdf8',
          icon: 'star',
          desc: 'Hazy, soft, unhurried. You were between here and elsewhere.',
        },
        tense: {
          tag: 'edge walker',
          color: '#f97316',
          icon: 'bolt',
          desc: 'Anxious energy, something building. You needed it to push through.',
        },
        serene: {
          tag: 'still point',
          color: '#34d399',
          icon: 'leaf',
          desc: 'Calm and clear. Nowhere to be, nothing to prove.',
        },
        raw: {
          tag: 'open nerve',
          color: '#dc2626',
          icon: 'flame',
          desc: 'Unfiltered and visceral. You let it hit.',
        },
        bittersweet: {
          tag: 'in-between',
          color: '#a78bfa',
          icon: 'heart',
          desc: 'Beautiful and a little sad. The feeling has no clean name.',
        },
        electric: {
          tag: 'live wire',
          color: '#facc15',
          icon: 'zap',
          desc: 'Charged and alive. Something broke open.',
        },
        tender: {
          tag: 'soft hour',
          color: '#fb7185',
          icon: 'feather',
          desc: 'Gentle and close. Low volume, high feeling.',
        },
        brooding: {
          tag: 'deep current',
          color: '#475569',
          icon: 'moon',
          desc: 'Heavy and atmospheric. You were inside your own head.',
        },
      };

    const cfg = MOOD_CONFIGS[mood] ?? {
      tag: 'listener',
      color: '#71717a',
      icon: 'headphones',
      desc: 'A distinct corner of your listening.',
    };

    return {
      name: `The ${hourLabel} ${cfg.tag}`,
      description: `${cfg.desc} Peaks on ${days[input.peakDayOfWeek]}s around ${hourLabel}. ${input.playCount} plays.`,
      color: cfg.color,
      icon: cfg.icon,
      style_tags: [],
      similar_artists: [],
    };
  }
}
