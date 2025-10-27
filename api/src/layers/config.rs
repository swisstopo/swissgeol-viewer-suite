use crate::layers::*;
use anyhow::anyhow;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct LayerConfig {
    /// A list of configs that should be merged into this one.
    /// The inclusions are parsed independently and then merged
    /// before parsing of the parent config starts.
    ///
    /// "Merging" means that all layers of the included files are inherited,
    /// and groups and layers made available for referencing.
    /// All other fields remain local to their defining files.
    #[serde(default, skip_serializing)]
    pub include: Vec<String>,

    /// The layers.
    #[serde(default)]
    pub layers: Vec<Layer>,

    /// The layer tree.
    #[serde(default)]
    pub groups: Vec<LayerGroupOrReference>,

    /// A list of voxel mappings that may be reused by multiple layers.
    /// Each entry's key is used to identify it within this config.
    #[serde(default, skip_serializing)]
    pub voxel_mappings: HashMap<String, VoxelMappingDefinition>,

    /// A list of voxel band displays that may be reused by multiple layers.
    /// Each entry's key is used to identify it within this config.
    #[serde(default, skip_serializing)]
    pub tiff_displays: HashMap<String, TiffLayerBandDisplayDefinition>,
}

pub(in crate::layers) trait Parse: Sized {
    fn parse(self, context: &mut ParseContext) -> anyhow::Result<Self>;
}

pub(in crate::layers) struct ParseContext {
    /// A string displaying the path to the config.
    pub display: String,

    /// The config that is currently being parsed.
    /// Note that this config is most likely incomplete,
    /// as it only contains data that has been fully parsed.
    pub config: LayerConfig,

    /// A mapping of all layers present within `config`.
    pub known_layers: BTreeMap<String, Layer>,

    /// A mapping of all groups available for referencing from within [config].
    ///
    /// Note that unlike [known_layers], these groups do *not* exist on the config itself,
    /// but are simply included into it.
    /// Unless referenced by [config], these groups will be discarded.
    pub known_groups: BTreeMap<String, LayerGroup>,
}

impl ParseContext {
    fn merge(&mut self, other: LayerConfig) -> anyhow::Result<()> {
        for layer in other.layers {
            self.add_layer(layer)?
        }
        for group in other.groups {
            match group {
                LayerGroupOrReference::Definition(group) => {
                    if self.known_groups.contains_key(&group.id) {
                        return Err(anyhow!("group \"{}\" is defined multiple times", group.id));
                    }
                    self.known_groups.insert(group.id.clone(), group.clone());
                }
                group @ LayerGroupOrReference::Reference(_) => {
                    panic!("Unexpected group reference: {group:?}")
                }
            }
        }
        Ok(())
    }

    fn add_layer(&mut self, layer: Layer) -> anyhow::Result<()> {
        if self.known_layers.contains_key(&layer.id) {
            return Err(anyhow!("layer \"{}\" is defined multiple times", layer.id));
        }
        self.known_layers.insert(layer.id.clone(), layer.clone());
        Ok(())
    }
}

impl LayerConfig {
    pub fn parse(layers_file_path: &Path) -> anyhow::Result<Self> {
        let config = Self::parse_inclusion(layers_file_path)
            .map_err(|err| anyhow!("Failed to resolve layers: {err}"))?;
        for layer in &config.layers {
            if layer.use_count == 0 {
                tracing::warn!("Layer \"{}\" is unused.", layer.id)
            }
        }
        Ok(config)
    }

    fn parse_inclusion(layers_file_path: &Path) -> anyhow::Result<Self> {
        let layers_file_path_with_ext = format!("{}.json5", layers_file_path.display());
        let layers_file_path = if layers_file_path.to_str().unwrap().ends_with(".json5") {
            layers_file_path
        } else {
            Path::new(&layers_file_path_with_ext)
        };
        let layers_text = std::fs::read_to_string(layers_file_path)
            .map_err(|err| anyhow!("Failed to read \"{}\": {err}", layers_file_path.display()))?;

        let config: Self = json5::from_str(&layers_text).map_err(|err| {
            anyhow!(
                "Invalid layer config at \"{}\": {err}",
                layers_file_path.display()
            )
        })?;

        config.parse_as_root(layers_file_path)
    }

    fn parse_as_root(mut self, file_path: &Path) -> anyhow::Result<Self> {
        let result = Self {
            include: vec![],
            layers: vec![],
            groups: vec![],
            voxel_mappings: std::mem::take(&mut self.voxel_mappings),
            tiff_displays: Default::default(),
        };

        let mut context = ParseContext {
            display: format!("{}", file_path.display()),
            config: result,
            known_layers: Default::default(),
            known_groups: Default::default(),
        };

        for inclusion in self.include {
            let resolved_path = file_path
                .parent()
                .unwrap_or_else(|| Path::new("/"))
                .join(&inclusion);
            let file = Self::parse_inclusion(&resolved_path)?;
            context.merge(file)?;
        }

        for (key, band) in std::mem::take(&mut self.tiff_displays) {
            let band = band.parse(&mut context)?;
            context.config.tiff_displays.insert(key, band);
        }

        for layer in self.layers {
            let layer = layer.parse(&mut context)?;
            context.add_layer(layer)?;
        }

        for group in self.groups {
            let group = group.parse(&mut context)?;
            context.config.groups.push(group);
        }

        for (key, display) in &context.config.tiff_displays {
            if display.use_count == 0 {
                tracing::warn!("[{}] TIFF display \"{key}\" is unused.", context.display)
            }
        }

        for (key, mapping) in &context.config.voxel_mappings {
            let use_count = match mapping {
                VoxelMappingDefinition::Range(it) => it.use_count,
                VoxelMappingDefinition::Category(it) => it.use_count,
            };
            if use_count == 0 {
                tracing::warn!("[{}] Voxel mapping \"{key}\" is unused.", context.display)
            }
        }

        for (key, group) in context.known_groups {
            if group.use_count == 0 {
                tracing::warn!("[{}] Group \"{key}\" is unused.", context.display)
            }
        }
        context
            .config
            .layers
            .extend(&mut context.known_layers.into_values());
        Ok(context.config)
    }
}
