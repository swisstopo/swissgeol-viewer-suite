use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct Tiles3dLayer {
    /// The layer's source, defining where the layer is loaded from.
    source: Tiles3dLayerSource,

    /// The order in which the layer's properties are sorted when displayed.
    /// Keys that are left out will be sorted below any sorted ones, in default order.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    order_of_properties: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Tiles3dLayerSource {
    #[serde(rename_all(serialize = "camelCase"))]
    CesiumIon {
        /// The id of the asset on Cesium Ion that represents the layer.
        asset_id: u32,
    },

    #[serde(rename_all(serialize = "camelCase"))]
    Earthquakes {
        /// The url at which the earthquake file can be found.
        url: String,
        // TODO Decide how to handle `detailsUrl`.
    },
}
