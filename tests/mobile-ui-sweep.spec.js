import { test, expect } from '@playwright/test';

const routes = [
  '/team-builder',
  '/team-building-guide',
  '/analysis-desk',
  '/matchups',
  '/damage',
  '/metadex',
  '/items',
  '/learning-hub',
  '/import-export',
  '/data-quality',
];

const dropdownTriggerSelector = [
  '.selector-card-button',
  '[data-testid*="selector" i]',
  'button[aria-haspopup]',
  'button:has-text("Select")',
  'button:has-text("Choose")',
  'button:has-text("Ability")',
  'button:has-text("Item")',
  'button:has-text("Nature")',
  'button:has-text("Move")',
].join(', ');

const dropdownPanelSelector = [
  '.selector-dropdown',
  '#dropdown-portal .selector-dropdown',
  '[role="listbox"]',
  '[role="menu"]',
  '.dropdown-menu',
  '.mobile-more-menu',
].join(', ');

const searchInputSelector = [
  'input[type="search"]',
  'input[placeholder*="search" i]',
  'input[aria-label*="search" i]',
  '.selector-search input',
].join(', ');

const navSelector = [
  'a.nav-link',
  'a.mobile-nav-link',
  '.mobile-more-row',
].join(', ');

const expandableSelector = [
  'button[aria-expanded]',
  'summary',
  '.guide-step-button',
  '.accordion-button',
  '.collapse-toggle',
  '.mobile-more-button',
].join(', ');

function isIgnorableConsoleError(message) {
  const text = String(message || '').toLowerCase();
  return [
    'favicon',
    '404',
    'failed to load resource',
  ].some((needle) => text.includes(needle));
}


async function expectAppShellVisible(page, route) {
  const main = page.getByRole('main').first();
  if (await main.count()) {
    await expect(main, `Main content should be visible on ${route}`).toBeVisible();
    return;
  }

  const app = page.locator('#app').first();
  if (await app.count()) {
    await expect(app, `#app should be visible on ${route}`).toBeVisible();
    return;
  }

  await expect(page.locator('body'), `Body should be visible on ${route}`).toBeVisible();
}

async function collectViewportIssues(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const issues = [];

    const docOverflow = Math.ceil(document.documentElement.scrollWidth - viewportWidth);
    const bodyOverflow = Math.ceil(document.body.scrollWidth - viewportWidth);
    if (docOverflow > 2 || bodyOverflow > 2) {
      issues.push({
        type: 'horizontal-overflow',
        message: `Document is wider than viewport by ${Math.max(docOverflow, bodyOverflow)}px`,
      });
    }

    const ignoredTags = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD']);
    const elements = Array.from(document.body.querySelectorAll('*'));
    for (const el of elements) {
      if (ignoredTags.has(el.tagName)) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const rightOverflow = Math.ceil(rect.right - viewportWidth);
      const leftOverflow = Math.ceil(0 - rect.left);
      if (rightOverflow > 2 || leftOverflow > 2) {
        issues.push({
          type: 'element-overflow',
          selector: el.className ? `.${String(el.className).trim().replace(/\s+/g, '.')}` : el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 80),
          message: `Element overflows viewport: left ${Math.round(rect.left)} right ${Math.round(rect.right)} width ${Math.round(rect.width)} viewport ${viewportWidth}`,
        });
        if (issues.length > 20) break;
      }
    }

    for (const panel of Array.from(document.querySelectorAll('.selector-dropdown, #dropdown-portal .selector-dropdown, [role="listbox"], [role="menu"], .dropdown-menu, .mobile-more-menu'))) {
      const style = window.getComputedStyle(panel);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = panel.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.left < -2 || rect.right > viewportWidth + 2 || rect.top < -2 || rect.bottom > viewportHeight + 2) {
        issues.push({
          type: 'dropdown-outside-viewport',
          message: `Dropdown/list panel is outside viewport: ${JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), viewportWidth, viewportHeight })}`,
        });
      }

      let ancestor = panel.parentElement;
      while (ancestor && ancestor !== document.body) {
        const ancestorStyle = window.getComputedStyle(ancestor);
        const clips = ['hidden', 'clip', 'scroll', 'auto'].includes(ancestorStyle.overflow) || ['hidden', 'clip', 'scroll', 'auto'].includes(ancestorStyle.overflowY);
        if (clips) {
          const ancestorRect = ancestor.getBoundingClientRect();
          const clipped = rect.bottom > ancestorRect.bottom + 2 || rect.top < ancestorRect.top - 2 || rect.right > ancestorRect.right + 2 || rect.left < ancestorRect.left - 2;
          if (clipped) {
            issues.push({
              type: 'dropdown-clipped-by-ancestor',
              message: `Dropdown may be clipped by ancestor ${ancestor.className || ancestor.tagName}`,
            });
            break;
          }
        }
        ancestor = ancestor.parentElement;
      }
    }

    return issues;
  });
}

