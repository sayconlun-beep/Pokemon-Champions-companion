import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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


const dataConfidenceDisclosureSelector = '[data-confidence-disclosure]';
const teamDataConfidenceDisclosureSelector = '[data-team-confidence-disclosure]';
const seededTeamPokemonIds = ['PKMN_0006', 'PKMN_0009', 'PKMN_0038_ALOLA', 'PKMN_0026_ALOLA'];

function createSeededTeam(ids = seededTeamPokemonIds) {
  return Array.from({ length: 6 }, (_, index) => {
    const pokemonId = ids[index];
    if (!pokemonId) return null;
    return {
      pokemon_id: pokemonId,
      item_id: '',
      ability_id: '',
      nature: 'Jolly',
      moves: [],
      statAllocation: {}
    };
  });
}

async function waitForGoldStandardApp(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const root = document.querySelector('#app');
    return Boolean(root?.__goldStandardState?.data?.indexes?.pokemonById && root.__appShellRender);
  });
}

async function prepareDisclosureSurface(page, route, options = {}) {
  await page.goto(`/${route}`);
  await waitForGoldStandardApp(page);
  await page.evaluate(({ routeId, team, selectedPokemonId, confirmedPokemonId }) => {
    const root = document.querySelector('#app');
    const state = root?.__goldStandardState;
    if (!root || !state || typeof root.__appShellRender !== 'function') {
      throw new Error('Gold-standard app state was not ready for the disclosure mobile sweep.');
    }

    if (confirmedPokemonId) {
      const row = state.data?.indexes?.pokemonById?.[confirmedPokemonId];
      if (row) {
        row.confidenceStatus = 'Confirmed';
        row.requiresOfficialReview = false;
        row.strictModeEligible = true;
      }
      const collectionRow = (state.data?.collections?.pokemon || []).find((pokemon) => pokemon?.pokemon_id === confirmedPokemonId);
      if (collectionRow && collectionRow !== row) {
        collectionRow.confidenceStatus = 'Confirmed';
        collectionRow.requiresOfficialReview = false;
        collectionRow.strictModeEligible = true;
      }
    }

    state.route = routeId;
    state.team = team;
    state.slotUiState = team.map((slot) => ({ collapsed: false, strategicRoleOpen: false }));
    state.metadex ||= { search: '', legality: 'all', field: 'all', selectedId: '', megaOnly: false };
    if (selectedPokemonId) {
      state.metadex.search = '';
      state.metadex.selectedId = selectedPokemonId;
      state.metadex.visibleLimit = Math.max(Number(state.metadex.visibleLimit || 0), 90);
    }
    root.__appShellRender(root, state);
  }, {
    routeId: route,
    team: createSeededTeam(options.teamPokemonIds || seededTeamPokemonIds),
    selectedPokemonId: options.selectedPokemonId || '',
    confirmedPokemonId: options.confirmedPokemonId || ''
  });
  await page.waitForTimeout(250);
}

async function expandDisclosureAndAssertKeyboardOperable(page, disclosure, label) {
  const control = disclosure.locator('summary, button[aria-expanded]').first();
  await expect(control, `${label} disclosure control should be visible`).toBeVisible();

  const accessibleMetadata = await control.evaluate((element) => {
    const ariaLabel = element.getAttribute('aria-label');
    const labelledBy = element.getAttribute('aria-labelledby');
    const role = element.getAttribute('role') || (element.tagName === 'SUMMARY' || element.tagName === 'BUTTON' ? 'button' : '');
    let name = ariaLabel || '';
    if (!name && labelledBy) {
      name = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
    }
    if (!name) name = element.textContent || '';
    return { name, role };
  });
  expect(accessibleMetadata.name.trim().length, `${label} disclosure control should expose an accessible name`).toBeGreaterThan(8);
  expect(accessibleMetadata.role, `${label} disclosure control should expose or imply an interactive role`).toBeTruthy();

  const stateBefore = await disclosure.evaluate((element) => {
    if (element instanceof HTMLDetailsElement) return element.open ? 'expanded' : 'collapsed';
    const control = element.querySelector('[aria-expanded]');
    return control?.getAttribute('aria-expanded') || 'unknown';
  });

  await control.focus();
  await expect(control, `${label} disclosure control should be keyboard-focusable`).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const stateAfter = await disclosure.evaluate((element) => {
    if (element instanceof HTMLDetailsElement) return element.open ? 'expanded' : 'collapsed';
    const control = element.querySelector('[aria-expanded]');
    return control?.getAttribute('aria-expanded') || 'unknown';
  });
  expect(stateAfter, `${label} disclosure should toggle its expanded state from the keyboard`).not.toBe(stateBefore);

  const body = disclosure.locator('.data-confidence-body, [role="note"]').first();
  if (stateAfter === 'expanded' || stateAfter === 'true') {
    await expect(body, `${label} disclosure note should be visible after keyboard expansion`).toBeVisible();
  } else {
    await expect(body, `${label} disclosure note should be hidden after keyboard collapse`).toBeHidden();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    await expect(body, `${label} disclosure note should become visible after a second keyboard toggle`).toBeVisible();
  }
}

