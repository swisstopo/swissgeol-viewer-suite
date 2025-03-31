import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  CustomDataSource,
  Entity,
  HeightReference,
  Property,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium';
import MainStore from 'src/store/main';
import { DrawTool, EditTool, Feature, Geometry, Shape, Tool, ToolType } from 'src/features/tool/tool.model';
import { BaseService } from 'src/utils/base.service';
import { DrawPointToolController } from 'src/features/tool/draw-tool/draw-point-tool.controller';
import { DrawToolController } from 'src/features/tool/draw-tool/draw-tool.controller';
import { BehaviorSubject, filter, map, Observable, shareReplay, startWith, Subject, Subscription } from 'rxjs';
import { Id } from 'src/models/id.model';
import { DrawRectangleToolController } from 'src/features/tool/draw-tool/draw-rectangle-tool.controller';
import { DrawLineToolController } from 'src/features/tool/draw-tool/draw-line-tool.controller';
import { DrawPolygonToolController } from 'src/features/tool/draw-tool/draw-polygon-tool.controller';
import { SketchDrawStyleController } from 'src/features/tool/draw-style/sketch-draw-style.controller';
import { DefaultDrawStyleController } from 'src/features/tool/draw-style/default-draw-style.controller';
import { DrawStyleController } from 'src/features/tool/draw-style/draw-style.controller';
import { CoordinateListEditToolController } from 'src/features/tool/edit-tool/coordinate-list-edit-tool.controller';
import { EditAnchor, EditAnchorType, EditToolController } from 'src/features/tool/edit-tool/edit-tool.controller';
import { RectangleEditToolController } from 'src/features/tool/edit-tool/rectangle-edit-tool.controller';
import { PointEditToolController } from 'src/features/tool/edit-tool/point-edit-tool.controller';
import i18next from 'i18next';

export class ToolService extends BaseService {
  private readonly dataSource = new CustomDataSource('tool.drawings');
  private readonly dataSourceForEdits = new CustomDataSource('tool.edit');

  /**
   * All current features, mapped by their ids.
   * Note that each feature is also present in {@link geometries}.
   *
   * * @private
   */
  private readonly features = new Map<Id<Feature>, Feature>();

  private readonly featureChanged$ = new Subject<Id<Feature>>();

  private readonly _features$ = this.featureChanged$.pipe(
    startWith(null),
    map(() => [...this.features.values()]),
    shareReplay(1),
  );

  /**
   * All current geometries, mapped by their ids.
   * @private
   */
  private readonly geometries = new Map<Id<Geometry>, Geometry>();

  /**
   * A mapping from the ids of a geometry to the entity by which it is represented on the viewer.
   *
   * @private
   */
  private readonly geometriesToEntities = new Map<Id<Geometry>, Entity>();

  private _viewer: Viewer | null = null;

