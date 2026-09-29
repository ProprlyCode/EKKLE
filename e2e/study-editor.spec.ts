import { expect, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { admin as service, OWEN, PLATFORM } from './support/supabase';
import { expandAll } from './support/ui';

/**
 * The study editor (Platform → Studies): the Owner starts a series, imports a
 * study from Word (pages, blanks and the answer table come across), fills the
 * missing answer, previews it — answers show after submitting — publishes it,
 * and locks the series.
 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const p = (...lines: string[]) =>
  `<w:p>${lines.map((l, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:t xml:space="preserve">${l}</w:t></w:r>`).join('')}</w:p>`;
const row = (...cells: string[]) => `<w:tr>${cells.map((c) => `<w:tc>${p(c)}</w:tc>`).join('')}</w:tr>`;

function studyDocx(): Buffer {
  const body =
    p('8  THE TEST STUDY', 'Discover', 'A study made for the tests.', 'God ______ the world.', 'Page 1 of 3') +
    p('A SECOND PAGE', 'And He ______ it.', 'Page 2 of 3') +
    p('Submit Answers') +
    `<w:tbl>${row('Submitted', 'Answer')}${row('', 'loved')}</w:tbl>`;
  const zip = zipSync({
    'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`),
  });
  return Buffer.from(zip);
}

test('import a study from Word, check it, preview, publish, lock the series', async ({ page }) => {
  const series = `Test series ${Date.now() % 1_000_000}`;
  try {
    await page.goto(`${PLATFORM}sign-in`);
    await page.getByLabel('Email').fill(OWEN.email);
    await page.getByLabel('Password').fill(OWEN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/platform');
    await page.getByRole('link', { name: 'Studies' }).click();
    await expect(page.getByRole('heading', { name: 'Studies', exact: true })).toBeVisible();

    await page.getByLabel('New series').fill(series);
    await page.getByRole('button', { name: 'Add series' }).click();
    await expect(page.getByRole('heading', { name: series })).toBeVisible();

    await page.getByLabel(`Import from Word into ${series}`).setInputFiles({
      name: '8 - THE TEST STUDY.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: studyDocx(),
    });

    // The editor: pages, blanks and the one answer the table had.
    await expect(page.getByRole('heading', { name: 'The Test Study' })).toBeVisible();
    await expect(page.getByLabel('Page 1', { exact: true })).toHaveValue(/# Discover[\s\S]*God _____ the world\./);
    await expect(page.getByLabel('Answer 1')).toHaveValue('loved');
    await expect(page.getByLabel('Answer 2')).toHaveValue('');
    await expect(page.getByText(/1 of 2 blanks still need an answer/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();

    // The second blank has no single right answer: people write their own.
    await page.getByLabel('Blank 2: no set answer').check();
    await expect(page.getByText('Draft saved')).toBeVisible();

    // Preview: the reader as people see it; answers show once submitted.
    await page.getByRole('button', { name: 'Preview' }).click();
    const preview = page.getByRole('dialog', { name: 'Preview' });
    await preview.getByLabel('Blank 1').fill('loved');
    await preview.getByRole('button', { name: 'Next page' }).click();
    await preview.getByLabel('Blank 2').fill('saved');
    await preview.getByRole('button', { name: 'Next page' }).click();
    await preview.getByRole('button', { name: 'Submit answers' }).click();
    await expect(preview.getByRole('heading', { name: 'Study complete' })).toBeVisible();
    await expect(preview.getByRole('row').filter({ hasText: 'saved' })).toContainText('Your own words');
    await preview.getByRole('button', { name: 'Close preview' }).last().click();

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published — people now see this version.')).toBeVisible();

    // Back in the library: published; then the series is locked.
    await page.getByRole('link', { name: '← Studies' }).click();
    const card = page.locator('.card').filter({ has: page.getByRole('heading', { name: series }) });
    await expandAll(page);
    await expect(card.getByRole('listitem').filter({ hasText: 'The Test Study' })).toContainText('Published');
    await card.getByRole('button', { name: 'Lock series' }).click();
    await card.getByRole('button', { name: 'Lock it' }).click();
    await expect(card.getByText('Locked')).toBeVisible();
    await expect(card.getByRole('link', { name: 'View The Test Study' })).toBeVisible();
  } finally {
    // Leave the shared bank as it was for the other tests.
    const db = service();
    const { data } = await db.from('study_series').select('id').eq('title', series);
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    if (ids.length) {
      await db.from('studies').delete().in('series_id', ids);
      await db.from('study_series').delete().in('id', ids);
    }
  }
});
