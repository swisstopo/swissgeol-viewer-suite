use crate::LayerSource;
use crate::layers::config::{Parse, ParseContext};
use anyhow::anyhow;
use serde::{Deserialize, Serialize, Serializer};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::iter::Iterator;
use std::path::Path;
use std::sync::LazyLock;
use strum::{EnumIter, IntoEnumIterator};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct TiffLayer {
    /// The layer's source, defining where the layer is loaded from.
    pub source: LayerSource,

    /// The source for the layer's terrain.
    /// If absent, the TIFF is draped directly onto the default terrain.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terrain: Option<LayerSource>,

    /// The width and height of each of the TIFF's cells, in meters.
    pub cell_size: u32,

    /// Configurations for the TIFF's bands.
    pub bands: Vec<TiffLayerBand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct TiffLayerBand {
    /// The band's index within the TIFF.
    pub index: u32,

    /// The band's name.
    /// To translate this name, it will be treated as a property of the layer.
    pub name: String,

    /// The unit of the band's values.
    /// This is used to format and annotate the band's legend and picks.
    ///
    /// If this is left out, then the band values will be shown as-is.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<TiffLayerUnit>,

    /// The band's display configuration, defining how the band is rendered.
    /// If is this left out, then the band can't be displayed individually.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display: Option<TiffLayerBandDisplay>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TiffLayerBandDisplay {
    Reference(String),
    Definition(TiffLayerBandDisplayDefinition),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct TiffLayerBandDisplayDefinition {
    /// The lower and upper bounds of displayed values.
    ///
    /// This configuration is used mainly for calculating the band's legend and tooltips.
    /// Values in the band may fall outside of this range without causing any issue.
    ///
    /// If the layer's legend should be rendered in descending order,
    /// simply switch the lower and upper bound with each other.
    pub bounds: (i32, i32),

    /// The value that represents the absence of data on this band.
    /// Tiles matching that value will not be rendered.
    ///
    /// Leave this value empty to not hide any undefined values.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub no_data: Option<i32>,

    /// The color map with which the band is rendered.
    pub color_map: TiffColorMapName,

    /// Custom steps that are shown on the band's colored legend.
    ///
    /// If left out, these steps will be calculated from `bounds`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steps: Option<TiffLayerBandSteps>,

    /// Whether each of the band's values is discrete.
    ///
    /// When this is set to `true`, it is assumed that all values of the band are defined within [steps],
    /// and there is no interpolation necessary between steps.
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    pub is_discrete: bool,

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
pub enum TiffLayerBandSteps {
    /// Evenly separated steps, labeled with the array's elements.
    Labels(Vec<String>),

    /// Fully customized steps.
    Values(Vec<TiffLayerBandStepValue>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TiffLayerBandStepValue {
    /// A simple step value. Will be labelled with the value itself.
    Simple(i32),

    /// A step value that is labelled with a custom label.
    /// Note that the label is **not** translated.
    Labelled { value: i32, label: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TiffLayerUnit {
    Meters,
    MetersAboveSeaLevel,
}

#[derive(Debug, Clone, Eq, PartialEq, Hash, Deserialize, EnumIter)]
pub enum TiffColorMapName {
    #[serde(rename = "swissBEDROCK_BEM")]
    SwissBedrockBEM,

    #[serde(rename = "swissBEDROCK_TMUD")]
    SwissBedrockTMUD,

    #[serde(rename = "swissBEDROCK_Uncertainty")]
    SwissBedrockUncertainty,

    #[serde(rename = "swissBEDROCK_Version")]
    SwissBedrockVersion,

    #[serde(rename = "swissBEDROCK_Change")]
    SwissBedrockChange,

    #[serde(rename = "swissBEDROCK_Author")]
    SwissBedrockAuthor,
}

type ColorMapStep = (u32, (u32, u32, u32, u32));

static COLOR_MAP_DEFINITIONS: LazyLock<HashMap<TiffColorMapName, Vec<ColorMapStep>>> =
    LazyLock::new(|| {
        let colormap_dir_path = std::env::var("COLORMAP_DIR_PATH")
            .unwrap_or_else(|_| "../titiler/colormaps".to_string());
        let colormap_dir_path = fs::canonicalize(Path::new(&colormap_dir_path)).unwrap();

        TiffColorMapName::iter()
            .map(|name| {
                let path = colormap_dir_path.join(format!("{}.json", name.name()));
                let content = fs::read_to_string(&path)
                    .map_err(|err| anyhow!("Failed to read \"{}\": {err}", path.display()))
                    .unwrap();
                let def: BTreeMap<u32, (u32, u32, u32, u32)> = serde_json::from_str(&content)
                    .unwrap_or_else(|err| {
                        panic!(
                            "Failed to parse color map definition \"{}\": {err}",
                            path.display()
                        )
                    });
                (name, def.into_iter().collect())
            })
            .collect()
    });

impl TiffColorMapName {
    fn name(&self) -> &'static str {
        match self {
            TiffColorMapName::SwissBedrockBEM => "swissBEDROCK_BEM",
            TiffColorMapName::SwissBedrockTMUD => "swissBEDROCK_TMUD",
            TiffColorMapName::SwissBedrockUncertainty => "swissBEDROCK_Uncertainty",
            TiffColorMapName::SwissBedrockVersion => "swissBEDROCK_Version",
            TiffColorMapName::SwissBedrockChange => "swissBEDROCK_Change",
            TiffColorMapName::SwissBedrockAuthor => "swissBEDROCK_Author",
        }
    }

    fn definition(&self) -> &'static [ColorMapStep] {
        COLOR_MAP_DEFINITIONS.get(self).unwrap()
    }
}

impl Serialize for TiffColorMapName {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.name())
    }
}

impl Parse for TiffLayer {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        for band in std::mem::take(&mut self.bands) {
            self.bands.push(band.parse(context)?);
        }
        Ok(self)
    }
}

impl Parse for TiffLayerBand {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        self.display = match self.display {
            None => None,
            Some(TiffLayerBandDisplay::Reference(name)) => {
                let definition =
                    context.config.tiff_displays.get_mut(&name).ok_or_else(|| {
                        anyhow!("[{}] Unknown tiff display: {name}", context.display)
                    })?;
                definition.use_count += 1;
                Some(TiffLayerBandDisplay::Definition(definition.clone()))
            }
            Some(TiffLayerBandDisplay::Definition(definition)) => {
                Some(TiffLayerBandDisplay::Definition(definition.parse(context)?))
            }
        };
        Ok(self)
    }
}

impl Parse for TiffLayerBandDisplayDefinition {
    fn parse(mut self, _context: &mut ParseContext) -> anyhow::Result<Self> {
        if let Some(steps) = &mut self.steps {
            let steps = std::mem::replace(steps, TiffLayerBandSteps::Labels(vec![]));
            self.steps = Some(self.normalize_steps(steps))
        } else {
            self.steps = Some(self.make_steps_from_config())
        }
        Ok(self)
    }
}

impl TiffLayerBandDisplayDefinition {
    fn normalize_steps(&self, steps: TiffLayerBandSteps) -> TiffLayerBandSteps {
        let labels = match steps {
            TiffLayerBandSteps::Labels(it) => it,
            TiffLayerBandSteps::Values(values) => {
                return TiffLayerBandSteps::Values(
                    values
                        .into_iter()
                        .map(|value| match value {
                            TiffLayerBandStepValue::Simple(value) => {
                                TiffLayerBandStepValue::Labelled {
                                    label: format!("{value}"),
                                    value,
                                }
                            }
                            TiffLayerBandStepValue::Labelled { label, value } => {
                                TiffLayerBandStepValue::Labelled { label, value }
                            }
                        })
                        .collect(),
                );
            }
        };

        let n = labels.len();
        let (base, offset) = if self.is_discrete {
            if n == 1 {
                (1.0, 0.5)
            } else {
                let base = 1.0 / (n as f32);
                (base, base / 2.0)
            }
        } else {
            (1.0 / (n as f32 - 1.0), 0.0)
        };
        let (min, max, _is_reversed) = self.range();
        let ratio = max - min;
        let values = labels
            .into_iter()
            .enumerate()
            .map(|(i, label)| TiffLayerBandStepValue::Labelled {
                label,
                value: (min + ratio * (base * (i as f32) + offset)).round() as i32,
            })
            .collect();
        TiffLayerBandSteps::Values(values)
    }

    fn make_steps_from_config(&self) -> TiffLayerBandSteps {
        if self.is_discrete {
            self.make_steps_from_color_map()
        } else {
            self.make_steps_from_bounds()
        }
    }

    fn make_steps_from_color_map(&self) -> TiffLayerBandSteps {
        let definition = self.color_map.definition();
        let values = definition
            .iter()
            .map(|(key, _)| {
                let key = *key as i32;
                TiffLayerBandStepValue::Labelled {
                    label: format!("{key}"),
                    value: key,
                }
            })
            .collect();
        TiffLayerBandSteps::Values(values)
    }

    fn make_steps_from_bounds(&self) -> TiffLayerBandSteps {
        let (min, max, is_reversed) = self.range();
        let step = (max - min) / 5.0;
        let values = (0..6).map(|i| {
            let value = (min + step * i as f32).round() as i32;
            TiffLayerBandStepValue::Labelled {
                value,
                label: format!("{value}"),
            }
        });
        let values = if is_reversed {
            values.rev().collect()
        } else {
            values.collect()
        };
        TiffLayerBandSteps::Values(values)
    }

    fn range(&self) -> (f32, f32, bool) {
        let (min, max) = self.bounds;
        if min < max {
            (min as f32, max as f32, false)
        } else {
            (max as f32, min as f32, true)
        }
    }
}
