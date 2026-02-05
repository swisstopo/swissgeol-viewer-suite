use crate::LayerSource;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct GeoJsonLayer {
    /// The layer's source, defining where the layer is loaded from.
    pub source: LayerSource,

    /// The source for the layer's terrain.
    /// If absent, the GeoJson is draped directly onto the default terrain.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terrain: Option<LayerSource>,
}
