import {
  findBaseVersionForDev,
  findLatestDevVersion,
  findLatestHotfixVersion,
  findLatestNextVersion,
  findLatestRcVersion,
  findLatestReleaseVersion,
} from "./package.utils.mjs";

const SEMANTIC_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-\w+)?$/;
export const parseVersion = (tag) => {
  if (!SEMANTIC_VERSION_PATTERN.test(tag)) {
    return null;
  }
  const [major, minor, patch, preRelease] = tag.split(/[.-]/);
  return {
    major: parseInt(major),
    minor: parseInt(minor),
    patch: parseInt(patch),
    preRelease: preRelease === undefined || preRelease.length === 0 ? null : parsePreRelease(preRelease),
  };
};

const NUMBERED_PRERELEASE_PATTERN = /^([a-zA-Z]+)(\d+)$/;
const parsePreRelease = (preRelease) => {
  const match = preRelease.match(NUMBERED_PRERELEASE_PATTERN);
  if (match === null) {
    return { tag: preRelease, number: null };
  }
  const [_, tag, number] = match;
  return { tag, number: parseInt(number) };
};

export const stringifyVersion = (version) => {
  const string = `${version.major}.${version.minor}.${version.patch}`;
  if (version.preRelease === null) {
    return string;
  }
  return `${string}-${version.preRelease.tag}${version.preRelease.number ?? ""}`;
};

export const isSameVersion = (a, b, { ignorePreRelease } = {}) => {
  const isEqual = a.major === b.major && a.minor === b.minor && a.patch === b.patch;
  return (
    (ignorePreRelease && isEqual) ||
    (isEqual && a.preRelease?.tag === b.preRelease?.tag && a.preRelease?.number === b.preRelease?.number)
  );
};

export const compareBaseVersions = (a, b) => {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.major - b.major;
  }
  return a.patch - b.patch;
};

/**
 * Determines the version that a new dev release should have based on the branch that triggered
 * the release by being merged into the release branch.
 *
 * This function is meant to be used when Dev releases should be triggered by merges into `main`.
 * - Merges from `develop` will base their version on the latest dev version.
 *   If there is already a release candidate for that version, the pre-release number is incremented.
 * - Merges from any other branch will be regarded as hotfixes and simply increase the latest release's patch number.
 *
 * @param sourceBranch The source branch's name.
 * @returns {Promise<object>} The next version.
 */
export const determineNextDevVersion = async (sourceBranch) => {
  const tag = "dev";

  if (sourceBranch === "next") {
    const releaseVersion = await findLatestReleaseVersion();
    if (releaseVersion === null) {
      throw new Error(`Merging next requires a release to be present.`);
    }
    const devVersion = await findLatestDevVersion();
    if (devVersion === null || !isSameVersion(releaseVersion, devVersion, { ignorePreRelease: true })) {
      return { major: releaseVersion.major + 1, minor: 0, patch: 0, preRelease: { tag, number: 1 } };
    }
    return { ...devVersion, preRelease: { tag, number: devVersion.number + 1 } };
  }

  const version = await findBaseVersionForDev();

  // if there is no previous version,
  // then we start with a new pre-release version.
  if (version === null) {
    return { major: 1, minor: 0, patch: 0, preRelease: { tag, number: 1 } };
  }

  // If the previous version was a full release,
  // or if it was a patch pre-release,
  // then we increment the minor version and reset the pre-release number.
  if (version.preRelease === null || version.patch !== 0) {
    return {
      ...version,
      minor: version.minor + 1,
      patch: 0,
      preRelease: { tag, number: 1 },
    };
  }

  // If the previous version was a minor pre-release,
  // then we increment the pre-release number.
  return {
    ...version,
    preRelease: { tag, number: version.preRelease.number + 1 },
  };
};

/**
 * Determines the version that a new release candidate should have based on the branch that triggered
 * the release by being merged into the release branch.
 *
 * This function is meant to be used when release candidates should be triggered by merges into `develop`.
 * - Merges from `next` will create a new major dev release.
 *   If there is already a dev release for that version, the pre-release number is incremented.
 * - Merges from any other branch will be regarded as minor changes.
 *
 * @param sourceBranch The source branch's name.
 * @returns {Promise<object>} The next version.
 */
