use serde::{Deserialize, Serialize};

mod swisstopo;
pub use swisstopo::*;

mod tiles3d;
pub use tiles3d::*;

mod voxel;
pub use voxel::*;

mod tiff;
pub use tiff::*;

mod group;
pub use group::*;
use crate::data::TranslatedString;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct Layer {
    /// A unique identifier for the layer. Will also be used as part of the translation key for the layer's display name.
    ///
    /// For [swisstopo layers](SwisstopoLayer), this is also the name that uniquely identifies the layer within the swisstopo WMTS API.
    pub id: String,

    /// The layer's default opacity.
    #[serde(default)]
    pub opacity: LayerOpacity,

    /// The id of this layer on https://geocat.ch, if available.
    #[serde(default)]
    pub geocat_id: Option<String>,

    /// A url from which a representation of the layer can be downloaded.
    #[serde(default)]
    pub download_url: Option<TranslatedString>,

    /// Details depending on the actual type of layer.
    #[serde(flatten)]
    pub detail: LayerDetail
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LayerOpacity {
    Default(f32),
    Disabled,
}

impl Default for LayerOpacity {
    fn default() -> Self {
        Self::Default(0.0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LayerDetail {
    Swisstopo(SwisstopoLayer),
    Tiles3d(Tiles3dLayer),
    Voxel(VoxelLayer),
    Tiff(TiffLayer),
}

