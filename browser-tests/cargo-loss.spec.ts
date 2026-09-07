import { expect, test } from '@playwright/test';
import { collect, enter, hold, install, state } from './helpers';
import { canisterTypes, type Snapshot } from '../src/game/types';
import { cargoLossCopy } from '../src/ui/cargo-loss';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`cargo loss is prominent and nonblocking at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width !== 1280, reducedMotion: viewport.width === 1280 ? 'no-preference' : 'reduce' });
    const page = await context.newPage();
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('http://127.0.0.1:5173/'); await page.locator('#start').click();
      const notice = page.locator('#cargo-loss');
      await expect(notice).toBeHidden();
      for (const type of canisterTypes) { await collect(page, type); await install(page, type); }
      await expect(notice).toBeHidden();
      await enter(page); await hold(page, [], 50);
      // Observe rendered motion only; no simulation or clock overrides.
      await page.evaluate(() => {
        const samples = { entering: false, exiting: false };
        Object.assign(window, { __cargoMotion: samples });
        const observe = () => {
          const element = document.getElementById('cargo-loss')!, style = getComputedStyle(element);
          const opacity = Number(style.opacity), scale = new DOMMatrix(style.transform).a;
          if (style.visibility === 'visible' && opacity > 0 && opacity < 1) {
            samples.entering ||= scale < 1;
            samples.exiting ||= scale > 1;
          }
          requestAnimationFrame(observe);
        };
        requestAnimationFrame(observe);
      });
      await page.keyboard.down('KeyW');
      await page.waitForFunction(() => (window as unknown as { __rvDebug: { snapshot: Snapshot } }).__rvDebug.snapshot.events.some(event => event.kind === 'eject'), undefined, { timeout: 20000 });
      await page.keyboard.up('KeyW'); await page.keyboard.down('Space');
      await expect(notice).toBeVisible();
      await expect(page.locator('#cargo-loss-title')).toHaveText('WINCH IS LOST');
      await expect(page.locator('#cargo-loss-detail')).toContainText('The cable still holds');
      await expect(page.locator('#system-warning')).toBeHidden();
      await expect(notice).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(notice).toHaveCSS('opacity', '1');
      await expect(notice).not.toContainText('CARGO OVERBOARD');
      await expect(notice).not.toContainText('Also offline');
      expect(await notice.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none');
      const box = (await notice.boundingBox())!;
      expect(box.x).toBeGreaterThan(0); expect(box.x + box.width).toBeLessThan(viewport.width);
      expect(box.y + box.height).toBeLessThan(viewport.height - 70);
      expect(await notice.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: `test-results/cargo-loss-${viewport.width}x${viewport.height}.png` });
      await page.locator('#pause-button').click(); await page.keyboard.up('Space');
      await expect(notice).toBeHidden();
      const paused = await state(page); await page.waitForTimeout(800);
      expect((await state(page)).tick).toBe(paused.tick);
      await page.locator('#resume').click(); await expect(notice).toBeVisible();
      await page.keyboard.down('Space');
      // Three simulation seconds can take longer in software WebGL; wait for the UI outcome.
      await expect(notice).toBeHidden({ timeout: 45000 }); await page.keyboard.up('Space');
      await expect(page.locator('#system-warning')).toBeVisible();
      if (viewport.width === 1280) expect(await page.evaluate(() => (window as unknown as { __cargoMotion: { entering: boolean; exiting: boolean } }).__cargoMotion)).toEqual({ entering: true, exiting: true });

      // Explicit DOM-only presentation fixtures for the other headlines; never mutate physics.
      for (const type of ['cycles', 'skills'] as const) {
        await page.evaluate(({ copy, type }) => {
          const fixture = document.getElementById('cargo-loss')!.cloneNode(true) as HTMLElement;
          fixture.id = 'cargo-loss-fixture'; fixture.classList.add('is-visible'); fixture.setAttribute('aria-hidden', 'false');
          fixture.querySelector('#cargo-loss-title')!.textContent = copy.title;
          fixture.querySelector('#cargo-loss-detail')!.textContent = copy.detail;
          fixture.querySelector('#cargo-loss-action')!.textContent = copy.action;
          fixture.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
          fixture.style.setProperty('--loss-opacity', '1'); fixture.style.setProperty('--loss-scale', '1'); fixture.dataset.type = type;
          document.getElementById('system-warning')!.style.visibility = 'hidden';
          document.getElementById('app')!.append(fixture);
        }, { copy: cargoLossCopy[type], type });
        const fixture = page.locator('#cargo-loss-fixture');
        const rect = (await fixture.boundingBox())!;
        expect(rect.x).toBeGreaterThan(0); expect(rect.x + rect.width).toBeLessThan(viewport.width);
        expect(rect.y + rect.height).toBeLessThan(viewport.height - 70);
        expect(await fixture.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.screenshot({ path: `test-results/cargo-loss-${type}-layout-${viewport.width}x${viewport.height}.png` });
        await fixture.evaluate(element => element.remove());
      }
      await page.locator('#system-warning').evaluate(element => { element.style.visibility = ''; });
      await page.locator('#pause-button').click(); await page.locator('#restart').click();
      await expect(notice).toBeHidden(); expect((await state(page)).systems.loaded).toBe(0);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