export const determineNextRcVersionBySourceBranch = async (sourceBranch) => {
  // Merges from `develop` are "normal" release candidates.
  // They take their version from the latest dev release.
  if (sourceBranch === "develop") {
    const tag = "rc";

    const devVersion = await findLatestDevVersion();
    if (devVersion === null) {
      throw new Error("Merge from 'develop' expects a dev release to be present, but none was found.");
    }

    const rcVersion = await findLatestRcVersion();
    if (rcVersion === null || !isSameVersion(devVersion, rcVersion, { ignorePreRelease: true })) {
      // If there is no rc version or if the dev version has a different base then the rc version,
      // then we use the dev version as base and simply start with the number set to 1.
      return { ...devVersion, preRelease: { tag, number: 1 } };
    }

    // If the previous rc version had the same base version as the dev version,
    // we only need to increment the preRelease number.
    return {
      ...rcVersion,
      preRelease: { tag, number: rcVersion.preRelease.number + 1 },
    };
  }

  // Sources other than `develop` are considered to be hotfixes.

  const tag = "hotfix";

  const releaseVersion = await findLatestReleaseVersion();
  if (releaseVersion === null) {
    throw new Error("Hotfix expects a release to be present, but none was found.");
  }

  const hotfixVersion = await findLatestHotfixVersion();
  console.log({ hotfixVersion });
  if (hotfixVersion === null || compareBaseVersions(releaseVersion, hotfixVersion) >= 0) {
    // If there is no preceding hotfix or if the hotfix has already been released,
    // then we use the release version but increase its patch number.
    return {
      ...releaseVersion,
      patch: releaseVersion.patch + 1,
      preRelease: { tag, number: 1 },
    };
  }

  // If the preceding hotfix has not yet been released, we simply increment its version number.
  return {
    ...hotfixVersion,
    preRelease: { tag, number: hotfixVersion.preRelease.number + 1 },
  };
};

/**
 * Determines the version that a new production release should have based on the branch that triggered
 * the release by being merged into the release branch.
 *
 * This function is meant to be used when production releases should be triggered by merges into `main`.
 * - Merges from `develop` will base their version on the latest dev version.
 * - Merges from any other branch will be regarded as patches and simply increase the latest release's patch number.
 *
 * @param sourceBranch The source branch's name.
 * @returns {Promise<object>} The next version.
 */
export const determineNextReleaseVersionBySourceBranch = async (sourceBranch) => {
  // Merges from `develop` are "normal" release candidates.
  // They take their version from the latest dev release.
  if (sourceBranch === "develop") {
    const devVersion = await findLatestDevVersion();
    if (devVersion === null) {
      throw new Error("Merge from 'develop' expects a dev release to be present, but none was found.");
    }
    return { ...devVersion, preRelease: null };
  }

  // Sources other than `develop` are considered to be patches.
  const releaseVersion = await findLatestReleaseVersion();
  if (releaseVersion === null) {
    throw new Error("Hotfix expects a release to be present, but none was found.");
  }
  return {
    ...releaseVersion,
    patch: releaseVersion.patch + 1,
  };
};

/**
 * Determines the version that a new next version should have.
 *
 * This function is meant to be used when next releases should be triggered by merges into `next`.
 *
 * @returns {Promise<object>} The next version.
 */
export const determineNextNextVersion = async () => {
  const tag = "next";

  const releaseVersion = await findLatestReleaseVersion();
  if (releaseVersion === null) {
    throw new Error("A release version needs to be present to determine the next next version.");
  }

  const nextVersion = await findLatestNextVersion();
  if (nextVersion === null) {
    return { major: releaseVersion.major + 1, minor: 0, patch: 0, preRelease: { tag, number: 1 } };
  }
  return { ...nextVersion, preRelease: { tag, number: nextVersion.preRelease.number + 1 } };
};
