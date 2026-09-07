import { startPractice } from './helpers';
import { test, expect, type Page } from '@playwright/test';
import { groundHeight } from '../src/game/level';
import type { Snapshot } from '../src/game/types';

const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __rvDebug: { snapshot: Snapshot } }).__rvDebug.snapshot);
const sound = (page: Page) => page.evaluate(() => (window as unknown as { __rvDebug: { audio: { state: string; outputRms: number; musicEnabled: boolean; effectsEnabled: boolean } } }).__rvDebug.audio);

test('camera-relative walking and shoulder support', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await startPractice(page);
  await page.mouse.move(140, 360);
  await page.mouse.down();
  await page.mouse.move(925, 360, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'test-results/traveler.png' });
  // Restore the +Z camera before checking the input basis.
  await page.mouse.move(925, 360); await page.mouse.down();
  await page.mouse.move(140, 360, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(150);
  const start = (await snapshot(page)).player.position;
  await page.keyboard.down('KeyD'); await page.waitForTimeout(180); await page.keyboard.up('KeyD');
  expect((await snapshot(page)).player.position.x).toBeLessThan(start.x);
  await page.keyboard.down('KeyA'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(4200);
  await page.keyboard.up('KeyA'); await page.keyboard.up('ShiftLeft');
  const edge = (await snapshot(page)).player.position;
  expect(edge.x).toBeGreaterThan(8); // Beyond the former collision-mesh edge.
  expect(edge.x).toBeLessThan(18);
  expect(edge.y).toBeGreaterThanOrEqual(groundHeight(edge.x, edge.z) + .78);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  const after = (await snapshot(page)).player.position;
  expect(after.z).toBeGreaterThan(edge.z + 2);
  expect(after.y).toBeGreaterThanOrEqual(groundHeight(after.x, after.z) + .78);
  await page.screenshot({ path: 'test-results/shoulder-walking.png' });
  expect(errors).toEqual([]);
});

test('audio waits for gesture, produces sound, supports independent mute and pauses', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  expect((await sound(page)).state).toBe('locked');
  await startPractice(page);
  await expect.poll(async () => (await sound(page)).state).toBe('running');
  await expect.poll(async () => (await sound(page)).outputRms).toBeGreaterThan(.0001);
  await page.getByRole('button', { name: 'Sound on' }).click();
  expect((await sound(page)).effectsEnabled).toBe(false);
  await expect.poll(async () => (await sound(page)).outputRms).toBeGreaterThan(.0001);
  await page.getByRole('button', { name: 'Music on' }).click();
  await page.waitForTimeout(500);
  expect((await sound(page)).outputRms).toBeLessThan(.0001);
  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect.poll(async () => (await sound(page)).outputRms).toBeGreaterThan(.0001);
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect.poll(async () => (await sound(page)).state).toBe('suspended');
  await page.getByRole('button', { name: 'Back to the road' }).click();
  await expect.poll(async () => (await sound(page)).state).toBe('running');
  expect(errors).toEqual([]);
});

test('original music renders a finite non-silent signal without clipping', async ({ page }) => {
  await page.goto('/');
  const rendered = await page.evaluate(async () => {
    const modulePath = '/src/game/audio.ts';
    const { scheduleMusicBar, BAR_SECONDS } = await import(modulePath);
    const ctx = new OfflineAudioContext(1, 48000 * 6, 48000);
    const gain = ctx.createGain(); gain.gain.value = .2; gain.connect(ctx.destination);
    scheduleMusicBar(ctx, gain, 0, 0);
    scheduleMusicBar(ctx, gain, BAR_SECONDS, 1);
    const buffer = await ctx.startRendering();
    const samples = buffer.getChannelData(0);
    let squared = 0, peak = 0, invalid = 0;
    for (const sample of samples) { squared += sample * sample; peak = Math.max(peak, Math.abs(sample)); if (!Number.isFinite(sample)) invalid++; }
    return { rms: Math.sqrt(squared / samples.length), peak, invalid };
  });
  expect(rendered.invalid).toBe(0);
  expect(rendered.rms).toBeGreaterThan(.001);
  expect(rendered.peak).toBeLessThan(.9);
});