async function expectDisclosureMobileLayoutSafe(page, disclosure, label) {
  const layout = await disclosure.evaluate((element) => {
    const viewportWidth = window.innerWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const rect = element.getBoundingClientRect();
    return {
      viewportWidth,
      documentWidth,
      left: rect.left,
      right: rect.right
    };
  });
  expect(Math.ceil(layout.documentWidth), `${label} should not introduce page-level horizontal overflow`).toBeLessThanOrEqual(layout.viewportWidth + 2);
  expect(Math.ceil(layout.right), `${label} disclosure should stay inside the mobile viewport`).toBeLessThanOrEqual(layout.viewportWidth + 2);
  expect(Math.floor(layout.left), `${label} disclosure should not overflow left of the mobile viewport`).toBeGreaterThanOrEqual(-2);
}

async function runDisclosureAxeChecks(page, testInfo, route) {
  await page.evaluate((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element instanceof HTMLDetailsElement) element.open = true;
    });
  }, dataConfidenceDisclosureSelector);

  const scopedResults = await new AxeBuilder({ page })
    .include(dataConfidenceDisclosureSelector)
    .analyze();
  const scopedSeriousOrCritical = scopedResults.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''));
  await testInfo.attach(`axe-disclosure-${route}.json`, {
    body: JSON.stringify(scopedSeriousOrCritical, null, 2),
    contentType: 'application/json'
  });
  expect(scopedSeriousOrCritical, `Serious/critical axe violations inside data-confidence disclosure on ${route}`).toEqual([]);

  const fullPageResults = await new AxeBuilder({ page }).analyze();
  const fullPageSeriousOrCritical = fullPageResults.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''));
  if (fullPageSeriousOrCritical.length) {
    console.log(`[axe baseline:${route}] ${fullPageSeriousOrCritical.map((violation) => `${violation.id} (${violation.impact}) ${violation.nodes.length} node(s)`).join('; ')}`);
  }
  await testInfo.attach(`axe-full-page-baseline-${route}.json`, {
    body: JSON.stringify(fullPageSeriousOrCritical, null, 2),
    contentType: 'application/json'
  });
}

async function expectTeamDisclosureCollapsedByDefault(page, label) {
  const disclosure = page.locator(teamDataConfidenceDisclosureSelector).first();
  await expect(disclosure, `${label} team disclosure should render`).toBeVisible();
  const isOpen = await disclosure.evaluate((element) => element instanceof HTMLDetailsElement && element.open);
  expect(isOpen, `${label} team disclosure should be collapsed by default`).toBe(false);
  await expect(disclosure.locator('.data-confidence-team-list'), `${label} team Pokémon breakdown should be hidden while collapsed`).toBeHidden();
}

async function expectTeamDisclosureExpandedBody(page, label) {
  const disclosure = page.locator(teamDataConfidenceDisclosureSelector).first();
  await expect(disclosure.locator('.data-confidence-team-list'), `${label} team Pokémon breakdown should be visible after expansion`).toBeVisible();
  const listItems = disclosure.locator('.data-confidence-team-list li');
  expect(await listItems.count(), `${label} team disclosure should list pending team members when expanded`).toBeGreaterThan(0);
  await expect(disclosure.locator('.data-confidence-team-list')).toContainText(/Strategic confidence:\s*(medium|high|low|unknown)/i);
  await expect(disclosure.locator('details details'), `${label} team disclosure should not use nested per-Pokémon details`).toHaveCount(0);
}

async function expectTeamDisclosureNotUnderHero(page, label) {
  const placement = await page.evaluate((selector) => {
    const notice = document.querySelector(selector);
    const hero = document.querySelector('.hero');
    if (!notice || !hero || notice.parentElement !== hero.parentElement) return { checkable: false };
    const siblings = Array.from(hero.parentElement.children);
    return {
      checkable: true,
      heroIndex: siblings.indexOf(hero),
      noticeIndex: siblings.indexOf(notice)
    };
  }, teamDataConfidenceDisclosureSelector);
  if (placement.checkable) {
    expect(placement.noticeIndex, `${label} team disclosure should not sit directly under the hero`).toBeGreaterThan(placement.heroIndex + 1);
  }
}

