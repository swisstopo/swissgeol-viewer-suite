import { getOctokit } from './octokit.mjs';
import {
  compareBaseVersions,
  isSameVersion,
  parseVersion,
  stringifyVersion,
} from './version.utils.mjs';
import { packages, packageType } from './package.config.mjs';

const defaultPackage = Object.values(packages)[0];

/**
 * Attempts to parse the latest version from the published packages that a new `dev` version should be based on.
 * The returned version is resolved as following:
 * - If the first matching version is a full release, that version is returned (e.g. `1.5.0`).
 * - If the first matching version is a dev release, that version is returned (e.g. `1.6.0-dev12`).
 * - Release candidates (e.g. `1.6.0-rc2`) are simply ignored.
 *
 * @returns {Promise<object|null>} The latest dev version, or `null`.
 */
export const findBaseVersionForDev = () =>
  findLatestVersionByPredicate(
    (version) =>
      version.preRelease === null || version.preRelease.tag === 'dev',
  );

/**
 * Attempts to parse the latest dev version from the published packages.
 * @returns {Promise<object|null>} The latest dev version, or `null`.
 */
export const findLatestDevVersion = () =>
  findLatestVersionByPredicate((version) => version.preRelease?.tag === 'dev');

/**
 * Attempts to parse the latest release candidate version from the published packages.
 * @returns {Promise<object|null>} The latest rc version, or `null`.
 */
export const findLatestRcVersion = () =>
  findLatestVersionByPredicate((version) => version.preRelease?.tag === 'rc');

/**
 * Attempts to parse the latest hotfix version from the published packages.
 * @returns {Promise<object|null>} The latest hotfix version, or `null`.
 */
export const findLatestHotfixVersion = () =>
  findLatestVersionByPredicate(
    (version) => version.preRelease?.tag === 'hotfix',
  );

/**
 * Attempts to parse the latest next version from the published packages.
 * @returns {Promise<object|null>} The latest next version, or `null`.
 */
export const findLatestNextVersion = () =>
  findLatestVersionByPredicate((version) => version.preRelease?.tag === 'next');

/**
 * Attempts to parse the latest hotfix version from the published packages.
 * @returns {Promise<object|null>} The latest hotfix version, or `null`.
 */
export const findLatestReleasableVersion = () =>
  findLatestVersionByPredicate(
    (version) =>
      version.preRelease?.tag === 'hotfix' || version.preRelease?.tag === 'rc',
  );

/**
 * Attempts to parse the latest release version from the published packages.
 * @returns {Promise<object|null>} The latest release version, or `null`.
 */
export const findLatestReleaseVersion = () =>
  findLatestVersionByPredicate((version) => version.preRelease?.tag == null);

export const findOutdatedVersions = async (latestVersion) => {
  const outdatedVersions = [];
  await loadVersions({
    receive: (version, tags) => {
      if (version.preRelease === null) {
        return;
      }
      const hasReleaseTag =
        tags.has('edge') || tags.has('release-candidate') || tags.has('latest');
      if (!hasReleaseTag && compareBaseVersions(latestVersion, version) >= 0) {
        outdatedVersions.push(version);
      }
    },
    abort: () => false,
  });
  return outdatedVersions;
};

export const findLatestVersionByPredicate = async (test) => {
  let result = null;
  await loadVersions({
    receive: (...args) => {
      if (test(...args)) {
        result = args[0];
      }
    },
    abort: () => result !== null,
  });
  return result;
};

const CACHED_VERSIONS = [];
let FIRST_UNCACHED_VERSION_PAGE = 1;

const loadVersions = async ({ receive, abort, package: packageName }) => {
  const isCacheable =
    packageName === undefined || packageName === defaultPackage;

  if (isCacheable) {
    for (const [version, tags, packageId] of CACHED_VERSIONS) {
      receive(version, tags, packageId);
      if (abort()) {
        return;
      }
    }
    if (FIRST_UNCACHED_VERSION_PAGE === -1) {
      return;
    }
  }

  const { owner, name } = getPackageInfo(packageName ?? defaultPackage);

  let page = isCacheable ? FIRST_UNCACHED_VERSION_PAGE : 1;
  while (true) {
    await sleep(1000);
    const data = await fetchPackagePage(owner, name, page);
    if (data.length === 0) {
      if (isCacheable) {
        FIRST_UNCACHED_VERSION_PAGE = -1;
      }
      return;
    }
    let hasAborted = false;
    for (const entry of data) {
      const tags =
        packageType === 'npm' ? [entry.name] : entry.metadata.container.tags;
      const versions = [];
      const otherTags = new Set();
      for (const tag of tags) {
        const version = parseVersion(tag);
        if (version === null) {
          otherTags.add(tag);
        } else {
          versions.push(version);
        }
      }
      for (const version of versions) {
        if (isCacheable) {
          CACHED_VERSIONS.push([version, otherTags, entry.id]);
        }
        if (!hasAborted) {
          receive(version, otherTags, entry.id);
          hasAborted = abort();
        }
      }
    }
    page += 1;
    if (isCacheable) {
      FIRST_UNCACHED_VERSION_PAGE = page;
    }
    if (hasAborted) {
      return;
    }
  }
};

const getPackageInfo = (url) => {
  const [host, owner, name] = url.split('/');
  return { host, owner, name };
};

const fetchPackagePage = async (owner, name, page) => {
  const octokit = getOctokit();
  try {
    const response =
      await octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg({
        package_type: packageType,
        package_name: name,
        org: owner,
        page,
        per_page: 100,
      });
    return response.data;
  } catch (e) {
    if (e.status === 404) {
      return [];
    }
    throw e;
  }
};

export const removePackageVersions = async (versions) => {
  const octokit = getOctokit();

  for (const packageName of Object.values(packages)) {
    const { owner, name } = getPackageInfo(packageName);
    for (const version of versions) {
      let packageId = null;
      await loadVersions({
        package: packageName,
        receive: (currentVersion, _tags, currentPackageId) => {
          if (isSameVersion(version, currentVersion)) {
            packageId = currentPackageId;
          }
        },
        abort: () => packageId !== null,
      });
      if (packageId === null) {
        console.warn(
          `Package ${packageName}:${stringifyVersion(version)} not found, skipping deletion.`,
        );
        continue;
      }
      await octokit.rest.packages.deletePackageVersionForOrg({
        package_type: packageType,
        package_name: name,
        org: owner,
        package_version_id: packageId,
      });
    }
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));
