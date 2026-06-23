use crate::OgcSource;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WmtsLayerSource {
    #[serde(rename = "WMS")]
    Wms,

    #[serde(rename = "WMTS")]
    Wmts,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct WmtsLayer {
    /// The source of the layer.
    /// If absent, the layer is resolved from the default swisstopo WMS/WMTS capabilities
    // For externally configured layers, this should be either "WMS" or "WMTS".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<WmtsLayerSource>,

    /// The zoom level (zoomed in) from which on no higher resolution tiles will be fetched.
    /// Instead, this level's tiles will be scaled up to fit higher zoom levels.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_level: Option<u32>,

    /// Optional service key used by the UI to resolve WMS/WMTS capabilities endpoints.
    /// If absent, the default maps.geo.admin service is used.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,

    /// Some WMTS layers are displayed as  WMS/WMTS, but for the data export, a different source is used.
    pub ogc_source: Option<OgcSource>,
}
