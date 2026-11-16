import { CoreElement } from 'src/features/core';
import { consume } from '@lit/context';
import { Cartesian2, Cartographic, Scene } from 'cesium';
import { css, html, PropertyValues, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { formatCartographicAs2DLv95 } from 'src/projection';
import i18next from 'i18next';
import { applyTypography } from 'src/styles/theme';
import {
  handleScenePickingError,
  PickService,
} from 'src/services/pick.service';
import { CesiumService } from 'src/services/cesium.service';
import { CursorInfoPickScheduler } from 'src/features/layout/layout-cursor-info-pick-scheduler';

/**
 * The media query in which the cursor info is displayed.
 */
const VISIBLE_MEDIA_QUERY = '(min-width: 1200px)';

@customElement('ngm-layout-cursor-info')
export class LayoutCursorInfo extends CoreElement {
  @state()
  accessor coordinates: string[] = [];

  @state()
  accessor height: number | null = null;

  @state()
  accessor heightType: 'terrain' | 'object' = 'object';

  @consume({ context: PickService.context() })
  accessor pickService!: PickService;

  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  private static readonly HEIGHT_FORMAT = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 1,
  });

  private static readonly PICK_INTERVAL_MS = 50;

  private static readonly PICK_IDLE_FACTOR = 2;

  private readonly visibleMediaQuery = window.matchMedia(VISIBLE_MEDIA_QUERY);

  /**
   * The viewport coordinates of the latest cursor position over the map.
   */
  private pointerClientPosition: { x: number; y: number } | null = null;

  private readonly windowPosition = new Cartesian2();

  private readonly pickScheduler = new CursorInfoPickScheduler({
    pick: () => this.pickAtCursor(),
    intervalMs: LayoutCursorInfo.PICK_INTERVAL_MS,
    idleFactor: LayoutCursorInfo.PICK_IDLE_FACTOR,
  });

  connectedCallback() {
    super.connectedCallback();
    this.initializeViewer();
  }

  willUpdate(props: PropertyValues<this>): void {
    super.willUpdate(props);

    this.hidden = this.coordinates.length === 0 && this.height === null;
  }

  initializeViewer(): void {
    const { viewer } = this.cesiumService;
    if (viewer === null) {
      return;
    }
    const { canvas } = viewer;

    const handlePointerMove = (event: PointerEvent): void => {
      // Touch input has no hover, so there is no cursor to show info for.
      // While a button is pressed, the camera controllers are busy moving the map,
      // and picking alongside them costs frame time for values that nobody can read.
      // The values are refreshed once the button is released instead.
      if (
        event.pointerType === 'touch' ||
        event.buttons !== 0 ||
        !this.visibleMediaQuery.matches
      ) {
        return;
      }
      this.pointerClientPosition = { x: event.clientX, y: event.clientY };
      this.pickScheduler.schedule();
    };

    const handlePointerDown = (): void => {
      this.pickScheduler.cancel();
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerMove);
    this.register(() => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerMove);
      this.pickScheduler.cancel();
    });
  }

  /**
   * Picks the coordinates, height and height type under the cursor.
   */
  private pickAtCursor(): void {
    const { viewer } = this.cesiumService;
    if (viewer === null) {
      return;
    }
    const windowPosition = this.resolveWindowPosition(viewer.canvas);
    if (windowPosition === null) {
      return;
    }

    const cartesian = this.pickService.pick(windowPosition);
    if (cartesian == null) {
      if (this.coordinates.length !== 0) {
        this.coordinates = [];
      }
      this.height = null;
      return;
    }

    const position = Cartographic.fromCartesian(cartesian);
    this.coordinates = formatCartographicAs2DLv95(position);
    this.height = position.height / viewer.scene.verticalExaggeration;
    this.heightType = this.pickHeightType(viewer.scene, windowPosition);
  }

  /**
   * Picks whether the height under the cursor belongs to the terrain or to an object.
   */
  private pickHeightType(
    scene: Scene,
    windowPosition: Cartesian2,
  ): 'terrain' | 'object' {
    try {
      return scene.pick(windowPosition) == null ? 'terrain' : 'object';
    } catch (e) {
      handleScenePickingError(e);
      return this.heightType;
    }
  }

  /**
   * Converts the latest cursor position to window coordinates, as used by Cesium.
   *
   * @returns the window coordinates, or `null` if the cursor is not over the map.
   */
  private resolveWindowPosition(canvas: HTMLCanvasElement): Cartesian2 | null {
    if (this.pointerClientPosition === null) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const x = this.pointerClientPosition.x - rect.left;
    const y = this.pointerClientPosition.y - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return null;
    }
    return Cartesian2.fromElements(x, y, this.windowPosition);
  }

  readonly render = () => {
    const terrainHeightLabel = i18next.t('nav_terrain_height_label');
    const objectHeightLabel = i18next.t('nav_object_height_label');
    const [heightLabel, inactiveHeightLabel] =
      this.heightType === 'terrain'
        ? [terrainHeightLabel, objectHeightLabel]
        : [objectHeightLabel, terrainHeightLabel];

    return html`
      ${
        this.coordinates.length === 0
          ? ''
          : html`
              <div class="section coordinates" data-cy="coordinates-info">
                <label>${i18next.t('camera_position_coordinates_label')}</label>
                <span class="value">${this.coordinates[0]}</span>
                <span class="value">${this.coordinates[1]}</span>
              </div>
            `
      }
      ${
        this.height === null
          ? ''
          : html`
              <div class="section" data-cy="height-info">
                <div class="height-label">
                  <label>${heightLabel}</label>
                  <span class="placeholder" aria-hidden="true"
                    >${inactiveHeightLabel}</span
                  >
                </div>
                <span class="value"
                  >${LayoutCursorInfo.HEIGHT_FORMAT.format(this.height)}m</span
                >
              </div>
            `
      }
    `;
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: none;
    }

    @media ${unsafeCSS(VISIBLE_MEDIA_QUERY)} {
      :host {
        display: flex;
      }
    }

    :host {
      ${applyTypography('overline')}
      gap: 12px;
    }

    .section {
      display: flex;
      flex-direction: column;
    }

    /* Fits LV95 coordinates like 2'615'085.4, so the width stays stable while hovering. */
    .coordinates {
      min-width: 11ch;
    }

    .value {
      font-variant-numeric: tabular-nums;
    }

    /* Stacks both height labels, so the width fits the wider one regardless of which is shown. */
    .height-label {
      display: grid;
    }

    .height-label > * {
      grid-area: 1 / 1;
    }

    .height-label > .placeholder {
      visibility: hidden;
    }

    label {
      margin-bottom: 5px;
    }
  `;
}
