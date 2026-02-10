use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerStyle {
    /// Name of the property used for classification
    pub property: String,

    pub values: Vec<LayerStyleValues>,
}

/// Tagged union for style values, discriminated by `geomType`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "geomType", rename_all = "camelCase")]
pub enum LayerStyleValues {
    Point(PointStyleValues),
    Line(LineStyleValues),
    Polygon(PolygonStyleValues),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointStyleValues {
    pub value: StyleValue,
    pub vector_options: PointVectorOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineStyleValues {
    pub value: StyleValue,
    pub vector_options: LineVectorOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolygonStyleValues {
    pub value: StyleValue,
    pub vector_options: PolygonVectorOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StyleValue {
    String(String),
    Number(f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointVectorOptions {
    #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<PointMarkerType>,

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
pub struct LineVectorOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke: Option<StrokeStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolygonVectorOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill: Option<FillStyle>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke: Option<StrokeStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PointMarkerType {
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
