use crate::data::TranslatedString;
use crate::layers::config::{Parse, ParseContext};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

mod config;
pub use config::LayerConfig;

mod earthquakes;
pub use earthquakes::EarthquakesLayer;

mod group;
pub use group::*;

mod wmts;
pub use wmts::*;

mod tiff;
pub use tiff::*;

mod tiles3d;
pub use tiles3d::*;

mod voxel;
pub use voxel::*;

mod source;
pub use source::*;

mod access;
pub use access::*;

mod opacity;
pub use opacity::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct Layer {
    /// A unique identifier for the layer. Will also be used as part of the translation key for the layer's display name.
    ///
    /// For [wmts layers](WmtsLayer), this is also the name that uniquely identifies the layer within the swisstopo WMTS API.
    pub id: String,

    /// The layer's default opacity.
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    pub opacity: LayerOpacity,

    /// The id of this layer on https://geocat.ch, if available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub geocat_id: Option<String>,

    /// A url from which a representation of the layer can be downloaded.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub download_url: Option<TranslatedString>,

    /// Where the legend for the layer can found.
    /// If absent, then the layer doesn't have any such legend.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub legend: Option<LayerLegend>,

    /// A mapping of custom properties that should be appended to each pick info on the layer.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub custom_properties: HashMap<String, String>,

    /// Where the legend for the layer can found.
    /// If absent, then the layer doesn't have any such legend.
    #[serde(default, skip_serializing)]
    pub access: Option<LayerAccess>,

    /// Details depending on the actual type of layer.
    #[serde(flatten)]
    pub detail: LayerDetail,

    /// The number of times this layer has been referenced.
    /// This is used to ensure that the layer is not unused.
    #[serde(skip, default)]
    pub use_count: u32,
}

#[derive(Debug, Clone, Eq, PartialEq, Hash, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LayerLegend {
    IdOrDisabled(bool),
    CustomId(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LayerDetail {
    Wmts(WmtsLayer),
    Tiles3d(Tiles3dLayer),
    Voxel(VoxelLayer),
    Tiff(TiffLayer),
    Earthquakes(EarthquakesLayer),
}

impl Parse for Layer {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        self.detail = match self.detail {
            LayerDetail::Voxel(detail) => LayerDetail::Voxel(detail.parse(context)?),
            LayerDetail::Tiff(detail) => LayerDetail::Tiff(detail.parse(context)?),
            LayerDetail::Tiles3d(detail) => LayerDetail::Tiles3d(detail.parse(context)?),
            detail @ _ => detail,
        };
        Ok(self)
    }
}
