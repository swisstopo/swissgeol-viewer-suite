use crate::{Layer, LayerConfig, LayerGroup, LayerGroupChild, LayerGroupOrReference};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct LayerAccess {
    /// A list of cognito groups.
    /// Access is granted if the current user belongs to at least one of these groups.
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    groups: Vec<String>,

    /// A list of environment names.
    /// Access is granted if the app is running within one of these environments.
    ///
    /// See [crate::config::Config].
    #[serde(default, skip_serializing_if = "crate::utils::is_default")]
    env: Vec<String>,
}

pub trait Filter: Sized {
    fn filter(self, context: &FilterContext) -> Option<Self>;
}

#[derive(Debug, Clone)]
pub struct FilterContext {
    pub groups: HashSet<String>,
    pub env: String,
    pub accessible_layer_ids: HashSet<String>,
}

impl Filter for LayerConfig {
    fn filter(mut self, context: &FilterContext) -> Option<Self> {
        let mut context = context.clone();
        self.layers = self
            .layers
            .into_iter()
            .filter_map(|layer| match layer.filter(&context) {
                Some(layer) => {
                    context.accessible_layer_ids.insert(layer.id.clone());
                    Some(layer)
                }
                None => None,
            })
            .collect();
        self.groups = self
            .groups
            .into_iter()
            .filter_map(|group| group.filter(&context))
            .collect();
        Some(self)
    }
}

impl Filter for Layer {
    fn filter(self, context: &FilterContext) -> Option<Self> {
        let Some(access) = &self.access else {
            return Some(self);
        };
        if !access.groups.is_empty()
            && !access
                .groups
                .iter()
                .any(|group| context.groups.contains(group))
        {
            return None;
        }
        if !access.env.is_empty() && !access.env.contains(&context.env) {
            return None;
        }
        Some(self)
    }
}

impl Filter for LayerGroup {
    fn filter(mut self, context: &FilterContext) -> Option<Self> {
        self.children = self
            .children
            .into_iter()
            .filter_map(|child| match child {
                LayerGroupChild::Layer(layer_id) => context
                    .accessible_layer_ids
                    .contains(&layer_id)
                    .then_some(LayerGroupChild::Layer(layer_id)),
                LayerGroupChild::Group(group) => group.filter(context).map(LayerGroupChild::Group),
            })
            .collect();
        if self.children.is_empty() {
            return None;
        }
        Some(self)
    }
}

impl Filter for LayerGroupOrReference {
    fn filter(self, context: &FilterContext) -> Option<Self> {
        match self {
            LayerGroupOrReference::Definition(group) => {
                group.filter(context).map(LayerGroupOrReference::Definition)
            }
            group @ LayerGroupOrReference::Reference(_) => Some(group),
        }
    }
}
