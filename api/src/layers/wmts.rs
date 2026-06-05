use crate::OgcSource;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct WmtsLayer {
    /// The zoom level (zoomed in) from which on no higher resolution tiles will be fetched.
    /// Instead, this level's tiles will be scaled up to fit higher zoom levels.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_level: Option<u32>,

    /// The URL of the WMS/WMTS service used to render this layer.
    /// If absent, the default swisstopo service URL for the configured source is used.
    /// For WMS sources, this is the service base URL
    /// For WMTS sources, this is the capabilities document URL
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_url: Option<String>

    /// Some WMTS layers are displayed as  WMS/WMTS, but for the data export, a different source is used.
    pub ogc_source: Option<OgcSource>,
}
