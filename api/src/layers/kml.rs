use crate::LayerSource;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct KMLLayer {
    /// The layer's source, defining where the layer is loaded from.
    pub source: LayerSource,
}
