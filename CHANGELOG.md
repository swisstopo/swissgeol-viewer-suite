# Changelog

## [1.4.0]

### Changed
- Google Analytics is now only running in PROD.

## [1.3.0]

### Added
- Added a control with which the camera can be fixed in a 2d top-down position.
- The filter window for voxel layers can now be closed without resetting the layer.

### Changed
- Removed the target point control as it is currently not working properly.
- The context button of activated layers is no longer disabled when the layer is hidden.
- The new Rheintal layer no longer offers a conductivity filter.

### Fixed
- Fixed the beta ribbon being missing on PROD.
- Fixed Google Analytics not being properly included.
- Voxel layers can now be made transparent via the opacity slider.

## [1.1.0]

### Added
- The camera settings panel now contains actual input fields.
- Activated layers and geometries now appear as counters in the sidebar.
- The search input can now be navigated via arrows.
- Added the Rheintal voxel layer.

### Changed
- Configurations that are relevant to the UI are now exposed via API endpoint.
- The sidebar and header have been redesigned.
- The data catalog panel has been redesigned.
- The disclaimer has been redesigned and adjusted to align with other swissgeol applications.

### Fixed
- The maximum zoom level is now restricted again.
- The order of layers now stays consistent on reload.
- Editing of geometries no longer freezes after moving the map anchors.
- Slicing box arrows no longer disappear when exaggerating.
- The select input for adding members to projects now works as intended.
- Geometry copies are now fully independent of their original.

## [1.0.0]

### Added
- Add `PG_SSL_MODE` environment variable to allow SSL connections between the API and database.

- The application's frontend is now built on [Vite](https://vite.dev/),
  enabling faster development and easier configuration.

- The application's deployment, including Kubernetes configuration,
  is now managed via GitHub Actions.


### Changed
- Values for "Height", "Angle", "Pitch", and coordinates are now input fields. Users can adjust values using arrow keys.

- The range for height has been increased to 700'000m.

- Config is loaded from the frontend at runtime now.

- The main search input now supports selection of results
  via direct enter, as well as keyboard navigation.

- The header and side navigation has been updated to the new design.

- The layers sidebar has been updated to the new design.
  Some parts of it, namely the catalog and the selected layers,
  have been left in the old design and will be changed
  in an upcoming release. 

- The disclaimer has been changed to a required, blocking pop-up.

### Fixed
