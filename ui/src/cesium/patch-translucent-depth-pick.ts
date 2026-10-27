// `Pass` is a runtime export of CesiumJS, but it is marked `@private` and
// therefore missing from the published type definitions.
// @ts-expect-error see above
import { Pass, Scene } from 'cesium';

interface RenderCommand {
  pass?: number;
}

/** Private (untyped) CesiumJS `Scene` members used by this patch. */
type PatchableScene = Scene & {
  readonly frameState: { readonly commandList: RenderCommand[] };
  pickPositionWorldCoordinates: Scene['pickPosition'];
};

/**
 * Prevents `Scene.pickPosition` from re-executing the previous frame's
 * `ComputeCommand`s while `scene.pickTranslucentDepth` is enabled.
 *
 * `renderTranslucentDepthForPick` does not clear `frameState.commandList`, so
 * single-use compute commands run twice, which destroys resources still in use
 * and eventually stops the render loop. To avoid this, compute commands are
 * removed from the stale list before each pick; draw commands are kept, as the
 * pick needs them. Compute commands queued during the pick still run once.
 *
 * @see https://github.com/CesiumGS/cesium/issues/11427#issuecomment-6375611763
 * @see https://github.com/CesiumGS/cesium/pull/13979
 *
 * TODO: Remove once the upstream fix is part of the CesiumJS version in use.
 */
export function patchTranslucentDepthPick(target: Scene): void {
  const scene = target as PatchableScene;

  const dropStaleComputeCommands = (): void => {
    if (!scene.pickTranslucentDepth) {
      return;
    }
    const { commandList } = scene.frameState;
    let length = 0;
    for (const command of commandList) {
      if (command.pass !== Pass.COMPUTE) {
        commandList[length++] = command;
      }
    }
    commandList.length = length;
  };

  const pickPosition = scene.pickPosition;
  scene.pickPosition = function (...args) {
    dropStaleComputeCommands();
    return pickPosition.apply(this, args);
  };

  const pickPositionWorldCoordinates = scene.pickPositionWorldCoordinates;
  scene.pickPositionWorldCoordinates = function (...args) {
    dropStaleComputeCommands();
    return pickPositionWorldCoordinates.apply(this, args);
  };
}
