// @vitest-environment jsdom
import i18next from 'i18next';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeId } from 'src/models/id.model';
import { LayerInfo } from './layer-info.model';
import { LayerInfoService } from './layer-info.service';
import { LayerInfoList } from './layer-info-list.element';

vi.mock('src/features/core', async () => ({
  CoreElement: (await import('src/features/core/core-element.element'))
    .CoreElement,
}));

vi.mock('./layer-info.service', async () => {
  const { createContext } = await import('@lit/context');
  const context = createContext('info-list-test');
  return { LayerInfoService: { context: () => context } };
});

beforeAll(async () => {
  await i18next.init({
    lng: 'en',
    resources: {
      en: {
        layers: {
          info_window: {
            result_tabs: 'Object information',
            exact_tab: 'Exact match',
            same_position_tab: 'Same position',
            nearby_tab: 'Nearby',
            feature: 'Object {{index}}',
            feature_numbered: '{{label}} ({{index}})',
            distance: '{{distance}} m',
          },
        },
      },
    },
  });
});

afterEach(() => document.body.replaceChildren());

const info = (
  layer: string,
  match: LayerInfo['match'],
  featureLabel: string,
): LayerInfo => ({
  layerId: makeId(layer),
  title: layer,
  match,
  featureLabel,
  attributes: [],
  select: vi.fn(),
  deselect: vi.fn(),
  destroy: vi.fn(),
  zoomToObject: vi.fn(),
});

const setup = async (infos: LayerInfo[], primary: LayerInfo | null) => {
  const infos$ = new BehaviorSubject(infos);
  const selection$ = new BehaviorSubject(primary);
  const selectInfo = vi.fn((info: LayerInfo | null) => selection$.next(info));
  const previewInfo = vi.fn<(info: LayerInfo) => void>();
  const clearPreview = vi.fn<(info: LayerInfo) => void>();
  const menu = new LayerInfoList();
  menu.layerInfoService = {
    infos$,
    selection$,
    selectInfo,
    previewInfo,
    clearPreview,
  } as unknown as LayerInfoService;
  document.body.append(menu);
  await menu.updateComplete;
  return {
    menu,
    panel: menu.shadowRoot!,
    infos$,
    selection$,
    selectInfo,
    previewInfo,
    clearPreview,
  };
};

const tabIds = ['exact', 'samePosition', 'nearby'] as const;
type TabId = (typeof tabIds)[number];

const tab = (root: ShadowRoot, id: TabId) =>
  root.querySelector<HTMLButtonElement>('[role="tab"][data-tab="' + id + '"]')!;

const shownPanel = (root: ShadowRoot) =>
  root.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!;

const shownFeature = (root: ShadowRoot) =>
  shownPanel(root)?.querySelector<HTMLElement & { info: LayerInfo }>(
    'ngm-layer-info-item',
  )?.info;

const featureHeaders = (root: ShadowRoot) => [
  ...shownPanel(root).querySelectorAll<HTMLButtonElement>(
    'button[aria-expanded]',
  ),
];

const counts = (root: ShadowRoot) =>
  tabIds.map(
    (id) => tab(root, id).querySelector('.badge')?.textContent?.trim() ?? null,
  );

