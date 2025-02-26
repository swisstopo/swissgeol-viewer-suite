import {
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  CustomDataSource,
  Entity,
  HeightReference,
  JulianDate,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer,
} from 'cesium';
import MainStore from 'src/store/main';
import { Drawing, DrawTool, PointDrawing, Tool, ToolShape, ToolType } from 'src/features/tool/tool.model';
import { BaseService } from 'src/utils/base.service';
import { DrawPointToolController } from 'src/features/tool/draw/draw-point-tool.controller';
import { DrawController } from 'src/features/tool/draw/draw-tool.controller';
import { BehaviorSubject, Subscription, take } from 'rxjs';
import { Id } from 'src/models/id.model';
import { DEFAULT_AOI_COLOR, POINT_SYMBOLS } from 'src/constants';
import { DrawRectangleToolController } from 'src/features/tool/draw/draw-rectangle-tool.controller';

export class ToolService extends BaseService {
  private dataSource = new CustomDataSource('tool-drawings');

  /**
   * All current drawings, mapped by their ids.
   *
   * Note that the order of this `Map` matters,
   * as it determines how the drawings are displayed.
   * If a drawing changes, it must preserve its place,
   * unless it should specifically be moved.
   *
   * @private
   */
  private readonly drawings = new Map<Id<Drawing>, Drawing>();

  /**
   * A mapping from the ids of a drawing to the entity by which it is
   * represented on the viewer.
   *
   * @private
   */
  private readonly drawingsToEntities = new Map<Id<Drawing>, Entity>();

  private _viewer: Viewer | null = null;

  private activeToolSubscription: Subscription | null = null;

  constructor() {
    super();
    MainStore.viewer.subscribe((viewer) => {
      this._viewer = viewer;
      if (viewer !== null) {
        viewer.dataSources.add(this.dataSource).then();
      }
    });
  }

  public activate(tool: Tool): void {
    this.deactivate();
    switch (tool.type) {
      case ToolType.Draw:
        this.activateDrawTool(tool);
        break;
    }
  }

  public deactivate(): void {
    this.activeToolSubscription?.unsubscribe();
  }

  private get viewer(): Viewer {
    if (this._viewer === null) {
      throw new Error('viewer is not yet available');
    }
    return this._viewer;
  }

  private activateDrawTool(tool: DrawTool): void {
    const controller = this.makeDrawController(tool.shape);
    const screen = new ScreenSpaceEventHandler(this.viewer.canvas);

    let timeoutForClick: NodeJS.Timeout | null = null;
    screen.setInputAction((e: { position?: Cartesian2 }) => {
      if (timeoutForClick !== null) {
        clearTimeout(timeoutForClick);
        timeoutForClick = null;
        controller.handleStop();
        return;
      }
      const position = this.pick(e.position);
      if (position === null) {
        return;
      }
      const action = () => {
        timeoutForClick = null;
        controller.handleClick(position);
      };
      timeoutForClick = setTimeout(action, 250);
    }, ScreenSpaceEventType.LEFT_CLICK);

    screen.setInputAction((e: { endPosition?: Cartesian2 }) => {
      const position = this.pick(e.endPosition);
      if (position === null) {
        return;
      }
      controller.handleMouseMove(position);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    controller.drawing$.subscribe({
      next: (drawing) => {
        const entity = this.drawingsToEntities.get(drawing.id);
        if (entity == null) {
          // It's a new drawing.
          const newEntity = makeEntityFromDrawing(drawing);
          this.dataSource.entities.add(newEntity);
          this.drawingsToEntities.set(drawing.id, newEntity);
        } else {
          // The drawing exists already, but it has probably changed in some way.
          const updatedEntity = updateEntityByDrawing(entity, drawing);
          if (updatedEntity !== entity) {
            this.dataSource.entities.remove(entity);
            this.dataSource.entities.add(updatedEntity);
            this.drawingsToEntities.set(drawing.id, updatedEntity);
          }
        }
        this.drawings.set(drawing.id, drawing);
      },
      complete: () => {
        controller.destroy();
      },
    });

    this.activeToolSubscription = new Subscription();
    this.activeToolSubscription.add(() => {
      controller.destroy();
      screen.destroy();
    });
  }

  private makeDrawController(shape: ToolShape): DrawController {
    switch (shape) {
      case ToolShape.Point:
        return new DrawPointToolController();
      case ToolShape.Line:
        throw new Error('not yet implemented');
      case ToolShape.Polygon:
        throw new Error('not yet implemented');
      case ToolShape.Rectangle:
        return new DrawRectangleToolController();
    }
  }

  private pick(position: Cartesian2 | null | undefined): Cartesian3 | null {
    if (position == null) {
      return null;
    }
    const pickedPosition = this.viewer.scene.pickPosition(position);
    if (pickedPosition == null) {
      return null;
    }
    return Cartesian3.clone(pickedPosition);
  }
}

const makeEntityFromDrawing = (drawing: Drawing): Entity => {
  const entity = new Entity({
    id: `${drawing.id}`,
  });
  return updateEntityByDrawing(entity, drawing);
};

const updateEntityByDrawing = (entity: Entity, drawing: Drawing): Entity => {
  switch (drawing.shape) {
    case ToolShape.Point:
      return updateEntityByPointDrawing(entity, drawing);
    case ToolShape.Line:
      throw new Error('not yet implemented');
    case ToolShape.Polygon:
      throw new Error('not yet implemented');
    case ToolShape.Rectangle:
      throw new Error('not yet implemented');
  }
};

const updateEntityByPointDrawing = (entity: Entity, drawing: PointDrawing): Entity => {
  if (entity.properties?.type != null && entity.properties.type.getValue(JulianDate.now()) === 'point') {
    entity.position = new ConstantPositionProperty(drawing.coordinate);
    return entity;
  }
  return new Entity({
    id: entity.id,
    position: drawing.coordinate,
    billboard: {
      image: `/images/${POINT_SYMBOLS[0]}`,
      color: DEFAULT_AOI_COLOR,
      scale: 0.5,
      verticalOrigin: VerticalOrigin.BOTTOM,
      disableDepthTestDistance: 0,
      heightReference: HeightReference.RELATIVE_TO_GROUND,
    },
  });
};
