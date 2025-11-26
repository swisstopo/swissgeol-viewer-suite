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

    #[serde(rename_all(serialize = "camelCase"))]
    Ogc {
        /// The id of the collection representing the layer.
        id: u32,

        /// The id of the style with which the layer should be rendered.
        /// If left out, the collection's default download is used.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_id: Option<u32>,

        /// An optional source that will be used when displaying the layer.
        /// When this is set, the OGC API will only be used for layer exports.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        display_source: Option<Box<LayerSource>>,
    },
}
