use serde::{Deserialize, Serialize};
use crate::LayerSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct EarthquakesLayer {
    /// The layer's source, defining where the layer is loaded from.
    source: LayerSource,
}
