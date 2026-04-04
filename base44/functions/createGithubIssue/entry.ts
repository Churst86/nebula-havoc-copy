import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

    const response = await fetch('https://api.github.com/repos/Churst86/Audio-/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Missing audio files — all MP3s returning 404',
        body: `## Bug Report: Missing Audio Files

All background music tracks in the Nebula Havok game are returning **404 Not Found**.

### Affected Files
- \`Brave Pilots.mp3\` (title screen music)
- \`Defeated.mp3\` (game over music)
- \`DeathMatch.mp3\` (boss battle music)
- \`Victory Tune.mp3\` (win screen music)
- \`SkyFire.mp3\` (stage/wave music)

### Impact
The game has no background music at all. The \`Audio HTMLElement\` silently fails because the URLs resolve to 404.

### Steps to Reproduce
1. Navigate to the Nebula Havok game.
2. Click "Start Game".
3. No music plays.

### Expected Behavior
Each screen and game phase should play its corresponding background track.

### Notes
The raw GitHub URLs (e.g. \`https://raw.githubusercontent.com/Churst86/Audio-/main/Brave%20Pilots.mp3\`) all return 404. The repository may have been deleted, renamed, or the files may have been removed.

Please re-upload the missing MP3 files or update the audio URLs in the game.`,
        labels: ['bug', 'audio'],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data.message || 'GitHub API error', details: data }, { status: response.status });
    }

    return Response.json({ success: true, issue_url: data.html_url, issue_number: data.number });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});