describe('LayerInfoList', () => {
  it('shows no tabs or details when a click has no results', async () => {
    const { panel } = await setup([], null);

    expect(panel.querySelector('[role="tablist"]')).toBeNull();
    expect(shownPanel(panel)).toBeNull();
    expect(shownFeature(panel)).toBeUndefined();
  });

  it('opens the exact scene result and badges count features on the other tabs', async () => {
    const primary = info('Temperature', 'scene', 'Voxel');
    const sample = info('Bedrock', 'direct', 'Sample');
    const direct = info('GeoCover', 'direct', 'Terrace');
    const nearOne = info('GeoCover', 'nearby', 'Fault');
    const nearTwo = info('GeoCover', 'nearby', 'Contact');
    const { panel } = await setup(
      [primary, sample, direct, nearOne, nearTwo],
      primary,
    );

    expect(tabIds.map((id) => tab(panel, id).disabled)).toEqual([
      false,
      false,
      false,
    ]);
    expect(tab(panel, 'exact').textContent).toContain('Exact match');
    expect(tab(panel, 'samePosition').textContent).toContain('Same position');
    expect(tab(panel, 'nearby').textContent).toContain('Nearby');
    expect(tab(panel, 'exact').getAttribute('aria-selected')).toBe('true');
    expect(counts(panel)).toEqual([null, '2', '2']);
    expect(shownPanel(panel).id).toBe(
      tab(panel, 'exact').getAttribute('aria-controls'),
    );
    expect(shownPanel(panel).getAttribute('aria-labelledby')).toBe(
      tab(panel, 'exact').id,
    );
    expect(shownPanel(panel).textContent).toContain('Temperature');
    expect(shownPanel(panel).textContent).not.toContain('Bedrock');
    expect(shownFeature(panel)).toBe(primary);
  });

  it('shows a lone exact result and disables both empty secondary tabs', async () => {
    const primary = info('GeoCover', 'direct', 'Terrace');
    const { panel } = await setup([primary], primary);

    expect(tabIds.map((id) => tab(panel, id).disabled)).toEqual([
      false,
      true,
      true,
    ]);
    expect(counts(panel)).toEqual([null, null, null]);
    expect(shownFeature(panel)).toBe(primary);
    expect(featureHeaders(panel)).toHaveLength(0);
  });

  it('opens the nearby tab when it has the only result', async () => {
    const nearby = info('GeoCover', 'nearby', 'Near the click');
    const { panel } = await setup([nearby], null);

    expect(tabIds.map((id) => tab(panel, id).disabled)).toEqual([
      true,
      true,
      false,
    ]);
    expect(counts(panel)).toEqual([null, null, '1']);
    expect(tab(panel, 'nearby').getAttribute('aria-selected')).toBe('true');
    expect(shownFeature(panel)).toBe(nearby);
    expect(featureHeaders(panel)).toHaveLength(0);
  });

  it('opens a single result immediately when switching to a secondary tab', async () => {
    const primary = info('Temperature', 'scene', 'Voxel');
    const sample = info('Bedrock', 'direct', 'Sample');
    const { menu, panel } = await setup([primary, sample], primary);

    tab(panel, 'samePosition').click();
    await menu.updateComplete;

    expect(tab(panel, 'samePosition').getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(shownFeature(panel)).toBe(sample);
    expect(featureHeaders(panel)).toHaveLength(0);
  });

  it.each([
    ['samePosition', 'direct'],
    ['nearby', 'nearby'],
  ] as const)(
    'stacks multiple matches closed in %s and opens their own details',
    async (id, match) => {
      const primary = info('Temperature', 'scene', 'Voxel');
      const first = info('GeoCover', match, 'Terrace');
      const second = info('GeoCover', match, 'Terrace');
      const { menu, panel, selectInfo } = await setup(
        [primary, first, second],
        primary,
      );

      tab(panel, id).click();
      await menu.updateComplete;

      const headers = featureHeaders(panel);
      expect(
        headers.map((button) => button.getAttribute('aria-expanded')),
      ).toEqual(['false', 'false']);
      expect(shownFeature(panel)).toBeUndefined();
      expect(headers[0].textContent).toContain('Terrace (1)');
      expect(headers[1].textContent).toContain('Terrace (2)');

      headers[1].click();
      await menu.updateComplete;
      expect(selectInfo).toHaveBeenLastCalledWith(second);
      expect(shownFeature(panel)).toBe(second);
      expect(
        featureHeaders(panel).map((button) =>
          button.getAttribute('aria-expanded'),
        ),
      ).toEqual(['false', 'true']);

      featureHeaders(panel)[0].click();
      await menu.updateComplete;
      expect(shownFeature(panel)).toBe(first);
      expect(
        shownPanel(panel).querySelectorAll('ngm-layer-info-item'),
      ).toHaveLength(1);
    },
  );

  it('previews exact, same-position and nearby features on pointer and keyboard focus', async () => {
    const primary = info('Temperature', 'scene', 'Voxel');
    const sample = info('Bedrock', 'direct', 'Sample');
    const firstNearby = info('GeoCover', 'nearby', 'Terrace');
    const secondNearby = info('GeoCover', 'nearby', 'Fault');
    const { menu, panel, selectInfo, previewInfo, clearPreview } = await setup(
      [primary, sample, firstNearby, secondNearby],
      primary,
    );

    for (const [id, match] of [
      ['exact', primary],
      ['samePosition', sample],
      ['nearby', firstNearby],
    ] as const) {
      tab(panel, id).click();
      await menu.updateComplete;
      selectInfo.mockClear();
      const feature = shownPanel(panel).querySelector<HTMLElement>('.feature')!;

      feature.dispatchEvent(new MouseEvent('mouseenter'));
      expect(previewInfo).toHaveBeenLastCalledWith(match);
      feature.dispatchEvent(new MouseEvent('mouseleave'));
      expect(clearPreview).toHaveBeenLastCalledWith(match);
      feature.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(previewInfo).toHaveBeenLastCalledWith(match);
      feature.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      expect(clearPreview).toHaveBeenLastCalledWith(match);
      expect(selectInfo).not.toHaveBeenCalled();
    }
    expect(previewInfo).toHaveBeenCalledTimes(6);
    expect(shownFeature(panel)).toBeUndefined();
  });

  it('skips disabled tabs on keyboard navigation and starts on the exact tab for a new click', async () => {
    const primary = info('Temperature', 'scene', 'Voxel');
    const nearby = info('GeoCover', 'nearby', 'Terrace');
    const { menu, panel, infos$, selection$ } = await setup(
      [primary, nearby],
      primary,
    );

    tab(panel, 'exact').focus();
    tab(panel, 'exact').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await menu.updateComplete;

    expect(panel.activeElement).toBe(tab(panel, 'nearby'));
    expect(tab(panel, 'nearby').getAttribute('aria-selected')).toBe('true');

    infos$.next([primary, nearby]);
    await menu.updateComplete;
    expect(tab(panel, 'nearby').getAttribute('aria-selected')).toBe('true');

    const next = info('Bedrock', 'direct', 'Next sample');
    infos$.next([next, info('GeoCover', 'nearby', 'Fault')]);
    selection$.next(next);
    await menu.updateComplete;

    expect(tab(panel, 'exact').getAttribute('aria-selected')).toBe('true');
    expect(shownFeature(panel)).toBe(next);
  });
});
