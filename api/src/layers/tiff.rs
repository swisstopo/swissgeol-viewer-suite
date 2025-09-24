use std::collections::{HashMap};
use std::iter::Iterator;
use std::sync::LazyLock;
use serde::{Deserialize, Serialize, Serializer};
use strum::{EnumIter, IntoEnumIterator};
use crate::{LayerConfigContext, ResolveLayer};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct TiffLayer {
    /// The url at which the tiff can be accessed.
    pub url: String,
    
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
    /// 
    /// It is assumed that joining this name with the layers `label` as in `{label}.bands.{name}`
    /// will produce the translation key providing the display name for this band.
    pub name: String,
    
    /// The unit of the band's values.
    /// This is used to format and annotate the bands legend and picks.
    /// 
    /// If this is left out, then the band values will be shown as-is.
    #[serde(default)]
    pub unit: Option<TiffLayerUnit>,
    
    /// The band's display configuration, defining how the band is rendered.
    /// If is this left out, then the band can't be displayed individually.
    #[serde(default)]
    pub display: Option<TiffLayerBandDisplay>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct TiffLayerBandDisplay {
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
    #[serde(default)]
    pub no_data: Option<i32>,

    /// The color map with which the band is rendered.
    pub color_map: TiffColorMapName,

    /// Custom steps that are shown on the band's colored legend.
    ///
    /// If left out, these steps will be calculated from `bounds`.
    #[serde(default)]
    pub steps: Option<TiffLayerBandSteps>,

    /// Whether each of the band's values is discrete.
    ///
    /// When this is set to `true`, it is assumed that all values of the band are defined within [steps],
    /// and there is no interpolation necessary between steps.
    #[serde(default)]
    pub is_discrete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TiffLayerBandSteps {
    /// Evenly separated steps, labeled with the array's elements.
    Labels(Vec<String>),
    
    /// Fully customized steps.
    Values(Vec<TiffLayerBandStepValue>)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TiffLayerBandStepValue {
    /// A simple step value. Will be labelled with the value itself.
    Simple(i32),
    
    /// A step value that is labelled with a custom label.
    /// Note that the label is **not** translated.
    Labelled {
        value: i32,
        label: String,
    }
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

macro_rules! include_colormap {
     ($name:literal) => {
         include_str!(concat!(env!("COLORMAP_DIR_PATH"), "/", $name))
     };
}

const COLOR_MAP_SWISSBEDROCK_AUTHOR: &str = include_colormap!("swissBEDROCK_Author.json");
const COLOR_MAP_SWISSBEDROCK_BEM: &str = include_colormap!("swissBEDROCK_BEM.json");
const COLOR_MAP_SWISSBEDROCK_CHANGE: &str = include_colormap!("swissBEDROCK_Change.json");
const COLOR_MAP_SWISSBEDROCK_TMUD: &str = include_colormap!("swissBEDROCK_TMUD.json");
const COLOR_MAP_SWISSBEDROCK_UNCERTAINTY: &str = include_colormap!("swissBEDROCK_Uncertainty.json");
const COLOR_MAP_SWISSBEDROCK_VERSION: &str = include_colormap!("swissBEDROCK_Version.json");

type ColorMapStep = (u16, (u32, u32, u32, u32));


static COLOR_MAP_DEFINITIONS: LazyLock<HashMap<TiffColorMapName, Vec<ColorMapStep>>> = LazyLock::new(|| TiffColorMapName::iter().map(|name| {
    let def: Vec<ColorMapStep> = serde_json::from_str(name.definition_string())
        .expect(&format!("Failed to parse color map definition \"{name:?}\""));
    (name, def)
}).collect());

impl TiffColorMapName {
    fn definition_string(&self) -> &'static str {
        match self {
            TiffColorMapName::SwissBedrockBEM => COLOR_MAP_SWISSBEDROCK_BEM,
            TiffColorMapName::SwissBedrockTMUD => COLOR_MAP_SWISSBEDROCK_TMUD,
            TiffColorMapName::SwissBedrockUncertainty => COLOR_MAP_SWISSBEDROCK_UNCERTAINTY,
            TiffColorMapName::SwissBedrockVersion => COLOR_MAP_SWISSBEDROCK_VERSION,
            TiffColorMapName::SwissBedrockChange => COLOR_MAP_SWISSBEDROCK_CHANGE,
            TiffColorMapName::SwissBedrockAuthor => COLOR_MAP_SWISSBEDROCK_AUTHOR,
        }
    }

    fn name(&self) -> &'static str {
        match self {
            TiffColorMapName::SwissBedrockBEM => "swissBEDROCK_BEM",
            TiffColorMapName::SwissBedrockTMUD => "swissBEDROCK_TMUD",
            TiffColorMapName::SwissBedrockUncertainty => "swissBEDROCK_Uncertainty",
            TiffColorMapName::SwissBedrockVersion => "vswissBEDROCK_Version",
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
        S: Serializer
    {
        serializer.serialize_str(self.name())
    }
}

impl ResolveLayer for TiffLayerBandDisplay {
    fn resolve(&mut self, _context: &mut LayerConfigContext) -> anyhow::Result<()> {
        if let Some(steps) = &mut self.steps {
            let steps = std::mem::replace(steps, TiffLayerBandSteps::Labels(vec![]));
            self.steps = Some(self.normalize_steps(steps))
        } else {
            self.steps = Some(self.make_steps_from_config())
        }
        Ok(())
    }
}

impl TiffLayerBandDisplay {
    fn normalize_steps(&self, steps: TiffLayerBandSteps) -> TiffLayerBandSteps {
        let labels = match steps {
            TiffLayerBandSteps::Labels(it) => it,
            TiffLayerBandSteps::Values(values) => return TiffLayerBandSteps::Values(
                values.into_iter().map(|value| match value {
                    TiffLayerBandStepValue::Simple(value) => TiffLayerBandStepValue::Labelled { label: format!("{value}"), value },
                    TiffLayerBandStepValue::Labelled { label, value } => TiffLayerBandStepValue::Labelled { label, value },
                }).collect()
            )
        };

        let n = labels.len();
        let (base, offset) = if self.is_discrete {
            if n == 1 {
                (1.0, 0.5)
            } else {
                let base = 1.0 / n as f32;
                (base, base / 2.0)
            }
        } else {
            (1.0 / (n as f32 - 1.0), 0.0)
        };
        let (min, max, _is_reversed) = self.range();
        let ratio = max - min;
        let values = labels.into_iter().enumerate().map(|(i, label)| TiffLayerBandStepValue::Labelled {
            label,
            value: (min + ratio * (base * (i as f32) + offset)) as i32,
        }).collect();
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
        let values = definition.iter().map(|(key, _)| {
            let key = *key as i32;
            TiffLayerBandStepValue::Labelled {
                label: format!("{key}"),
                value: key,
            }
        }).collect();
        TiffLayerBandSteps::Values(values)
    }


    fn make_steps_from_bounds(&self) -> TiffLayerBandSteps {
        let (min, max, is_reversed) = self.range();
        let step = (max - min) / 5.0;
        let values = (0..6).into_iter().map(|i| {
            let value = (min + step * i as f32).round() as i32;
            TiffLayerBandStepValue::Labelled {
                value,
                label: format!("{value}"),
            }
        });
        let values = if is_reversed { values.rev().collect() } else { values.collect() };
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