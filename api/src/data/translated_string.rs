use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Eq, PartialEq, Hash, Deserialize, Serialize)]
#[serde(untagged)]
pub enum TranslatedString {
    One(String),
    Multiple {
        de: String,
        en: String,
        fr: String,
        it: String,
    },
}
