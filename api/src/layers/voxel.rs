use crate::LayerSource;
use crate::layers::config::{Parse, ParseContext};
use anyhow::anyhow;
use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct VoxelLayer {
    pub source: LayerSource,

    /// The key of the property that contains the layer's data points.
    /// Note that there will need to be a mapping for this key for the layer to render.
    pub data_key: String,

    pub values: VoxelLayerValues,

    /// The layer's value mappings.
    /// This determines how the layer can be rendered and otherwise displayed to the user.
    pub mappings: Vec<VoxelLayerMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct VoxelLayerValues {
    /// The value that represents an absent datapoint.
    /// "Absence" here means that it doesn't exist, and does not need to be displayed.
    pub no_data: i32,

    /// The value that represents a datapoint without a value.
    /// The datapoint still exists and should be displayed, it just isn't backed by a meaningful value.
    ///
    /// The main use of undefined values is for datapoints that are only meaningful for specific mappings.
    /// If a datapoint is undefined on all mapped keys, it may be treated as `no_data`.
    pub undefined: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum VoxelLayerMapping {
    Reference(String),
    Definition(VoxelMappingDefinition),
}

impl Parse for VoxelLayer {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        for mapping in &mut self.mappings {
            if let VoxelLayerMapping::Reference(name) = mapping {
                let definition = context
                    .config
                    .voxel_mappings
                    .get_mut(name)
                    .ok_or_else(|| anyhow!("Unknown voxel mapping: {name}"))?;
                match definition {
                    VoxelMappingDefinition::Range(it) => it.use_count += 1,
                    VoxelMappingDefinition::Category(it) => it.use_count += 1,
                }
                *mapping = VoxelLayerMapping::Definition(definition.clone());
            }
        }
        Ok(self)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum VoxelMappingDefinition {
    Range(VoxelRangeMapping),
    Category(VoxelItemMapping),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct VoxelRangeMapping {
    /// The key of the property that contains the data points.
    pub key: String,

    /// The minimum and maximum values of the data points.
    pub range: (i32, i32),

    /// The colors with which the range is displayed.
    ///
    /// If this has the same length as [range], each value gets its own, specific value.
    /// If there are fewer colors than values, the colors are interpreted as a gradient on which the values can be placed.
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
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct VoxelItemMapping {
    /// The key of the property that contains the data points.
    pub key: String,

    /// The mapping's items.
    /// Each item represents a unique value.
    pub items: Vec<VoxelItemMappingItem>,

    /// The number of times this definition has been referenced.
    /// This is used to ensure that the definition is not unused.
    ///
    /// If this definition is directly attached to a layer,
    /// this field will never be used.
    #[serde(skip, default)]
    pub use_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct VoxelItemMappingItem {
    /// The translation key providing the display name for the item.
    pub label: String,

    /// The value that the data points matching this item have.
    pub value: i32,

    /// The color in which this value is displayed.
    pub color: String,
}

/// Custom Deserialize implementation for [VoxelItemMappingItem] that allows
/// the configuration to be written as tuple `(i32, { label: String, color: String })`.
impl<'de> Deserialize<'de> for VoxelItemMappingItem {
    fn deserialize<D>(d: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Item {
            pub label: String,
            pub color: String,
        }
        let (value, item) = <(i32, Item)>::deserialize(d)?;
        Ok(Self {
            label: item.label,
            value,
            color: item.color,
        })
    }
}
