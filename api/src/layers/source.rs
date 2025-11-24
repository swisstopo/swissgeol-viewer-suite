use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LayerSource {
    #[serde(rename_all(serialize = "camelCase"))]
    CesiumIon {
        /// The id of the asset on Cesium Ion that represents the layer.
        asset_id: u32,
    },

    #[serde(rename_all(serialize = "camelCase"))]
    Url {
        /// The url at which the file can be found.
        url: String,
    },

    #[serde(rename_all(serialize = "camelCase"))]
    S3 {
        /// The bucket in which the file resides.
        bucket: String,

        /// The key to the file.
        key: String,
    },
}
