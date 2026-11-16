import { describe, expect, it, vi } from 'vitest';
import { Cartesian2, Scene } from 'cesium';
import { patchTranslucentDepthPick } from 'src/cesium/patch-translucent-depth-pick';

const COMPUTE_PASS = 1;
const OPAQUE_PASS = 9;

const createScene = (pickTranslucentDepth: boolean) => {
  const commandList: { pass?: number }[] = [];
  const pickPosition = vi.fn(() => commandList.slice());
  const pickPositionWorldCoordinates = vi.fn(() => commandList.slice());
  const scene = {
    pickTranslucentDepth,
    frameState: { commandList },
    pickPosition,
    pickPositionWorldCoordinates,
  } as unknown as Scene;
  return {
    scene,
    commandList,
    pickPosition,
    pickPositionWorldCoordinates,
  };
};

describe('patchTranslucentDepthPick', () => {
  it.each(['pickPosition', 'pickPositionWorldCoordinates'] as const)(
    'drops stale compute commands before %s, keeping everything else',
    (method) => {
      const fake = createScene(true);
      const draw = { pass: OPAQUE_PASS };
      const other = {};
      fake.commandList.push(
        { pass: COMPUTE_PASS },
        draw,
        { pass: COMPUTE_PASS },
        other,
      );
      patchTranslucentDepthPick(fake.scene);

      const position = new Cartesian2(1, 2);
      const seenByOriginal = fake.scene[method](position);

      expect(seenByOriginal).toEqual([draw, other]);
      expect(fake.commandList).toEqual([draw, other]);
      expect(fake[method]).toHaveBeenCalledWith(position);
      expect(fake[method].mock.contexts[0]).toBe(fake.scene);
    },
  );

  it('leaves the command list untouched without translucent depth picking', () => {
    const fake = createScene(false);
    const compute = { pass: COMPUTE_PASS };
    fake.commandList.push(compute);
    patchTranslucentDepthPick(fake.scene);

    fake.scene.pickPosition(new Cartesian2());

    expect(fake.commandList).toEqual([compute]);
  });
});
