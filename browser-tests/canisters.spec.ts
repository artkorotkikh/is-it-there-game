import { test, expect } from '@playwright/test';
import { canisterTypes } from '../src/game/types';
import { collect, enter, followRoad, hold, install, socket, state, walkTo } from './helpers';

test('First delivery: load, steady drive through the shallow dip, finish with every module', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle('IS IT THERE YET?');
  await expect(page.getByRole('button', { name: 'Take the old road' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/icp-title.png' });
  await page.getByRole('button', { name: 'Take the old road' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/icp-loading.png' });
  for (const type of canisterTypes) {
    await collect(page, type);
    if (type === 'winch') await page.screenshot({ path: 'test-results/icp-carrying.png' });
    await install(page, type);
  }
  expect((await state(page)).systems.startupCompleted).toBe(true);
  await page.screenshot({ path: 'test-results/icp-loaded.png' });
  await enter(page);
  await followRoad(page, s => s.progress.finished, {maxSpeed: 3.6});
  expect((await state(page)).progress.enteredDitch).toBe(true);
  expect((await state(page)).progress.recovered).toBe(true);
  expect((await state(page)).progress.ejected).toEqual({winch:false,skills:false,cycles:false});
  expect((await state(page)).winch.phase).toBe('stowed');
  expect((await state(page)).systems.loaded).toBe(3);
  await expect(page.getByRole('heading', { name: 'YES. WE GOT IT THERE.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/icp-finish.png' });
  expect(errors).toEqual([]);
});

test('CYCLES removal needs a hold; cancellation, wrong socket, mute and restart stay clear', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/'); await page.getByRole('button', { name: 'Take the old road' }).click();
  await collect(page, 'cycles');
  await socket(page, 'winch'); await page.keyboard.press('KeyE');
  expect((await state(page)).canisters.find(c => c.type === 'cycles')!.phase).toBe('carried');
  await expect(page.locator('#prompt')).toContainText('WINCH socket');
  await install(page, 'cycles');
  for (const type of ['winch', 'skills'] as const) { await collect(page, type); await install(page, type); }
  await socket(page, 'cycles');
  await hold(page, ['KeyE'], 200);
  expect((await state(page)).systems.engine).toBe(true);
  await page.keyboard.down('KeyE'); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.keyboard.up('KeyE');
  const tick = (await state(page)).tick;
  await page.waitForTimeout(250); expect((await state(page)).tick).toBe(tick);
  await page.getByRole('button', { name: 'Back to the road' }).click();
  expect((await state(page)).systems.engine).toBe(true);
  await page.keyboard.down('KeyE');
  await expect.poll(async () => (await state(page)).systems.engine).toBe(false);
  await page.keyboard.up('KeyE');
  await expect(page.locator('#warning-title')).toHaveText('CYCLES DISCONNECTED');
  await walkTo(page, 3, -3); await page.keyboard.press('KeyG');
  await enter(page); const z = (await state(page)).vehicle.position.z;
  await hold(page, ['KeyW'], 800); expect((await state(page)).vehicle.position.z).toBeCloseTo(z, 1);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Sound on' }).click();
  await collect(page, 'cycles'); await install(page, 'cycles');
  expect((await state(page)).systems.engine).toBe(true);
  await page.screenshot({ path: 'test-results/icp-cycles-restored.png' });
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Start over' }).click();
  expect((await state(page)).systems.loaded).toBe(0);
  expect((await state(page)).progress.ejected).toEqual({ winch: false, skills: false, cycles: false });
});
