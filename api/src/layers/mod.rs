use crate::data::TranslatedString;
use serde::{Deserialize, Serialize};

mod config;
pub use config::LayerConfig;

mod group;
pub use group::*;

mod swisstopo;
pub use swisstopo::*;

mod tiff;
pub use tiff::*;

mod tiles3d;
pub use tiles3d::*;

mod voxel;
use crate::layers::config::{Parse, ParseContext};
pub use voxel::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct Layer {
    /// A unique identifier for the layer. Will also be used as part of the translation key for the layer's display name.
    ///
    /// For [swisstopo layers](SwisstopoLayer), this is also the name that uniquely identifies the layer within the swisstopo WMTS API.
    pub id: String,

    /// The layer's default opacity.
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    pub opacity: LayerOpacity,

    /// The id of this layer on https://geocat.ch, if available.
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    pub geocat_id: Option<String>,

    /// A url from which a representation of the layer can be downloaded.
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    pub download_url: Option<TranslatedString>,

    /// Where the legend for the layer can found.
    /// If absent, then the layer doesn't have any such legend.
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    pub legend: Option<LayerLegend>,

    /// Details depending on the actual type of layer.
    #[serde(flatten)]
    pub detail: LayerDetail,

    /// The number of times this layer has been referenced.
    /// This is used to ensure that the layer is not unused.
    #[serde(skip, default)]
    pub use_count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LayerOpacity {
    Default(f32),
    Disabled,
}

impl Default for LayerOpacity {
    fn default() -> Self {
        Self::Default(1.0)
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Hash, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LayerLegend {
    #[serde(rename = "id")]
    Id,
    CustomId(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LayerDetail {
    Swisstopo(SwisstopoLayer),
    Tiles3d(Tiles3dLayer),
    Voxel(VoxelLayer),
    Tiff(TiffLayer),
}

impl Parse for Layer {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        self.detail = match self.detail {
            detail @ LayerDetail::Swisstopo(_) => detail,
            detail @ LayerDetail::Tiles3d(_) => detail,
            LayerDetail::Voxel(detail) => LayerDetail::Voxel(detail.parse(context)?),
            LayerDetail::Tiff(detail) => LayerDetail::Tiff(detail.parse(context)?),
        };
        Ok(self)
    }
}
