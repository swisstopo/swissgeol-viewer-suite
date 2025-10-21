use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct LayerAccess {
    /// A list of cognito groups.
    /// Access is granted if the current user belongs to at least one of these groups.
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    groups: Vec<String>,
    
    /// A list of environment names.
    /// Access is granted if the app is running within one of these environments.
    /// 
    /// See [crate::config::Config].
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    env: Vec<String>,
}