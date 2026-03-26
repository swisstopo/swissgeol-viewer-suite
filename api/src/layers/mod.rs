use crate::data::TranslatedString;
use crate::layers::config::{Parse, ParseContext};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

mod config;
pub use config::LayerConfig;

mod earthquakes;
pub use earthquakes::EarthquakesLayer;

mod geojson;
pub use geojson::GeoJsonLayer;

mod kml;
pub use kml::KMLLayer;

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

mod styles;
pub use styles::*;

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

    /// Configuration for the layer's info box.
    /// The info box can display a WMS legend, custom content, or both.
    /// If absent, the layer has no info box.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub info_box: Option<InfoBox>,

    /// A mapping of custom properties that should be appended to each pick info on the layer.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub custom_properties: HashMap<String, String>,

    /// Access control configuration for the layer.
    /// If absent, then the layer doesn't have any access restrictions.
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "source")]
pub enum InfoBox {
    /// The legend is fetched as HTML from api3.geo.admin.ch via the layer's id.
    #[serde(rename(serialize = "api3.geo.admin.ch", deserialize = "api3.geo.admin.ch"))]
    Api3GeoAdminCh,
    /// Custom info box content with an optional URL and key-value pairs.
    #[serde(rename(serialize = "custom", deserialize = "custom"))]
    #[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
    Custom {
        /// An optional URL to display in the info box.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        legend_url: Option<String>,

        /// Key-value pairs displayed in the info box.
        /// The key is a translation key for the label; the value is one of:
        ///   - a plain string.
        ///   - a `{ key, url }` object, rendered as a link whose label is translated from `key`. The url can be:
        ///      - a URL string (starting with `http://` or `https://`)
        ///      - a plain string used as a translation key to resolve a localized url.
        #[serde(default, skip_serializing_if = "HashMap::is_empty")]
        information: HashMap<String, InformationValue>,
    },
}

/// A value in the info box's information table.
///
/// - [`Text`](InformationValue::Text): A plain string.
/// - [`Link`](InformationValue::Link): A `{ key, url }` object rendered as a link whose label is
///   the translation of `key`. Url can be a url which starts with `http://` or `https://`
///   or a translation key to resolve a localized url.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum InformationValue {
    Link { key: String, url: String },
    Text(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LayerDetail {
    Wmts(WmtsLayer),
    Tiles3d(Tiles3dLayer),
    Voxel(VoxelLayer),
    Tiff(TiffLayer),
    Earthquakes(EarthquakesLayer),
    GeoJson(GeoJsonLayer),
    Kml(KMLLayer),
}

impl Parse for Layer {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        self.detail = match self.detail {
            LayerDetail::Voxel(detail) => LayerDetail::Voxel(detail.parse(context)?),
            LayerDetail::Tiff(detail) => LayerDetail::Tiff(detail.parse(context)?),
            LayerDetail::Tiles3d(detail) => LayerDetail::Tiles3d(detail.parse(context)?),
            detail => detail,
        };
        Ok(self)
    }
}
