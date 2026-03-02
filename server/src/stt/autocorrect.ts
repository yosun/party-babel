/**
 * STT Autocorrect: fixes common speech-recognition misspellings
 * for domain-specific terms (Voxtral, Mistral, Prisma, etc.).
 *
 * Built-in corrections handle the most common browser-STT garbles.
 * Users can add extra corrections via AUTOCORRECT_EXTRA env var
 * as a comma-separated list of "wrong=right" pairs, e.g.:
 *   AUTOCORRECT_EXTRA="box trail=Voxtral,miss trail=Mistral"
 */

// wrong (lowercase) → correct replacement
const BUILTIN_CORRECTIONS = new Map<string, string>([
  // Voxtral
  ['box trail', 'Voxtral'],
  ['vox trail', 'Voxtral'],
  ['box trawl', 'Voxtral'],
  ['vox trawl', 'Voxtral'],
  ['vox straw', 'Voxtral'],
  ['box straw', 'Voxtral'],
  ['vox trial', 'Voxtral'],
  ['box trial', 'Voxtral'],
  ['vox troll', 'Voxtral'],
  ['box troll', 'Voxtral'],
  ['boxtrail', 'Voxtral'],
  ['voxtrail', 'Voxtral'],
  ['voxtrol', 'Voxtral'],
  ['vox tall', 'Voxtral'],
  ['boxtroll', 'Voxtral'],
  ['box troll flow', 'Voxtral Flow'],
  ['boxtroll flow', 'Voxtral Flow'],
  ['boxer flow', 'Voxtral Flow'],
  ['foxtrol', 'Voxtral'],
  ['foxtrol flow', 'Voxtral Flow'],
  ['fox troll', 'Voxtral'],
  ['fox troll flow', 'Voxtral Flow'],
  ['voxtral flow', 'Voxtral Flow'],
  ['vox trail flow', 'Voxtral Flow'],
  ['box trail flow', 'Voxtral Flow'],

  // Mistral
  ['miss trail', 'Mistral'],
  ['miss trawl', 'Mistral'],
  ['mist trail', 'Mistral'],
  ['mist rail', 'Mistral'],
  ['miss trial', 'Mistral'],
  ['mist trial', 'Mistral'],
  ['mistrail', 'Mistral'],
  ['miss troll', 'Mistral'],
  ['mist role', 'Mistral'],
  ['mist raw', 'Mistral'],

  // Prisma
  ['prism a', 'Prisma'],
  ['prism ah', 'Prisma'],
  ['prison a', 'Prisma'],

  // Mermaid
  ['mer maid', 'Mermaid'],
  ['mare made', 'Mermaid'],

  // WebSocket
  ['web socket', 'WebSocket'],

  // PostgreSQL / Postgres
  ['post gres', 'Postgres'],
  ['post grass', 'Postgres'],
  ['post grease', 'Postgres'],

  // Redis
  ['red is', 'Redis'],
  ['read us', 'Redis'],

  // Kanban
  ['con bon', 'Kanban'],
  ['can ban', 'Kanban'],

  // ORM
  ['oh are em', 'ORM'],
  ['o r m', 'ORM'],
]);

let corrections: Map<string, string> | null = null;

function getCorrections(): Map<string, string> {
  if (corrections) return corrections;

  corrections = new Map(BUILTIN_CORRECTIONS);

  // Parse user-supplied extra corrections
  const extra = process.env.AUTOCORRECT_EXTRA;
  if (extra) {
    for (const pair of extra.split(',')) {
      const eq = pair.indexOf('=');
      if (eq > 0) {
        const wrong = pair.slice(0, eq).trim().toLowerCase();
        const right = pair.slice(eq + 1).trim();
        if (wrong && right) corrections.set(wrong, right);
      }
    }
  }

  return corrections;
}

/**
 * Apply autocorrect to transcript text.
 * Replaces known STT mistakes with correct spellings (case-insensitive match).
 */
export function autocorrect(text: string): string {
  const map = getCorrections();
  let result = text;

  for (const [wrong, right] of map) {
    // Case-insensitive replacement, preserving surrounding text
    const re = new RegExp(escapeRegex(wrong), 'gi');
    result = result.replace(re, right);
  }

  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
