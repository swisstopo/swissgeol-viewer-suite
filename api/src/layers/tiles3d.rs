use crate::LayerSource;
use crate::layers::config::{Parse, ParseContext};
use anyhow::anyhow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct Tiles3dLayer {
    /// The layer's source, defining where the layer is loaded from.
    pub source: LayerSource,

    /// The order in which the layer's properties are sorted when displayed.
    /// Keys that are left out will be sorted below any sorted ones, in default order.
    #[serde(
        default,
        skip_serializing_if = "Tiles3dLayerOrderOfProperties::is_empty"
    )]
    pub order_of_properties: Tiles3dLayerOrderOfProperties,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Tiles3dLayerOrderOfProperties {
    Reference(String),
    Definition(Vec<String>),
}

impl Default for Tiles3dLayerOrderOfProperties {
    #[inline]
    fn default() -> Self {
        Self::Definition(vec![])
    }
}

impl Tiles3dLayerOrderOfProperties {
    #[inline]
    fn is_empty(&self) -> bool {
        match self {
            Tiles3dLayerOrderOfProperties::Reference(_) => false,
            Tiles3dLayerOrderOfProperties::Definition(order) => order.is_empty(),
        }
    }
}

impl Parse for Tiles3dLayer {
    fn parse(mut self, context: &mut ParseContext) -> anyhow::Result<Self> {
        self.order_of_properties = match self.order_of_properties {
            order @ Tiles3dLayerOrderOfProperties::Definition(_) => order,
            Tiles3dLayerOrderOfProperties::Reference(name) => {
                let definition =
                    context
                        .config
                        .order_of_properties
                        .get(&name)
                        .ok_or_else(|| {
                            anyhow!("[{}] Unknown order of properties: {name}", context.display)
                        })?;
                Tiles3dLayerOrderOfProperties::Definition(definition.clone())
            }
        };
        Ok(self)
    }
}
