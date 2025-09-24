use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(untagged)]
pub enum TranslatedString {
    One(String),
    Multiple {
        de: String,
        en: String,
        fr: String,
        it: String,
    }
}
