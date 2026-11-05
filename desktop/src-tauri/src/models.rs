use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const DIMENSION_KEYS: [&str; 7] = [
    "writing",
    "plot",
    "character",
    "worldbuilding",
    "pacing",
    "creativity",
    "payoff",
];

pub const PROMPT_VERSION: &str = "v1.0";

pub fn is_dimension(key: &str) -> bool {
    DIMENSION_KEYS.contains(&key)
}

pub fn dimension_label(key: &str) -> &'static str {
    match key {
        "writing" => "文笔",
        "plot" => "剧情",
        "character" => "人物塑造",
        "worldbuilding" => "世界观",
        "pacing" => "节奏",
        "creativity" => "创意",
        "payoff" => "爽点",
        _ => "未知维度",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FeatureItem {
    #[serde(default, alias = "name", alias = "t")]
    pub title: String,
    #[serde(default, alias = "desc", alias = "detail", alias = "d")]
    pub description: String,
}

impl FeatureItem {
    pub fn is_empty(&self) -> bool {
        self.title.trim().is_empty() && self.description.trim().is_empty()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePreferences {
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub likes: Vec<FeatureItem>,
    #[serde(default)]
    pub dislikes: Vec<FeatureItem>,
    #[serde(default, alias = "dimension_preferences")]
    pub dimension_preferences: BTreeMap<String, String>,
    #[serde(default)]
    pub weights: BTreeMap<String, f64>,
    #[serde(default)]
    pub confidence: String,
}

impl Default for ProfilePreferences {
    fn default() -> Self {
        Self {
            keywords: Vec::new(),
            likes: Vec::new(),
            dislikes: Vec::new(),
            dimension_preferences: BTreeMap::new(),
            weights: BTreeMap::new(),
            confidence: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub genre: String,
    pub custom_genre: Option<String>,
    pub summary: String,
    pub preferences: ProfilePreferences,
    pub status: String,
    pub book_count: i64,
    pub evaluation_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceBook {
    pub id: String,
    pub profile_id: String,
    pub title: String,
    pub url: String,
    pub reference_type: String,
    pub ratings: BTreeMap<String, i64>,
    pub worst_dimension: Option<String>,
    pub second_worst_dimension: Option<String>,
    pub ready: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DimensionAnalysis {
    #[serde(default)]
    pub features: Vec<String>,
    #[serde(default, alias = "summary")]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Dimensions {
    #[serde(default)]
    pub writing: DimensionAnalysis,
    #[serde(default)]
    pub plot: DimensionAnalysis,
    #[serde(default)]
    pub character: DimensionAnalysis,
    #[serde(default)]
    pub worldbuilding: DimensionAnalysis,
    #[serde(default)]
    pub pacing: DimensionAnalysis,
    #[serde(default)]
    pub creativity: DimensionAnalysis,
    #[serde(default)]
    pub payoff: DimensionAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookAnalysis {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub genre: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub dimensions: Dimensions,
    #[serde(default)]
    pub quote: String,
    #[serde(default, alias = "quote_source")]
    pub quote_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationReport {
    #[serde(default)]
    pub book_title: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub genre: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub score: i64,
    #[serde(default)]
    pub verdict: String,
    #[serde(default, alias = "verdict_note")]
    pub verdict_note: String,
    #[serde(default)]
    pub reasons: Vec<FeatureItem>,
    #[serde(default)]
    pub risks: Vec<FeatureItem>,
    #[serde(default)]
    pub quote: String,
    #[serde(default, alias = "quote_source")]
    pub quote_source: String,
    #[serde(default)]
    pub profile_name: String,
    #[serde(default)]
    pub chapter_range: String,
    #[serde(default)]
    pub model_name: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationRecord {
    pub id: String,
    pub profile_id: String,
    pub book_title: String,
    pub book_url: String,
    pub match_score: f64,
    pub chapter_range: String,
    pub report: EvaluationReport,
    pub status: String,
    pub model_name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigView {
    pub configured: bool,
    pub model_name: String,
    pub base_url: String,
    pub api_key_masked: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    pub profiles: Vec<Profile>,
    pub model_config: ModelConfigView,
    pub monthly_evaluations: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub task_id: String,
    pub stage: String,
    pub stage_index: usize,
    pub total_stages: usize,
    pub progress: u8,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionResult {
    pub ok: bool,
    pub message: String,
    pub latency_ms: u64,
    pub model_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookMeta {
    pub title: String,
    pub author: String,
    pub url: String,
}
