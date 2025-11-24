use serde::{Deserialize, Deserializer};
use serde::{Serialize, Serializer};
use serde::de::Unexpected;

#[derive(Debug, Clone, PartialEq)]
pub enum LayerOpacity {
    Default(f32),
    Disabled,
}

impl Default for LayerOpacity {
    fn default() -> Self {
        Self::Default(1.0)
    }
}

impl<'de> Deserialize<'de> for LayerOpacity {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let v = serde_json::Value::deserialize(deserializer)?;

        match v {
            serde_json::Value::Number(n) => {
                n.as_f64()
                    .map(|f| LayerOpacity::Default(f as f32))
                    .ok_or_else(|| serde::de::Error::invalid_type(Unexpected::Other("non-float"), &"float"))
            }
            serde_json::Value::String(s) if s == "Disabled" => Ok(LayerOpacity::Disabled),
            _ => Err(serde::de::Error::invalid_value(Unexpected::Other(&format!("{v}")), &"number or \"Disabled\"")),
        }
    }
}

impl Serialize for LayerOpacity {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            LayerOpacity::Default(v) => serializer.serialize_f32(*v),
            LayerOpacity::Disabled => serializer.serialize_str("Disabled"),
        }
    }
}
