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
    Ogc(OgcLayerSource),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct OgcLayerSource {
    pub ogc_source: OgcSource,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_source: Option<Box<LayerSource>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum OgcSource {
    #[serde(rename = "gst", rename_all(serialize = "camelCase"))]
    Gst {
        id: u32,

        /// The id of the style with which the layer should be rendered.
        /// If left out, the collection's default download is used.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_id: Option<u32>,
    },

    #[serde(rename = "stac", rename_all(serialize = "camelCase"))]
    Stac { collection: String },

    #[serde(rename = "fdsn", rename_all(serialize = "camelCase"))]
    Fdsn {
        // FDSN-spezifische Felder
    },

    #[serde(rename = "wms", rename_all(serialize = "camelCase"))]
    Wms {
        // WMS-spezifische Felder
    },
}