async function closeOpenMobileMenus(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('[data-mobile-more][open]').forEach((menu) => {
      menu.removeAttribute('open');
      menu.querySelector('.mobile-more-button')?.setAttribute('aria-expanded', 'false');
    });
  }).catch(() => {});
}


async function scrollPageSafely(page, deltaY = 700) {
  const before = await page.evaluate(() => window.scrollY);
  const wheelWorked = await page.mouse.wheel(0, deltaY).then(() => true).catch(() => false);
  if (!wheelWorked) {
    await page.evaluate((amount) => {
      window.scrollBy({ top: amount, left: 0, behavior: 'instant' });
    }, deltaY).catch(() => {});
  }
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.scrollY);
  return { before, after };
}

async function scrollInsideDropdownSafely(page, deltaY = 500) {
  const didScrollPanel = await page.evaluate((amount) => {
    const selectors = ['#dropdown-portal .selector-dropdown', '.selector-dropdown', '[role="listbox"]', '[role="menu"]', '.dropdown-menu', '.mobile-more-menu'];
    const panel = selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .find((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
    if (!panel) return false;
    panel.scrollTop += amount;
    return true;
  }, deltaY).catch(() => false);

  if (!didScrollPanel) {
    await page.mouse.wheel(0, deltaY).catch(() => {});
  }
}

async function openVisibleDropdowns(page) {
  const triggers = page.locator(dropdownTriggerSelector);
  const triggerCount = Math.min(await triggers.count(), 12);
  const failures = [];

  for (let i = 0; i < triggerCount; i += 1) {
    const trigger = triggers.nth(i);
    if (!(await trigger.isVisible().catch(() => false))) continue;

    const beforeScrollY = await page.evaluate(() => window.scrollY);
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger.click({ timeout: 3_000 }).catch((error) => {
      failures.push(`Dropdown trigger ${i + 1} could not be clicked: ${error.message}`);
    });
    await page.waitForTimeout(250);

    const visiblePanels = page.locator(dropdownPanelSelector).filter({ hasNotText: /^$/ });
    const panelCount = await visiblePanels.count().catch(() => 0);
    let foundVisiblePanel = false;
    for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
      if (await visiblePanels.nth(panelIndex).isVisible().catch(() => false)) {
        foundVisiblePanel = true;
        break;
      }
    }
    if (!foundVisiblePanel) {
      failures.push(`Dropdown trigger ${i + 1} did not reveal a visible dropdown/list panel.`);
    } else {
      await scrollInsideDropdownSafely(page, 500);
      await page.waitForTimeout(150);
      const afterScrollY = await page.evaluate(() => window.scrollY);
      const stillOpen = await page.locator(dropdownPanelSelector).first().isVisible().catch(() => false);
      if (stillOpen && Math.abs(afterScrollY - beforeScrollY) > 80) {
        failures.push(`Body scrolled while dropdown ${i + 1} was open. Before: ${beforeScrollY}, after: ${afterScrollY}.`);
      }
    }

    await page.keyboard.press('Escape').catch(() => {});
    await page.mouse.click(5, 5).catch(() => {});
    await page.waitForTimeout(100);
  }

  return failures;
}

test.describe('Mobile UI regression sweep', () => {
  test.beforeEach(async ({ page }) => {
    const browserErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) browserErrors.push(msg.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.browserErrors = browserErrors;
  });

  for (const route of routes) {
    test(`${route} has no mobile layout/navigation regressions`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(750);

      await expectAppShellVisible(page, route);
      expect(page.browserErrors, `Console/page errors on ${route}`).toEqual([]);

      const { before: scrollBefore, after: scrollAfter } = await scrollPageSafely(page, 700);
      const canScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 40);
      if (canScroll) expect(scrollAfter, `Page did not scroll on ${route}`).toBeGreaterThanOrEqual(scrollBefore);

      const viewportIssuesBefore = await collectViewportIssues(page);
      expect(viewportIssuesBefore, `Viewport issues before interactions on ${route}`).toEqual([]);

      const searches = page.locator(searchInputSelector);
      const searchCount = Math.min(await searches.count(), 10);
      for (let i = 0; i < searchCount; i += 1) {
        const search = searches.nth(i);
        if (!(await search.isVisible().catch(() => false))) continue;
        await search.scrollIntoViewIfNeeded().catch(() => {});
        await search.fill('test', { timeout: 3_000 });
        await expect(search, `Search input ${i + 1} on ${route} did not accept typed text`).toHaveValue(/test/i);
        await search.fill('');
      }

      const dropdownFailures = await openVisibleDropdowns(page);
      expect(dropdownFailures, `Dropdown issues on ${route}`).toEqual([]);
      await closeOpenMobileMenus(page);

      const expandables = page.locator(expandableSelector);
      const expandableCount = Math.min(await expandables.count(), 12);
      for (let i = 0; i < expandableCount; i += 1) {
        const button = expandables.nth(i);
        if (!(await button.isVisible().catch(() => false))) continue;
        const before = await button.getAttribute('aria-expanded').catch(() => null);
        await button.scrollIntoViewIfNeeded().catch(() => {});
        await button.click({ timeout: 3_000 }).catch(() => {});
        await page.waitForTimeout(150);
        const after = await button.getAttribute('aria-expanded').catch(() => null);
        if (before !== null && after !== null) {
          expect(after, `Expandable ${i + 1} on ${route} did not toggle aria-expanded`).not.toBe(before);
        }
      }

      const viewportIssuesAfter = await collectViewportIssues(page);
      expect(viewportIssuesAfter, `Viewport issues after interactions on ${route}`).toEqual([]);
      expect(page.browserErrors, `Console/page errors after interactions on ${route}`).toEqual([]);
    });
  }


  test('mobile search inputs preserve focus and cursor across safe re-renders', async ({ page }) => {
    await page.goto('/items');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(750);
    await expectAppShellVisible(page, '/items');

    const search = page.locator('[data-items-search]').first();
    await expect(search).toBeVisible();
    await search.click();
    await search.fill('berry');
    await page.evaluate(() => {
      const input = document.querySelector('[data-items-search]');
      input?.setSelectionRange(2, 2);
    });
    await page.waitForTimeout(180);

    await expect(search, 'Items search should keep focus after the debounced full-page render').toBeFocused();
    await expect(search).toHaveValue('berry');
    const selection = await search.evaluate((input) => ({ start: input.selectionStart, end: input.selectionEnd }));
    expect(selection).toEqual({ start: 2, end: 2 });

    await page.goto('/team-builder');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(750);

    // The Team Builder now uses the same direct modal picker on every viewport:
    // tapping the slot card opens an overlay search instead of an inline
    // dropdown. The picker search must keep focus and cursor position across
    // debounced re-renders.
    const slotPicker = page.locator('button.slot-pokemon-picker-card[data-selector-focus="pokemon"]').first();
    await expect(slotPicker, 'Team Builder slot card opens the Pokémon picker on every viewport').toBeVisible();
    await slotPicker.click();

    const pickerSearch = page.locator('.direct-pokemon-picker-overlay .direct-pokemon-picker-search').first();
    await expect(pickerSearch, 'Direct Pokémon picker should open as an overlay on mobile and desktop alike').toBeVisible();
    await pickerSearch.fill('char');
    await expect(pickerSearch, 'Team Builder picker search should stay focused while filtering').toBeFocused();
    await expect(pickerSearch).toHaveValue(/char/i);
  });

  test('mobile nav links change routes and keep app usable', async ({ page }) => {
    await page.goto('/team-builder');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(750);
    await expectAppShellVisible(page, '/team-builder');

    const links = page.locator(navSelector);
    const count = Math.min(await links.count(), 12);
    const failures = [];

    for (let i = 0; i < count; i += 1) {
      const link = links.nth(i);
      if (!(await link.isVisible().catch(() => false))) continue;

      const href = await link.getAttribute('href').catch(() => '');
      const label = (await link.textContent().catch(() => '') || href || `nav ${i + 1}`).trim();
      const beforeUrl = page.url();
      await link.click({ timeout: 3_000 }).catch((error) => failures.push(`${label} could not be clicked: ${error.message}`));
      await page.waitForTimeout(350);
      const afterUrl = page.url();

      if (href && href.startsWith('/') && beforeUrl === afterUrl) {
        failures.push(`${label} did not change the current route.`);
      }

      const issues = await collectViewportIssues(page);
      if (issues.length) failures.push(`${label} caused viewport issue: ${JSON.stringify(issues.slice(0, 3))}`);
      if (page.browserErrors.length) failures.push(`${label} caused console/page errors: ${page.browserErrors.join(' | ')}`);
    }

    expect(failures).toEqual([]);
  });
});
