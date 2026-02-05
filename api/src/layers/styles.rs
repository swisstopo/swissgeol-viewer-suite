use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LayerStyle {
    Unique(UniqueStyle),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UniqueStyle {
    /// Name of the property used for classification
    pub property: String,

    pub values: Vec<UniqueValueStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UniqueValueStyle {
    pub geom_type: GeometryType,

    /// Matching value from `property`.
    pub value: StyleValue,

    pub vector_options: VectorOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GeometryType {
    Point,
    Line,
    Polygon,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StyleValue {
    String(String),
    Number(f64),
    Bool(bool),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorOptions {
    #[serde(rename = "type")]
    pub kind: MarkerType,

    pub radius: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rotation: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill: Option<FillStyle>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke: Option<StrokeStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MarkerType {
    Circle,
    Triangle,
    Square,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillStyle {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrokeStyle {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
}
