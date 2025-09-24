use crate::layers::Layer;
use crate::{LayerDetail, TiffLayer, TiffLayerBand, VoxelFilter, VoxelFilterDefinition, VoxelLayer, VoxelMapping, VoxelMappingDefinition};
use anyhow::anyhow;
use serde::de::Error;
use serde::ser::SerializeStruct;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct LayerGroup {
    /// A unique identifier for the group. Will also be used as part of the translation key for the group's display name.
    pub id: String,
    
    /// The group's children.
    pub children: Vec<LayerGroupChild>,

    #[serde(default, skip_serializing)]
    pub voxel_mappings: HashMap<String, VoxelMappingDefinition>,

    #[serde(default, skip_serializing)]
    pub voxel_filters: HashMap<String, VoxelFilterDefinition>,
}

#[derive(Debug, Clone)]
pub enum LayerGroupChild {
    /// A subgroup.
    Group(LayerGroup),
    
    /// A specific layer.
    Layer(Layer),
    
    /// A path to a file containing a [LayerGroup] definition.
    /// 
    /// The path will be resolved relative to the file containing the child's parent group.
    Link { path: String },
}

impl<'de> Deserialize<'de> for LayerGroupChild {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let obj = serde_json::Map::deserialize(deserializer)?;
        match obj.len() {
            1 if obj.contains_key("path") => Ok(LayerGroupChild::Link {
                path: serde_json::from_value(obj.into_values().next().unwrap())
                    .map_err(Error::custom)?
            }),
            _ if obj.contains_key("children") => Ok(LayerGroupChild::Group(
                serde_json::from_value(serde_json::Value::Object(obj)).map_err(Error::custom)?
            )),
            _ => Ok(LayerGroupChild::Layer(
                serde_json::from_value(serde_json::Value::Object(obj)).map_err(Error::custom)?
            )),
        }
    }
}

impl Serialize for LayerGroupChild {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer
    {
        match self {
            LayerGroupChild::Group(group) => group.serialize(serializer),
            LayerGroupChild::Layer(layer) => layer.serialize(serializer),
            LayerGroupChild::Link { path } => {
                let mut s = serializer.serialize_struct("Link", 1)?;
                s.serialize_field("path", path)?;
                s.end()
            }
        }
    }
}

pub struct LayerConfigContext<'a> {
    pub root: &'a Path,
    pub known_layer_ids: HashSet<String>,
    pub voxel_mappings: HashMap<String, VoxelMappingDefinition>,
    pub voxel_filters: HashMap<String, VoxelFilterDefinition>,
}

pub trait ResolveLayer {
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()>;
}

impl ResolveLayer for Vec<LayerGroup> {
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        for child in self {
            child.resolve(context)?;
        }
        Ok(())
    }
}

impl ResolveLayer for Vec<LayerGroupChild> {
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        for child in self {
            child.resolve(context)?;
        }
        Ok(())
    }
}

impl ResolveLayer for LayerGroup {
    #[inline(always)]
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        let voxel_mappings = context.voxel_mappings.clone();
        let voxel_filters = context.voxel_filters.clone();
        context.voxel_mappings.extend(self.voxel_mappings.clone().into_iter());
        context.voxel_filters.extend(self.voxel_filters.clone().into_iter());
        self.children.resolve(context)?;
        context.voxel_mappings = voxel_mappings;
        context.voxel_filters = voxel_filters;
        Ok(())
    }
}

impl ResolveLayer for LayerGroupChild {
    #[inline(always)]
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        let path = match self {
            Self::Link { path } => path,
            Self::Group(group) => return group.resolve(context),
            Self::Layer(layer) => return layer.resolve(context),
        };
        let resolved_path = context.root.join(&path);
        let layers_text = fs::read_to_string(&resolved_path).map_err(|err| anyhow!("Failed to read group file at \"{path}\": {err}"))?;
        let mut group: LayerGroup = json5::from_str(&layers_text).map_err(|err| {
            let json5::Error::Message { msg, location } = err;
            let location = location.map(|loc| format!(":{}:{}", loc.line, loc.column)).unwrap_or_else(|| String::from(""));
            anyhow!("Invalid layer group file at \"{}{location}\": {msg}", resolved_path.to_str().unwrap())
        })?;
        let mut inner_context = LayerConfigContext {
            root: resolved_path.parent().unwrap_or_else(|| Path::new("/")),
            known_layer_ids: context.known_layer_ids.clone(),
            voxel_mappings: Default::default(),
            voxel_filters: Default::default(),
        };
        group.resolve(&mut inner_context)?;
        context.known_layer_ids = inner_context.known_layer_ids;
        *self = Self::Group(group);
        Ok(())
    }
}

impl ResolveLayer for Layer {
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        if !context.known_layer_ids.insert(self.id.clone()) {
            return Err(anyhow!("layer id \"{}\" is used multiple times", self.id));
        }
        self.detail.resolve(context)
    }
}

impl ResolveLayer for LayerDetail {
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        match self {
            LayerDetail::Swisstopo(_) => Ok(()),
            LayerDetail::Tiles3d(_) => Ok(()),
            LayerDetail::Voxel(detail) => detail.resolve(context),
            LayerDetail::Tiff(_) => Ok(()),
        }
    }
}

impl ResolveLayer for VoxelLayer {
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        if let VoxelMapping::Name(name) = &self.mapping {
            self.mapping = VoxelMapping::Definition(context.voxel_mappings
                .get(name)
                .ok_or_else(|| anyhow!("Unknown voxel mapping: {name}"))?
                .clone());
        }
        if let VoxelFilter::Name(name) = &self.filter {
            self.filter = VoxelFilter::Definition(context.voxel_filters
                .get(name)
                .ok_or_else(|| anyhow!("Unknown voxel filter: {name}"))?
                .clone());
        }
        Ok(())
    }
}


impl ResolveLayer for TiffLayer {
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        for band in &mut self.bands {
            band.resolve(context)?;
        }
        Ok(())
    }
}

impl ResolveLayer for TiffLayerBand {
    fn resolve(&mut self, context: &mut LayerConfigContext) -> anyhow::Result<()> {
        if let Some(display) = &mut self.display {
            display.resolve(context)?;
        }
        Ok(())
    }
}
