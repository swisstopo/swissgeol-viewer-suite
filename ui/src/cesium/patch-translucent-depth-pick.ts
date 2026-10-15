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
 * ## Root cause (CesiumJS bug)
 *
 * With `pickTranslucentDepth`, every `pickPosition` call renders a full
 * extra frame into a pick-depth framebuffer (`renderTranslucentDepthForPick`
 * in `Picking.js`). Unlike every other pick path, that function never calls
 * `scene.updateFrameState()`, so `frameState.commandList` is *not* cleared
 * beforehand: it still holds the full command list of the previously
 * rendered frame, and `executeComputeCommands` runs every compute command
 * in it a second time.
 *
 * Compute commands are single-use: after they run, `ComputeEngine` and
 * their `postExecute` callbacks destroy their resources. Running them
 * again therefore:
 *  - draws into deleted textures ("WebGL: INVALID_OPERATION:
 *    framebufferTexture2D: attempt to use a deleted object", "Framebuffer is
 *    incomplete"),
 *  - throws `DeveloperError: This object was destroyed` from inside the pick,
 *  - and replays `postExecute` side effects. In `DynamicEnvironmentMapManager`
 *    this double-counts finished faces, so the vertex array shared by all
 *    pending specular convolution commands is destroyed too early. The next
 *    *regular* frame then draws with it, `scene.renderError` fires and
 *    `CesiumWidget` stops its render loop for good: the app freezes.
 *    `ImageryLayer` reprojection commands have the same problem
 *    (`postExecute` releases the imagery a second time).
 *
 * This happens most visibly while many 3D tilesets are still loading. Each
 * tileset bakes its own environment map using dozens of compute commands,
 * spread over many frames by a global per-frame cap. Meanwhile, the camera
 * controllers call `pickPosition` on every frame of a drag, so almost every
 * interaction during loading re-executes compute commands. Without
 * interaction (no picks) or after loading (no compute commands), nothing
 * goes wrong.
 *
 * ## Fix
 *
 * Remove compute commands from the stale command list before each pick. All
 * of them already ran in the frame that queued them, so nothing is lost. The
 * remaining (draw) commands are kept on purpose: the translucent-depth pick
 * relies on them to render the scene depth. Compute commands queued *during*
 * the pick pass are unaffected and still run exactly once.
 *
 * TODO: Remove once CesiumJS clears stale compute commands in
 * `renderTranslucentDepthForPick` itself.
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