  private readonly _activeTool$ = new BehaviorSubject<Tool | null>(null);

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
        viewer.dataSources.add(this.dataSourceForEdits).then();
      }
    });
  }

  public get features$(): Observable<Feature[]> {
    return this._features$;
  }

  public get isEmpty(): boolean {
    return this.features.size === 0;
  }

  public findFeature(id: Id<Feature>): Feature | null {
    return this.features.get(id) ?? null;
  }

  public findFeature$(id: Id<Feature>): Observable<Feature | null> {
    return this.featureChanged$.pipe(
      startWith(id),
      map((id) => this.findFeature(id)),
    );
  }

  public addFeature(feature: Feature): void {
    if (this.features.has(feature.id)) {
      throw new Error(`feature already exists: ${feature.id}`);
    }
    this.features.set(feature.id, feature);
    this.draw(feature.geometry);
  }

  public addFeatures(features: Feature[]): void {
    for (const feature of features) {
      this.addFeature(feature);
    }
  }

  public removeFeature(id: Id<Feature>): void {
    const feature = this.features.get(id);
    if (feature === undefined) {
      return;
    }
    this.features.delete(id);
    this.removeGeometry(feature.geometry.id);
    this.featureChanged$.next(id);
  }

  public activate(tool: Tool): void {
    this.deactivate();
    switch (tool.type) {
      case ToolType.Draw:
        this.activateDrawTool(tool);
        break;
      case ToolType.Edit:
        this.activateEditTool(tool);
        break;
    }
    this._activeTool$.next(tool);
  }

  public deactivate(): void {
    this.activeToolSubscription?.unsubscribe();
    this.activeToolSubscription = null;
  }

  public get activeTool$(): Observable<Tool | null> {
    return this._activeTool$.asObservable();
  }

  public selectToolByType$<T extends ToolType>(type: ToolType): Observable<(Tool & { type: T }) | null> {
    return this.activeTool$.pipe(filter((it): it is (Tool & { type: T }) | null => it === null || it.type === type));
  }

  public getNameOfFeature(feature: Feature): string {
    const { name, geometry } = feature;
    if (typeof name === 'string') {
      return name;
    }
    if ('number' in name) {
      const shapeName = i18next.t(`tool.shapes.${geometry.shape}`, { ns: 'features' });
      return `${shapeName} ${name.number}`;
    }
    const base = this.findFeature(name.baseId)!;
    return i18next.t('tool.name_for_copied_geometry', { ns: 'feature', base: this.getNameOfFeature(base) });
  }

  private get viewer(): Viewer {
    if (this._viewer === null) {
      throw new Error('viewer is not yet available');
    }
    return this._viewer;
  }

  private activateDrawTool(tool: DrawTool): void {
    const controller = this.makeDrawToolController(tool.shape);
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

    let geometry: Geometry | null = null;
    controller.geometry$.subscribe({
      next: (nextGeometry) => {
        geometry = nextGeometry;
        this.draw(geometry, this.styles.sketch);
      },
      complete: () => {
        if (geometry === null) {
          return;
        }
        if (shouldBeSaved) {
          this.features.set(geometry.id, {
            id: geometry.id,
            name: {
              number: this.findNextFeatureNumber(geometry.shape),
            },
            geometry,
          });
          this.draw(geometry, this.styles.default);
        } else {
          this.removeGeometry(geometry.id);
        }
      },
    });

    this.activeToolSubscription = new Subscription();
    this.activeToolSubscription.add(() => {
      this._activeTool$.next(null);
      controller.destroy();
      screen.destroy();
    });
  }

  private makeDrawToolController(shape: Shape): DrawToolController {
    switch (shape) {
      case Shape.Point:
        return new DrawPointToolController();
      case Shape.Line:
        return new DrawLineToolController();
      case Shape.Polygon:
        return new DrawPolygonToolController();
      case Shape.Rectangle:
        return new DrawRectangleToolController();
    }
  }

  private activateEditTool(tool: EditTool): void {
    const feature = this.features.get(tool.featureId);
    if (feature === undefined) {
      throw new Error(`no such feature: ${tool.featureId}`);
    }

    const controller = this.makeEditToolController(feature.geometry);
    const screen = new ScreenSpaceEventHandler(this.viewer.canvas);

    const featureEntity = this.geometriesToEntities.get(feature.geometry.id)!;
    if (feature.geometry.shape === Shape.Point) {
      featureEntity.position = new CallbackPositionProperty(() => controller.anchors[0].coordinate, false);
    } else {
      featureEntity.properties!.coordinates = new CallbackProperty(
        () => controller.anchors.filter((it) => it.type === EditAnchorType.Node).map((it) => it.coordinate),
        false,
      );
    }

    const makeAnchorEntity = (anchor: EditAnchor): Entity => {
      const entity = new Entity({
        id: `${anchor.id}`,
        position: anchor.coordinate,
        properties: {
          type: Shape.Point,
          drawStyle: this.constructor,
          color: Color.WHITE,
        },
        point: {
          color: new CallbackProperty(() => (entity.properties!.color as Property).getValue(), false),
          outlineWidth: 1,
          outlineColor: Color.BLACK,
          pixelSize: 9,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
      });
      updateAnchorEntity(entity, anchor);
      return entity;
    };

    const updateAnchorEntity = (entity: Entity, anchor: EditAnchor): void => {
      entity.position = new ConstantPositionProperty(anchor.coordinate);
      let color: Color;
      switch (anchor.type) {
        case EditAnchorType.Node:
          color = Color.WHITE;
          break;
        case EditAnchorType.Edge:
          color = Color.GRAY;
          break;
        case EditAnchorType.Virtual:
          throw new Error('Virtual anchors should not be displayed.');
      }
      entity.properties!.color = color;
    };

    for (const anchor of controller.anchors) {
      if (anchor.type === EditAnchorType.Virtual) {
        continue;
      }
      this.dataSourceForEdits.entities.add(makeAnchorEntity(anchor));
    }

    let activeAnchorId: Id<EditAnchor> | null = null;
    let isGeometryActive = false;
    screen.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
      const objects = this.viewer.scene.drillPick(event.position, 5, 5, 5);
      for (const object of objects) {
        if (!('id' in object) || !(object.id instanceof Entity)) {
          continue;
        }
        const { id: entity } = object;
        if (entity === featureEntity) {
          isGeometryActive = true;
          continue;
        }

        const anchor = controller.anchors.find((it) => it.id === entity.id);
        if (anchor === undefined) {
          continue;
        }
        activeAnchorId = anchor.id;
        break;
      }
      if (activeAnchorId !== null || isGeometryActive) {
        this.viewer.scene.screenSpaceCameraController.enableInputs = false;
      }
    }, ScreenSpaceEventType.LEFT_DOWN);

    screen.setInputAction(() => {
      activeAnchorId = null;
      isGeometryActive = false;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }, ScreenSpaceEventType.LEFT_UP);

    screen.setInputAction((event: ScreenSpaceEventHandler.MotionEvent) => {
      const position = this.pick(event.endPosition);
      if (position === null) {
        return;
      }
      if (activeAnchorId !== null) {
        controller.handleAnchorDrag(activeAnchorId, position);
      } else if (isGeometryActive) {
        controller.handleGeometryDrag(position);
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);

    controller.anchorChanged$.subscribe((anchor) => {
      if (anchor.type !== EditAnchorType.Virtual) {
        const entity = this.dataSourceForEdits.entities.getById(`${anchor.id}`);
        if (entity === undefined) {
          this.dataSourceForEdits.entities.add(makeAnchorEntity(anchor));
        } else {
          updateAnchorEntity(entity, anchor);
        }
      }

      this.viewer.scene.requestRender();
    });

    this.activeToolSubscription = new Subscription(() => {
      screen.destroy();
      this.dataSourceForEdits.entities.removeAll();
    });
  }

  private makeEditToolController(geometry: Geometry): EditToolController {
    switch (geometry.shape) {
      case Shape.Point:
        return new PointEditToolController(geometry.coordinate);
      case Shape.Line:
        return new CoordinateListEditToolController(geometry.coordinates, { isArea: false });
      case Shape.Polygon:
        return new CoordinateListEditToolController(geometry.coordinates, { isArea: true });
      case Shape.Rectangle:
        return new RectangleEditToolController(geometry);
    }
  }

  private draw(geometry: Geometry, style: DrawStyleController = this.styles.default): void {
    const entity = this.geometriesToEntities.get(geometry.id);
    if (entity == null) {
      // It's a new geometry.
      const newEntity = style.makeEntity(geometry);
      this.dataSource.entities.add(newEntity);
      this.geometriesToEntities.set(geometry.id, newEntity);
    } else {
      // The geometry exists already, but it has probably changed in some way.
      const updatedEntity = style.updateEntity(entity, geometry);
      if (updatedEntity !== entity) {
        this.dataSource.entities.remove(entity);
        this.dataSource.entities.add(updatedEntity);
        this.geometriesToEntities.set(geometry.id, updatedEntity);
      }
    }
    this.geometries.set(geometry.id, geometry);
    this.featureChanged$.next(geometry.id);
    this.viewer.scene.requestRender();
  }

  private removeGeometry(id: Id<Geometry>): void {
    this.geometries.delete(id);
    this.geometriesToEntities.delete(id);
    this.dataSource.entities.removeById(`${id}`);
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

  private findNextFeatureNumber(shape: Shape): number {
    let max = 0;
    for (const feature of this.features.values()) {
      if (
        feature.geometry.shape === shape &&
        typeof feature.name === 'object' &&
        'number' in feature.name &&
        feature.name.number > max
      ) {
        max = feature.name.number;
      }
    }
    return max + 1;
  }
}
