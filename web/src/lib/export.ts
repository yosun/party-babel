import type { Utterance, RoomState } from '../hooks/useRoom';

/**
 * Export session data in various formats.
 */

export function exportMarkdown(roomState: RoomState, roomId: string): string {
  const lines: string[] = [
    `# Party Babel Session — ${roomId}`,
    `_Exported ${new Date().toISOString()}_`,
    '',
    '## Participants',
    ...roomState.users.map(u => `- **${u.displayName}** (speaks ${u.speakLang}, listens ${u.targetLang})`),
    '',
    '## Transcript',
  ];

  for (const u of roomState.utterances) {
    const speaker = roomState.users.find(usr => usr.userId === u.speakerId);
    lines.push(`**${speaker?.displayName || u.speakerId}**: ${u.text}`);
    for (const [lang, translation] of u.translations) {
      lines.push(`  _[${lang}]_ ${translation}`);
    }
    lines.push('');
  }

  if (roomState.tasks.length > 0) {
    lines.push('## Action Items');
    for (const bucket of ['Now', 'Next', 'Later'] as const) {
      const items = roomState.tasks.filter(t => t.bucket === bucket);
      if (items.length > 0) {
        lines.push(`### ${bucket}`);
        items.forEach(t => lines.push(`- [ ] ${t.title}`));
        lines.push('');
      }
    }
  }

  if (roomState.diagram) {
    lines.push('## Diagram');
    lines.push('```mermaid');
    lines.push(roomState.diagram.mermaidSource);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

export function exportJSON(roomState: RoomState, roomId: string): string {
  return JSON.stringify({
    roomId,
    exportedAt: new Date().toISOString(),
    users: roomState.users,
    utterances: roomState.utterances.map(u => ({
      ...u,
      translations: Object.fromEntries(u.translations),
    })),
    entities: Object.fromEntries(roomState.entities),
    relations: roomState.relations,
    tasks: roomState.tasks,
    diagram: roomState.diagram,
    worldVersion: roomState.worldVersion,
  }, null, 2);
}

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
