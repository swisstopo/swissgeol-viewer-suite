use crate::LayerSource;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct Tiles3dLayer {
    /// The layer's source, defining where the layer is loaded from.
    source: LayerSource,

    /// The order in which the layer's properties are sorted when displayed.
    /// Keys that are left out will be sorted below any sorted ones, in default order.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    order_of_properties: Vec<String>,
}