async function expectDisclosureSurfaceHealthy(page, testInfo, surface) {
  const selector = surface.teamLevel ? teamDataConfidenceDisclosureSelector : dataConfidenceDisclosureSelector;
  const disclosures = page.locator(selector);
  await expect(disclosures.first(), `${surface.label} should render a data-confidence disclosure`).toBeVisible();
  expect(await disclosures.count(), `${surface.label} should render at least one data-confidence disclosure`).toBeGreaterThan(0);
  const disclosure = disclosures.first();
  if (surface.teamLevel) {
    await expectTeamDisclosureCollapsedByDefault(page, surface.label);
    await expectTeamDisclosureNotUnderHero(page, surface.label);
  }
  await expandDisclosureAndAssertKeyboardOperable(page, disclosure, surface.label);
  if (surface.teamLevel) await expectTeamDisclosureExpandedBody(page, surface.label);
  await expectDisclosureMobileLayoutSafe(page, disclosure, surface.label);
  await runDisclosureAxeChecks(page, testInfo, surface.route);
  await testInfo.attach(`data-confidence-${surface.route}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
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


  test.describe('Developer-only Data Quality access', () => {
    test('hides Data Quality navigation and redirects direct access when developer mode is off', async ({ page }) => {
      await page.goto('/data-quality');
      await waitForGoldStandardApp(page);
      await expect(page.locator('.app-shell[data-active-route="team-builder"]'), 'Direct Data Quality access should fall back to the default route for regular users').toBeVisible();
      expect(new URL(page.url()).pathname, 'Direct Data Quality URL should be replaced with the default route').toBe('/team-builder');
      await expect(page.locator('a[href="/data-quality"], [data-route="data-quality"]'), 'Data Quality should not appear in desktop or mobile navigation by default').toHaveCount(0);
    });

    test('shows Data Quality navigation and page when developer mode localStorage flag is set', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('championsDeveloperMode', 'true');
      });
      await page.goto('/data-quality');
      await waitForGoldStandardApp(page);
      await expect(page.locator('.app-shell[data-active-route="data-quality"]'), 'Developer mode should allow Data Quality to render').toBeVisible();
      await expect(page.getByRole('heading', { name: /data quality/i }).first(), 'Data Quality page heading should render for developers').toBeVisible();
      expect(await page.locator('a[href="/data-quality"], [data-route="data-quality"]').count(), 'Data Quality navigation should reappear in developer mode').toBeGreaterThan(0);
    });
  });


  test.describe('Data confidence disclosure mobile coverage', () => {
    const disclosureSurfaces = [
      { route: 'team-builder', label: 'Team Builder slot cards' },
      { route: 'metadex', label: 'MetaDex detail panel', selectedPokemonId: 'PKMN_0038_ALOLA' },
      { route: 'analysis-desk', label: 'Analysis Desk', teamLevel: true },
      { route: 'damage', label: 'Damage Planner', teamLevel: true },
      { route: 'matchups', label: 'Matchups', teamLevel: true }
    ];

    for (const surface of disclosureSurfaces) {
      test(`${surface.label} disclosure is accessible, operable, and mobile-safe`, async ({ page }, testInfo) => {
        await prepareDisclosureSurface(page, surface.route, { selectedPokemonId: surface.selectedPokemonId });
        await expectDisclosureSurfaceHealthy(page, testInfo, surface);
      });
    }

    test('confirmed Pokémon entries do not render the data-confidence disclosure', async ({ page }) => {
      await prepareDisclosureSurface(page, 'team-builder', {
        teamPokemonIds: ['PKMN_0006'],
        confirmedPokemonId: 'PKMN_0006'
      });
      const confirmedSlot = page.locator('[data-slot-card="0"]').first();
      await expect(confirmedSlot, 'Confirmed test slot should render').toBeVisible();
      await expect(confirmedSlot.locator(dataConfidenceDisclosureSelector), 'Confirmed entries should hide the data-confidence disclosure automatically').toHaveCount(0);
    });

    test('confirmed team entries do not render the compact team disclosure', async ({ page }) => {
      await prepareDisclosureSurface(page, 'analysis-desk', {
        teamPokemonIds: ['PKMN_0006'],
        confirmedPokemonId: 'PKMN_0006'
      });
      await expect(page.locator(teamDataConfidenceDisclosureSelector), 'Confirmed team entries should hide the team-level disclosure automatically').toHaveCount(0);
    });
  });


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
