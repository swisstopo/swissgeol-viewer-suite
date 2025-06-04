# Release Process

This document is meant to explain the release process of the swissgeol Viewer application.
It details how new features are deployed, and how the development process affect the product's version numbers.

[1. Development Cycle](#development-cycle)  
[1.1. Development Branch](#development-branch)  
[1.1. Release Candidate](#release-candidate)  
[1.1. Release](#release)  
[2. Hotfixes](#hotfixes)  
[3. Versioning](#versioning)  
[4. Naming Conventions for Branches](#naming-conventions-for-branches)

## Development Cycle

Our development and release cycle is based on Git branches.
The default procedure is _development branch_ → `develop` → `main`.

### Development Branch

When developing, a new branch should be created based on `develop`,
see [Naming Conventions for Branches](#naming-conventions-for-branches)
When the branch's change is fully developed, a _pull request_ can be opened that targets `develop`.
After receiving the approval of at least one reviewer, the PR can be merged.

During development, it can be beneficial to structure your commits as [atomically](https://en.wikipedia.org/wiki/Atomic_commit?useskin=vector) as possible, within reason.
This makes it easier to track your changes and can also help during review.
However, before merging your PR, you should consider squashing your commits into a smaller set of large commits.
This keeps our final commit graph clean and simple.
Commonly, a single final commit per PR is enough, although there are definitely situations when more than that can be beneficial.

### Release Candidate

When a set of changes is ready to be reviewed by the product owners, a _release candidate_ is created.
This is done by merging `develop` into `main` via pull request.

### Release

When a release candidate is approved by the product owners,
the changes can be fully released by manually triggering the
[Publish PROD](https://github.com/swisstopo/swissgeol-viewer-suite/actions/workflows/publish-prod.yml) workflow.

## Hotfixes

The only exception to the normal development cycle are _hotfixes_.
A hotfix is a change that has to be deployed as soon as possible, and should be independent,
i.e. not pull other changes along with it.
To that end, a hotfix skips the `develop` branch and instead merges directly into `main`,
from where it can be deployed using the normal release process.

There are only two main differences during development between hotfixes and normal changes:

- Hotfixes are based on `main`, not `develop`.
- Hotfix are merged directly into `main`, i.e. `hotfix/*` → `main`.

Note that afer merging into `main`, you should immediately open a new PR from `main` to `develop`
to ensure the hotfix is present in everyone's current working tree.

## Versioning

This project follows [Semantic Versioning](https://semver.org/).  
**The major version** is pinned and would only change during full rewrites or replacement projects,
of which none are currently planned.  
**The minor version** changes with every new release.  
**The patch version** changes when a hotfix is deployed.

During development, versions are identified by suffix labels.

- When merging into `develop`, a _development version_ in the format `A.B.C-devX` is assigned.
  `A.B.C` is based on the current full release, with `B` incremented by one and `C` set to zero.
  `X` increments with every continuous merge where `A.B.C` doesn't change.
- When merging `develop` into `main`, a _release candidate_ in the format `A.B.C-rcX` is assigned.
  `A.B.C` is based on the development version that the merge is based on.
  `X` increments with every continuous merge where `A.B.C` doesn't change.
- When releasing `main`, a _release version_ is created by stripping the label from the current release candidate.

A special case to this process are hotfixes:

- When merging a `hotfix/*` branch into `main`, a _hotfix version_ in the format `A.B.C-hotfixX` is assigned.
  `A.B.C` is based on the current full release, with `C` incremented by one.
  `X` increments with every continuous merge where `A.B.C` doesn't change.
- When releasing `main` while the head is a hotfix is, that hotfix version is used instead of the latest release candidate.

These rules give us the following behavior, ensuring consistent and idempotent versioning:

- Hotfixes only increment the patch version.
- Development versions only increment the minor version.
- Release candidates are always based on development versions and don't change the version any further.
- Releases simply use the latest version on `main` and strip its label, regardless of it being a release candidate or hotfix.

## Naming Conventions for Branches

> Note that branch names other than `main` and `develop` do not impact the release process.
> The following conventions are purely for standardization and documentation purposes.

The branch should follow the naming convention `{branch-type}/viewer-{issue}-{title}`, where:

- `{branch-type}` describes the impact of the change.
- `{issue}` is the ID of the GitHub issue that describes the change.
- `{title}` is the issue's title, put into `snake-case` and possibly shortened for ease of use.

The following branch types can be used:

- `feature/` are new features or functional changes to existing ones. This is the most common change type.
- `bugfix/` are bugfixes. They should mainly be used when the branch's issue is labelled as `bug`.
- `hotfix/` are changes that are meant to be deployed ASAP. Unlike other branches, hotfixes should be based on and target `main`.
- `chore/` are maintenance tasks, such as dependency updates or documentation tasks.

For special cases where a branch is created that is not backed by an issue,
the naming convention changes to `{branch-type}/{title}`, where `{title}` needs to be defined ad-hoc.
