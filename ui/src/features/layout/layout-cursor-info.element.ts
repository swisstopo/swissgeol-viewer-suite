import { CoreElement } from 'src/features/core';
import { ContextConsumer } from '@lit/context';
import { viewerContext } from 'src/context';
import {
  Cartographic,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  VoxelPrimitive,
} from 'cesium';
import { css, html, PropertyValues } from 'lit';
import { state, customElement } from 'lit/decorators.js';
import { formatCartographicAs2DLv95 } from 'src/projection';
import { getValueOrUndefined } from 'src/cesiumutils';
import i18next from 'i18next';
import { applyTypography } from 'src/styles/theme';

@customElement('ngm-layout-cursor-info')
export class LayoutCursorInfo extends CoreElement {
  @state()
  private accessor viewer: Viewer | null = null;

  @state()
  accessor coordinates: string[] = [];

  @state()
  accessor height: number | null = null;

  @state()
  accessor heightType: 'terrain' | 'object' = 'object';

  private static readonly HEIGHT_FORMAT = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 1,
  });

  connectedCallback() {
    super.connectedCallback();
    this.register(
      new ContextConsumer(this, {
        subscribe: true,
        context: viewerContext,
        callback: (viewer) => {
          this.viewer = viewer ?? null;
          this.initializeViewer();
        },
      }),
    );
  }

  willUpdate(props: PropertyValues<this>): void {
    super.willUpdate(props);

    this.hidden = this.coordinates.length === 0 && this.height === null;
  }

  initializeViewer(): void {
    const { viewer } = this;
    if (viewer === null) {
      return;
    }

    const eventHandler = new ScreenSpaceEventHandler(viewer.canvas);
    eventHandler.setInputAction(
      this.handleMouseMove.bind(this),
      ScreenSpaceEventType.MOUSE_MOVE,
    );
    this.register(() => eventHandler.destroy());
  }

  private handleMouseMove(event: ScreenSpaceEventHandler.MotionEvent): void {
    const { viewer } = this;
    if (viewer === null) {
      return;
    }

    this.height = null;
    this.coordinates.length = 0;

    const feature = viewer.scene.pick(event.endPosition);
    const cartesian = viewer.scene.pickPosition(event.endPosition);
    if (cartesian == null || feature?.primitive instanceof VoxelPrimitive) {
      return;
    }

    this.coordinates = formatCartographicAs2DLv95(
      Cartographic.fromCartesian(cartesian),
    );

    const position = Cartographic.fromCartesian(cartesian);
    this.height = position.height / viewer.scene.verticalExaggeration;

    const lineOrPolygon =
      getValueOrUndefined(feature?.id?.polyline?.show) ||
      getValueOrUndefined(feature?.id?.polygon?.show);
    this.heightType = lineOrPolygon == null ? 'terrain' : 'object';
  }

  readonly render = () => html`
    ${this.coordinates.length === 0
      ? ''
      : html`
          <div class="section">
            <label>${i18next.t('camera_position_coordinates_label')}</label>
            <span class="value">${this.coordinates[0]}</span>
            <span class="value">${this.coordinates[1]}</span>
          </div>
        `}
    ${this.height === null
      ? ''
      : html`
          <div class="section">
            <label>
              ${this.heightType === 'terrain'
                ? i18next.t('nav_terrain_height_label')
                : i18next.t('nav_object_height_label')}
            </label>
            <span>${LayoutCursorInfo.HEIGHT_FORMAT.format(this.height)}m</span>
          </div>
        `}
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: none;
    }

    @media (min-width: 1200px) {
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

    label {
      margin-bottom: 5px;
    }
  `;
}
