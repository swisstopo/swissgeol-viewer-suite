import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  CustomDataSource,
  Entity,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium';
import MainStore from 'src/store/main';
import { Drawing, DrawTool, DrawToolVariant, Tool, ToolType } from 'src/features/tool/tool.model';
import { BaseService } from 'src/utils/base.service';
import { DrawPointToolController } from 'src/features/tool/draw-tool/draw-point-tool.controller';
import { DrawController } from 'src/features/tool/draw-tool/draw-tool.controller';
import { BehaviorSubject, filter, Observable, Subscription } from 'rxjs';
import { Id } from 'src/models/id.model';
import { DrawRectangleToolController } from 'src/features/tool/draw-tool/draw-rectangle-tool.controller';
import { DrawLineToolController } from 'src/features/tool/draw-tool/draw-line-tool.controller';
import { DrawPolygonToolController } from 'src/features/tool/draw-tool/draw-polygon-tool.controller';
import { DrawStyleController } from 'src/features/tool/draw-style/draw-style.controller';
import { SketchDrawStyleController } from 'src/features/tool/draw-style/sketch-draw-style.controller';
import { DefaultDrawStyleController } from 'src/features/tool/draw-style/default-draw-style.controller';

export class ToolService extends BaseService {
  private readonly dataSource = new CustomDataSource('tool-drawings');

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

  private readonly _activeTool$ = new BehaviorSubject<DrawTool | null>(null);

  private activeToolSubscription: Subscription | null = null;

  private readonly styles = {
    default: new DefaultDrawStyleController(),
    sketch: new SketchDrawStyleController(),
  };

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

  public get activeTool$(): Observable<Tool | null> {
    return this._activeTool$.asObservable();
  }

  public selectToolByType$<T extends ToolType>(type: ToolType): Observable<(Tool & { type: T }) | null> {
    return this.activeTool$.pipe(filter((it): it is (Tool & { type: T }) | null => it === null || it.type === type));
  }

  public deactivate(): void {
    this.activeToolSubscription?.unsubscribe();
    this.activeToolSubscription = null;
  }

  private get viewer(): Viewer {
    if (this._viewer === null) {
      throw new Error('viewer is not yet available');
    }
    return this._viewer;
  }

  private activateDrawTool(tool: DrawTool): void {
    const controller = this.makeDrawController(tool.variant);
    const screen = new ScreenSpaceEventHandler(this.viewer.canvas);

    let shouldBeSaved = false;

    let lastClickTimestamp = 0;
    screen.setInputAction((e: { position?: Cartesian2 }) => {
      const timestamp = Date.now();
      if (timestamp - lastClickTimestamp <= 250 || controller.isComplete) {
        shouldBeSaved = true;
        this.deactivate();
        return;
      }
      lastClickTimestamp = timestamp;
      const position = this.pick(e.position);
      if (position === null) {
        return;
      }
      controller.handleClick(position);
    }, ScreenSpaceEventType.LEFT_CLICK);

    screen.setInputAction((e: { endPosition?: Cartesian2 }) => {
      const position = this.pick(e.endPosition);
      if (position === null) {
        return;
      }
      controller.handleMouseMove(position);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    let drawing: Drawing | null = null;
    controller.drawing$.subscribe({
      next: (newDrawing) => {
        drawing = newDrawing;
        this.draw(drawing, this.styles.sketch);
      },
      complete: () => {
        if (drawing === null) {
          return;
        }
        if (shouldBeSaved) {
          this.draw(drawing, this.styles.default);
        } else {
          const { id } = drawing;
          this.drawings.delete(id);
          this.drawingsToEntities.delete(id);
          this.dataSource.entities.removeById(`${id}`);
          this.viewer.scene.globe.material = undefined;
          this.viewer.scene.requestRender();
        }
      },
    });

    this._activeTool$.next(tool);
    this.activeToolSubscription = new Subscription();
    this.activeToolSubscription.add(() => {
      controller.destroy();
      screen.destroy();
      this._activeTool$.next(null);
    });
  }

  private makeDrawController(variant: DrawToolVariant): DrawController {
    switch (variant) {
      case DrawToolVariant.Point:
        return new DrawPointToolController();
      case DrawToolVariant.Line:
        return new DrawLineToolController();
      case DrawToolVariant.Polygon:
        return new DrawPolygonToolController();
      case DrawToolVariant.Rectangle:
        return new DrawRectangleToolController();
    }
  }

  private draw(drawing: Drawing, style: DrawStyleController): void {
    const entity = this.drawingsToEntities.get(drawing.id);
    if (entity == null) {
      // It's a new drawing.
      const newEntity = style.makeEntity(drawing);
      this.dataSource.entities.add(newEntity);
      this.drawingsToEntities.set(drawing.id, newEntity);
    } else {
      // The drawing exists already, but it has probably changed in some way.
      const updatedEntity = style.updateEntity(entity, drawing);
      if (updatedEntity !== entity) {
        this.dataSource.entities.remove(entity);
        this.dataSource.entities.add(updatedEntity);
        this.drawingsToEntities.set(drawing.id, updatedEntity);
      }
    }
    this.drawings.set(drawing.id, drawing);
    this.viewer.scene.requestRender();
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
