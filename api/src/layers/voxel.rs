use crate::layers::config::{Parse, ParseContext};
use anyhow::anyhow;
use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct VoxelLayer {
    pub url: String,

    /// The translation key providing the display name for the unit of the layer's values.
    // TODO document what happens when this is not set.
    pub unit_label: Option<String>,

    /// The key of the property that contains the layer's data points.
    pub data_key: String,

    /// The value that represents the absence of data on this layer.
    pub no_data: i32,

    /// The layer's value mapping.
    /// This determines how the layer is rendered and otherwise displayed to the user.
    pub mapping: VoxelMapping,

    /// The layer's value filter configuration.
    /// This determines how the user is able to filter the layer's data points.
    pub filter: VoxelFilter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum VoxelMapping {
    Reference(String),
    Definition(VoxelMappingDefinition),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct VoxelMappingDefinition {
    /// The minimum and maximum values of the layer's data points.
    pub range: (i32, i32),

    /// The sequence of colors applied to the range of values.
    /// These will be scaled linearly to fit the value range.
    pub colors: Vec<String>,

    /// The number of times this definition has been referenced.
    /// This is used to ensure that the definition is not unused.
    ///
    /// If this definition is directly attached to a layer,
    /// this field will never be used.
    #[serde(skip, default)]
    pub use_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum VoxelFilter {
    Reference(String),
    Definition(VoxelFilterDefinition),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct VoxelFilterDefinition {
    #[serde(default)]
    pub lithology: Option<LithologyVoxelFilter>,

    #[serde(default)]
    pub conductivity: Option<ConductivityVoxelFilter>,

    /// The number of times this definition has been referenced.
    /// This is used to ensure that the definition is not unused.
    ///
    /// If this definition is directly attached to a layer,
    /// this field will never  be used.
    #[serde(skip, default)]
    pub use_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct LithologyVoxelFilter {
    /// The key of the property that contains the lithology data points.
    pub key: String,

    /// The filter's items.
    /// Each item represents a value that can be filtered by.
    pub items: Vec<LithologyVoxelFilterItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct LithologyVoxelFilterItem {
    /// The translation key providing the display name for the item.
    pub label: String,

    /// The value that the data points matching this item have.
    pub value: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct ConductivityVoxelFilter {
    /// The key of the property that contains the conductivity data points.
    pub key: String,

    /// The minimum and maximum values of the conductivity data points.
    pub range: (i32, i32),
}

/// Custom Deserialize implementation for [LithologyVoxelFilterItem] that allows
/// the configuration to be written as tuple `(u32, String)`.
impl<'de> Deserialize<'de> for LithologyVoxelFilterItem {
    fn deserialize<D>(d: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let (value, label) = <(i32, String)>::deserialize(d)?;
        Ok(Self { label, value })
    }
}

impl Parse for VoxelLayer {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        if let VoxelMapping::Reference(name) = &self.mapping {
            let mapping = context
                .config
                .voxel_mappings
                .get_mut(name)
                .ok_or_else(|| anyhow!("Unknown voxel mapping: {name}"))?;
            mapping.use_count += 1;
            self.mapping = VoxelMapping::Definition(mapping.clone());
        }
        if let VoxelFilter::Reference(name) = &self.filter {
            let filter = context
                .config
                .voxel_filters
                .get_mut(name)
                .ok_or_else(|| anyhow!("Unknown voxel filter: {name}"))?;
            filter.use_count += 1;
            self.filter = VoxelFilter::Definition(filter.clone());
        }
        Ok(self)
    }
}
