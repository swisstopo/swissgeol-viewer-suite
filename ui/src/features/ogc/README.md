# OGC Integration Tests

This directory contains integration tests for the OGC API service (`https://ogc-api.gst-viewer.swissgeol.ch`).

## ⚠️ Important Notes

- **These tests make REAL API calls** to the production OGC service
- **Do not run these tests repeatedly** - they consume real resources
- Tests are **explicitly excluded** from normal test runs
- Each test downloads and extracts actual data files

## Running the Tests

```bash
# Run all OGC integration tests (hits real API!)
npm run test:ogc
```

## What Each Test Does

1. **Creates a job** - Submits a request to the OGC API with test layer configuration
2. **Polls for completion** - Tracks job progress through stages (Prepare → Running → Success)
3. **Downloads result** - Fetches the generated ZIP file
4. **Extracts files** - Unzips into a timestamped folder (e.g. `temp-ogc-tests/ch.swisstopo.geologie-geocover-2026-04-28-11-43-00-{jobId}/`)
5. **Checks for errors** - If a file named `stac@swisstopo_error.txt` exists anywhere in the extracted directory (recursively), the test fails and prints its content
6. **Cleans up** - Deletes the job from the API

## Error Detection

The only validation performed on the downloaded result is checking for the presence of `stac@swisstopo_error.txt` files. If any such file is found anywhere in the extracted directory tree, the test fails and the content of all error files is printed as the error message.

## Test Output

Each test provides detailed console output:

```
[STAC GeoCover Test] Starting job...
[STAC GeoCover Test] Job created: abc-123-def
  [abc-123-def] Prepare - 0.0%
  [abc-123-def] Running - 45.2%
  [abc-123-def] Running - 89.7%
  [abc-123-def] Success
  [abc-123-def] Downloading result...
  [abc-123-def] Downloaded 2456789 bytes
  [abc-123-def] Saved to .../temp-ogc-tests/ch.swisstopo.geologie-geocover-2026-04-28-11-43-00-abc-123-def/result.zip
  [abc-123-def] Extracting...
  [abc-123-def]   - data/layer1.tif (456123 bytes)
  [Cleanup] Deleted job abc-123-def
```

## File Structure

```
src/features/ogc/
├── ogc.service.ts                    # OGC service implementation
├── ogc.service.ogc.test.ts           # Integration tests (run explicitly)
└── README.md                         # This file
```
