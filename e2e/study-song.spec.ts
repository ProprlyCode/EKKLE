import { expect, test, type Page } from '@playwright/test';
import { admin as service, OWEN, PLATFORM, SARAH } from './support/supabase';
import { expandAll } from './support/ui';

/**
 * A song for a study's Experience section (0040, audio only): the Ekklē team
 * adds a SoundCloud song to a study; a Leader previewing it is offered the
 * song at Experience (nothing plays until they tap), swaps in their own
 * uploaded recording, then turns it off for their ministry.
 */

async function toExperience(page: Page) {
  for (let i = 0; i < 15; i++) {
    if (await page.getByRole('button', { name: /Listen while you reflect/ }).isVisible()) return;
    await page.getByRole('button', { name: 'Next page' }).click();
  }
}

test('a song at the Experience section: added by Ekklē, turned off by a ministry', async ({ browser }) => {
  const db = service();
  const { data: love } = await db.from('studies').select('id').eq('title', 'The Logic of Love').single();
  try {
    const owen = await (await browser.newContext()).newPage();
    await owen.goto(`${PLATFORM}sign-in`);
    await owen.getByLabel('Email').fill(OWEN.email);
    await owen.getByLabel('Password').fill(OWEN.password);
    await owen.getByRole('button', { name: 'Sign in' }).click();
    await owen.waitForURL('**/platform');
    await owen.goto(`${PLATFORM}platform/studies/${love!.id}`);
    await owen.getByRole('button', { name: 'Add a song' }).click();
    await owen.getByLabel('SoundCloud link').fill('https://example.com/not-soundcloud');
    await expect(owen.getByText('Paste the song’s soundcloud.com link')).toBeVisible();
    await owen.getByLabel('SoundCloud link').fill('https://soundcloud.com/some-artist/a-quiet-song?si=abc');
    await owen.getByLabel('Song title').fill('A Quiet Song');
    await owen.getByLabel('Artist').fill('Some Artist');
    await owen.getByRole('button', { name: 'Save song' }).click();
    await expect(owen.getByText('A Quiet Song — Some Artist')).toBeVisible();

    // A Leader previews the study: the song is offered at Experience.
    const sarah = await (await browser.newContext()).newPage();
    await sarah.goto('/sign-in');
    await sarah.getByRole('button', { name: 'Use a password instead' }).click();
    await sarah.getByLabel('Email').fill(SARAH.email);
    await sarah.getByLabel('Password').fill(SARAH.password);
    await sarah.getByRole('button', { name: 'Sign in' }).click();
    await sarah.waitForURL('**/app');
    await sarah.goto(`/leadership/studies/${love!.id}`);
    await expect(sarah.getByRole('button', { name: /Listen while you reflect/ })).toHaveCount(0); // not before
    await toExperience(sarah);
    await sarah.getByRole('button', { name: /Listen while you reflect/ }).click();
    const player = sarah.getByRole('region', { name: 'Song' });
    await expect(player.locator('iframe')).toHaveAttribute(
      'src',
      /w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Fsome-artist%2Fa-quiet-song&auto_play=true/,
    );
    // It stays through the page turns.
    await sarah.getByRole('button', { name: 'Next page' }).click();
    await expect(player).toBeVisible();

    // The ministry turns it off.
    await sarah.goto('/leadership/resources');
    await expandAll(sarah);
    const row = sarah.getByRole('listitem').filter({ hasText: 'The Logic of Love' });
    await expect(row).toContainText('Song: A Quiet Song — Some Artist');
    await row.getByRole('button', { name: 'Song for The Logic of Love' }).click();
    // Their own recording, uploaded.
    await row.getByRole('button', { name: 'Use our own song' }).click();
    await row.getByLabel('Upload a file').check();
    await row.getByLabel('Audio file').setInputFiles({
      name: 'our-song.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('ID3 test audio'),
    });
    await expect(row.getByText('Uploaded.')).toBeVisible();
    await row.getByLabel('Song title').fill('Our Song');
    await row.getByRole('button', { name: 'Use this song' }).click();
    await expect(row).toContainText('Song: Our Song (your own)');
    // …or none.
    await row.getByRole('button', { name: 'Song for The Logic of Love' }).click();
    await row.getByRole('button', { name: 'No song' }).click();
    await expect(row).toContainText('Song: none (turned off)');
  } finally {
    await db.from('ministry_study_songs').delete().eq('study_id', love!.id);
    await db.from('studies').update({ song: null }).eq('id', love!.id);
  }
});
