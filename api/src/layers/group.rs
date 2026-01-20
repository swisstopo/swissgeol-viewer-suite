use crate::layers::access::LayerAccess;
use crate::layers::config::{Parse, ParseContext};
use anyhow::anyhow;
use serde::de::Error;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct LayerGroup {
    /// A unique identifier for the group. Will also be used as part of the translation key for the group's display name.
    pub id: String,

    /// The group's children.
    pub children: Vec<LayerGroupChild>,

    /// The number of times this group has been referenced.
    /// This is used to ensure that the group is not unused.
    ///
    /// If this definition is within the root configuration file,
    /// or not a top level group, this field will never be used.
    #[serde(skip, default)]
    pub use_count: u32,

    /// A JSON object defining who has access to this layer.
    /// If left out, the layer is publicly available.
    #[serde(default, skip_serializing)]
    pub access: Option<LayerAccess>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LayerGroupChild {
    /// A specific layer's id.
    /// Layers may be referenced multiple times.
    Layer(String),

    /// A subgroup.
    Group(LayerGroupOrReference),
}

#[derive(Debug, Clone)]
pub enum LayerGroupOrReference {
    /// A group definition.
    Definition(LayerGroup),

    /// A reference to an already defined subgroup.
    Reference(LayerGroupReference),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct LayerGroupReference {
    pub id: String,
}

impl<'de> Deserialize<'de> for LayerGroupOrReference {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let obj = serde_json::Map::deserialize(deserializer)?;
        match obj.len() {
            1 if obj.contains_key("id") => Ok(LayerGroupOrReference::Reference(
                serde_json::from_value(serde_json::Value::Object(obj)).map_err(Error::custom)?,
            )),
            _ => Ok(LayerGroupOrReference::Definition(
                serde_json::from_value(serde_json::Value::Object(obj)).map_err(Error::custom)?,
            )),
        }
    }
}

impl Serialize for LayerGroupOrReference {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            LayerGroupOrReference::Definition(definition) => definition.serialize(serializer),
            LayerGroupOrReference::Reference(reference) => reference.serialize(serializer),
        }
    }
}

impl Parse for LayerGroup {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        for child in std::mem::take(&mut self.children) {
            match child {
                LayerGroupChild::Layer(id) => {
                    let layer = context
                        .known_layers
                        .get_mut(&id)
                        .ok_or_else(|| anyhow!("Unknown layer: {id}"))?;
                    layer.use_count += 1;
                    self.children.push(LayerGroupChild::Layer(id));
                }
                LayerGroupChild::Group(group) => {
                    self.children
                        .push(LayerGroupChild::Group(group.parse(context)?));
                }
            }
        }
        Ok(self)
    }
}

impl Parse for LayerGroupOrReference {
    fn parse(self, context: &mut ParseContext) -> anyhow::Result<Self> {
        match self {
            LayerGroupOrReference::Definition(group) => {
                Ok(LayerGroupOrReference::Definition(group.parse(context)?))
            }
            LayerGroupOrReference::Reference(reference) => {
                let group = context.known_groups.get_mut(&reference.id).ok_or_else(|| {
                    anyhow!("[{}] Unknown group: {}", context.display, reference.id)
                })?;
                group.use_count += 1;
                Ok(LayerGroupOrReference::Definition(group.clone()))
            }
        }
    }
}
