use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct WmtsLayer {
    /// The zoom level (zoomed in) from which on no higher resolution tiles will be fetched.
    /// Instead, this level's tiles will be scaled up to fit higher zoom levels.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_level: Option<u32>,
}
