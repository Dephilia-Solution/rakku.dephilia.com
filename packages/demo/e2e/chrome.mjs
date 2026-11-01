import assert from 'node:assert/strict';
import { eventually } from './browser.mjs';

export function driverSession(page) {
  // Focus emulation is per CDP agent: disabling it on a new auxiliary session does not
  // remove the override owned by Playwright's controlling session. This is harness
  // transport access only; no application globals, React internals, or engine state.
  const implementation = page._connection?.toImpl?.(page);
  const session = (implementation?.delegate ?? implementation?._delegate)?._mainFrameSession?._client;
  assert.ok(session?.send && session?.on, 'A local Playwright Chromium control session is required for native visibility/lifecycle auditing');
  return session;
}

/** Native Chrome controls only. Remove Playwright's foreground override; never set visibility. */
export async function nativeTabVisibility(env, page, url) {
  const root = await env.browser.newBrowserCDPSession();
  const primary = await env.context.newCDPSession(page);
  let secondary, background, minimized = false;
  const { targetInfo } = await primary.send('Target.getTargetInfo');
  const window = await root.send('Browser.getWindowForTarget', { targetId: targetInfo.targetId });
  await driverSession(page).send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await page.bringToFront();
  await eventually(async () => assert.equal(await page.evaluate(() => document.visibilityState), 'visible'), 'Native foreground document is visible');
  try {
    const pageEvent = env.context.waitForEvent('page');
    const { targetId } = await root.send('Target.createTarget', {
      url, browserContextId: targetInfo.browserContextId, newWindow: false, background: false,
    });
    background = await pageEvent;
    await background.waitForLoadState('domcontentloaded');
    assert.equal(background.context(), env.context, 'CDP-created tab uses the same audited browser context');
    await env.auditSession(background);
    secondary = await env.context.newCDPSession(background);
    await driverSession(background).send('Emulation.setFocusEmulationEnabled', { enabled: false });
    const secondWindow = await root.send('Browser.getWindowForTarget', { targetId });
    await root.send('Target.activateTarget', { targetId });
    await background.bringToFront();
    env.observe('native-tab-window-layout', { primaryTarget: targetInfo.targetId, secondaryTarget: targetId,
      primaryWindow: window.windowId, secondaryWindow: secondWindow.windowId,
      primaryVisibility: await page.evaluate(() => document.visibilityState),
      secondaryVisibility: await background.evaluate(() => document.visibilityState), focusEmulation: false });
    // Some Windows automation builds still place targets in separate windows. Native OS
    // minimization is a real hide operation and is not a JavaScript/emulated visibility event.
    if (await page.evaluate(() => document.visibilityState) !== 'hidden') {
      await root.send('Browser.setWindowBounds', { windowId: window.windowId, bounds: { windowState: 'minimized' } });
      minimized = true;
    }
    await eventually(async () => assert.equal(await page.evaluate(() => document.visibilityState), 'hidden'),
      'Native tab deactivation/window minimization hides the demo', 10_000);
    env.observe('native-hidden-proof', { minimized, primaryWindow: window.windowId,
      windowBounds: (await root.send('Browser.getWindowBounds', { windowId: window.windowId })).bounds,
      visibility: await page.evaluate(() => document.visibilityState) });
    assert.equal(await page.evaluate(() => globalThis.__acceptanceSpy.lifecycle.some((event) =>
      event.type === 'visibilitychange' && event.visibility === 'hidden' && event.trusted)), true,
    'Browser must emit a genuine trusted hidden visibilitychange event');
  } finally {
    // Restore the actual browser window and selected tab before any business UI operation.
    await root.send('Browser.setWindowBounds', { windowId: window.windowId, bounds: { windowState: 'normal' } });
    await root.send('Target.activateTarget', { targetId: targetInfo.targetId });
    await page.bringToFront();
    await eventually(async () => assert.equal(await page.evaluate(() => document.visibilityState), 'visible'), 'Native foreground demo is visible again');
    await secondary?.detach();
    await primary.detach();
    await root.detach();
  }
  return background;
}
