import { CallbackProperty, Color, ColorMaterialProperty } from 'cesium';
import { OBJECT_HIGHLIGHT_COLOR } from 'src/constants';

/** Keeps the base material available while its highlight and opacity change. */
export class HighlightColorMaterialProperty extends ColorMaterialProperty {
  private unhighlightedMaterial: ColorMaterialProperty;

  constructor(private readonly originalMaterial: ColorMaterialProperty) {
    super();
    this.unhighlightedMaterial = originalMaterial;
    this.updateHighlightColor();
  }

  get baseMaterial(): ColorMaterialProperty {
    return this.unhighlightedMaterial;
  }

  setOpacity(opacity: number): void {
    const original = this.originalMaterial;
    this.unhighlightedMaterial = new ColorMaterialProperty(
      new CallbackProperty(
        (time, result) =>
          Color.fromAlpha(
            original.color?.getValue(time) ?? Color.WHITE,
            opacity,
            result,
          ),
        original.isConstant,
      ),
    );
    this.updateHighlightColor();
  }

  private updateHighlightColor(): void {
    const material = this.unhighlightedMaterial;
    this.color = new CallbackProperty(
      (time, result) =>
        OBJECT_HIGHLIGHT_COLOR.withAlpha(
          material.color?.getValue(time)?.alpha ?? 1,
          result,
        ),
      material.isConstant,
    );
  }
}
