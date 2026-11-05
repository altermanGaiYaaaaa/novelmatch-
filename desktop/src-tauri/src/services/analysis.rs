use std::collections::{BTreeMap, BTreeSet};

use serde::Deserialize;
use serde_json::json;
use tokio_util::sync::CancellationToken;

use crate::error::{CommandError, CommandResult};
use crate::models::{
    is_dimension, BookAnalysis, DimensionAnalysis, FeatureItem, Profile, ProfilePreferences,
    ReferenceBook, DIMENSION_KEYS,
};
use crate::services::ai::AiClient;
use crate::services::prompts;

#[derive(Debug, Clone)]
pub struct GeneratedProfile {
    pub summary: String,
    pub preferences: ProfilePreferences,
}

#[derive(Debug, Clone)]
pub struct MatchOutcome {
    pub score: i64,
    pub verdict: String,
    pub verdict_note: String,
    pub reasons: Vec<FeatureItem>,
    pub risks: Vec<FeatureItem>,
    pub tags: Vec<String>,
    pub genre: String,
    pub author: String,
    pub quote: String,
    pub quote_source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratedProfileRaw {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    keywords: Vec<String>,
    #[serde(default)]
    likes: Vec<FeatureItem>,
    #[serde(default)]
    dislikes: Vec<FeatureItem>,
    #[serde(default, alias = "dimension_preferences")]
    dimension_preferences: BTreeMap<String, String>,
    #[serde(default)]
    weights: BTreeMap<String, f64>,
    #[serde(default)]
    confidence: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchRaw {
    #[serde(default, alias = "dimension_scores")]
    dimension_scores: BTreeMap<String, f64>,
    #[serde(default)]
    weights: BTreeMap<String, f64>,
    #[serde(default)]
    verdict: String,
    #[serde(default, alias = "verdict_note")]
    verdict_note: String,
    #[serde(default)]
    reasons: Vec<FeatureItem>,
    #[serde(default)]
    risks: Vec<FeatureItem>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    genre: String,
    #[serde(default)]
    author: String,
    #[serde(default)]
    quote: String,
    #[serde(default, alias = "quote_source")]
    quote_source: String,
}

pub async fn analyze_book(
    ai: &AiClient,
    title: &str,
    author: &str,
    excerpt: &str,
    token: &CancellationToken,
) -> CommandResult<BookAnalysis> {
    let user = prompts::render(
        prompts::ANALYZE_BOOK,
        &[
            ("{{TITLE}}", title),
            ("{{AUTHOR}}", author),
            ("{{TEXT}}", excerpt),
        ],
    );
    let mut analysis: BookAnalysis = ai.chat_json(prompts::SYSTEM_ANALYZE, &user, token).await?;
    if analysis.title.trim().is_empty() {
        analysis.title = title.to_string();
    }
    if analysis.author.trim().is_empty() {
        analysis.author = author.to_string();
    }
    normalize_analysis(&mut analysis);
    let filled_dimensions = [
        &analysis.dimensions.writing,
        &analysis.dimensions.plot,
        &analysis.dimensions.character,
        &analysis.dimensions.worldbuilding,
        &analysis.dimensions.pacing,
        &analysis.dimensions.creativity,
        &analysis.dimensions.payoff,
    ]
    .iter()
    .filter(|dimension| !dimension.description.is_empty() || !dimension.features.is_empty())
    .count();
    if filled_dimensions < 4 {
        return Err(CommandError::new(
            "AI_INVALID_ANALYSIS",
            "模型返回的维度分析不完整，请重试或更换模型。",
        ));
    }
    Ok(analysis)
}

pub async fn generate_profile(
    ai: &AiClient,
    profile: &Profile,
    books: &[ReferenceBook],
    analyses: &BTreeMap<String, BookAnalysis>,
    token: &CancellationToken,
) -> CommandResult<GeneratedProfile> {
    let mut positive = Vec::new();
    let mut negative = Vec::new();

    for book in books {
        let analysis = analyses.get(&book.id).cloned().unwrap_or_default();
        let analysis_value = serde_json::to_value(&analysis)?;
        if book.reference_type == "positive" {
            positive.push(json!({
                "title": book.title,
                "ratings": book.ratings,
                "analysis": analysis_value,
            }));
        } else {
            negative.push(json!({
                "title": book.title,
                "worstDimension": book.worst_dimension,
                "secondWorstDimension": book.second_worst_dimension,
                "analysis": analysis_value,
            }));
        }
    }

    let data = json!({
        "genre": profile.custom_genre.clone().unwrap_or_else(|| profile.genre.clone()),
        "positive": positive,
        "negative": negative,
        "sampleCount": books.len(),
    });
    let data_text = serde_json::to_string_pretty(&data)?;
    let user = prompts::render(prompts::GENERATE_PROFILE, &[("{{DATA}}", &data_text)]);
    let raw: GeneratedProfileRaw = ai.chat_json(prompts::SYSTEM_PROFILE, &user, token).await?;

    let summary = raw.summary.trim().to_string();
    if summary.chars().count() < 20 {
        return Err(CommandError::new(
            "AI_INVALID_PROFILE",
            "模型没有生成有效的品味总结，请重试或更换模型。",
        ));
    }

    let keywords = clean_list(raw.keywords, 8, 12);
    let likes = clean_features(raw.likes, 4);
    let dislikes = clean_features(raw.dislikes, 4);
    if likes.is_empty() && dislikes.is_empty() {
        return Err(CommandError::new(
            "AI_INVALID_PROFILE",
            "模型没有归纳出可用的喜欢或不喜欢特征，请重试或更换模型。",
        ));
    }
    if keywords.is_empty() {
        return Err(CommandError::new(
            "AI_INVALID_PROFILE",
            "模型没有生成偏好关键词，请重试或更换模型。",
        ));
    }

    let mut dimension_preferences = BTreeMap::new();
    for key in DIMENSION_KEYS {
        let value = raw
            .dimension_preferences
            .get(key)
            .cloned()
            .unwrap_or_default();
        dimension_preferences.insert(key.to_string(), truncate_chars(value.trim(), 180));
    }

    let weights = normalize_weights(&raw.weights);
    let confidence = normalize_confidence(&raw.confidence, books.len());

    Ok(GeneratedProfile {
        summary: truncate_chars(&summary, 600),
        preferences: ProfilePreferences {
            keywords,
            likes,
            dislikes,
            dimension_preferences,
            weights,
            confidence,
        },
    })
}

pub async fn evaluate_match(
    ai: &AiClient,
    profile: &Profile,
    analysis: &BookAnalysis,
    token: &CancellationToken,
) -> CommandResult<MatchOutcome> {
    let profile_value = json!({
        "name": profile.name,
        "genre": profile.custom_genre.clone().unwrap_or_else(|| profile.genre.clone()),
        "summary": profile.summary,
        "keywords": profile.preferences.keywords,
        "likes": profile.preferences.likes,
        "dislikes": profile.preferences.dislikes,
        "dimensionPreferences": profile.preferences.dimension_preferences,
        "weights": profile.preferences.weights,
    });
    let profile_text = serde_json::to_string_pretty(&profile_value)?;
    let analysis_text = serde_json::to_string_pretty(analysis)?;
    let user = prompts::render(
        prompts::EVALUATE_MATCH,
        &[
            ("{{PROFILE}}", &profile_text),
            ("{{ANALYSIS}}", &analysis_text),
        ],
    );

    let raw: MatchRaw = ai.chat_json(prompts::SYSTEM_MATCH, &user, token).await?;

    let valid_scores = raw
        .dimension_scores
        .keys()
        .filter(|key| is_dimension(key.as_str()))
        .count();
    if valid_scores < 5 {
        return Err(CommandError::new(
            "AI_INVALID_MATCH",
            "模型没有返回完整的维度匹配结果，请重试。",
        ));
    }

    let max_raw_score = raw
        .dimension_scores
        .values()
        .copied()
        .filter(|value| value.is_finite())
        .fold(0.0_f64, f64::max);
    let score_scale = if max_raw_score > 0.0 && max_raw_score <= 1.0 {
        100.0
    } else {
        1.0
    };

    let mut numerator = 0.0;
    let mut denominator = 0.0;
    for key in DIMENSION_KEYS {
        let weight = raw
            .weights
            .get(key)
            .copied()
            .or_else(|| profile.preferences.weights.get(key).copied())
            .unwrap_or(1.0);
        let weight = if weight.is_finite() && weight > 0.0 {
            weight.clamp(0.0, 20.0)
        } else {
            1.0
        };
        let score = raw.dimension_scores.get(key).copied().unwrap_or(60.0) * score_scale;
        let score = score.clamp(0.0, 100.0);
        numerator += weight * score;
        denominator += weight;
    }
    let score = if denominator > 0.0 {
        (numerator / denominator).round().clamp(0.0, 100.0) as i64
    } else {
        60
    };

    let verdict = if raw.verdict.trim().is_empty() {
        default_verdict(score).to_string()
    } else {
        truncate_chars(raw.verdict.trim(), 40)
    };
    let verdict_note = if raw.verdict_note.trim().is_empty() {
        format!("匹配度基于前十章内容与画像的七个维度综合计算，结果仅供参考。")
    } else {
        truncate_chars(raw.verdict_note.trim(), 120)
    };

    let mut reasons = clean_features(raw.reasons, 4);
    if reasons.is_empty() {
        reasons.push(FeatureItem {
            title: "整体方向接近".to_string(),
            description: "模型认为这本小说与你当前画像的主要偏好存在交集。".to_string(),
        });
    }
    let mut risks = clean_features(raw.risks, 3);

    let tags = if raw.tags.is_empty() {
        analysis.tags.clone()
    } else {
        clean_list(raw.tags, 5, 14)
    };

    Ok(MatchOutcome {
        score,
        verdict,
        verdict_note,
        reasons,
        risks: if risks.is_empty() {
            risks.push(FeatureItem {
                title: "仍建议先试读".to_string(),
                description: "前十章不能完全代表后续质量，建议结合试读再做决定。".to_string(),
            });
            risks
        } else {
            risks
        },
        tags,
        genre: if raw.genre.trim().is_empty() {
            analysis.genre.clone()
        } else {
            truncate_chars(raw.genre.trim(), 20)
        },
        author: if raw.author.trim().is_empty() {
            analysis.author.clone()
        } else {
            truncate_chars(raw.author.trim(), 60)
        },
        quote: if raw.quote.trim().is_empty() {
            analysis.quote.clone()
        } else {
            truncate_chars(raw.quote.trim(), 240)
        },
        quote_source: if raw.quote_source.trim().is_empty() {
            analysis.quote_source.clone()
        } else {
            truncate_chars(raw.quote_source.trim(), 80)
        },
    })
}

fn normalize_analysis(analysis: &mut BookAnalysis) {
    analysis.title = truncate_chars(analysis.title.trim(), 80);
    analysis.author = truncate_chars(analysis.author.trim(), 60);
    analysis.genre = truncate_chars(analysis.genre.trim(), 20);
    analysis.tags = clean_list(std::mem::take(&mut analysis.tags), 5, 14);
    analysis.quote = truncate_chars(analysis.quote.trim(), 240);
    analysis.quote_source = truncate_chars(analysis.quote_source.trim(), 80);

    normalize_dimension(&mut analysis.dimensions.writing);
    normalize_dimension(&mut analysis.dimensions.plot);
    normalize_dimension(&mut analysis.dimensions.character);
    normalize_dimension(&mut analysis.dimensions.worldbuilding);
    normalize_dimension(&mut analysis.dimensions.pacing);
    normalize_dimension(&mut analysis.dimensions.creativity);
    normalize_dimension(&mut analysis.dimensions.payoff);
}

fn normalize_dimension(dimension: &mut DimensionAnalysis) {
    dimension.features = clean_list(std::mem::take(&mut dimension.features), 6, 30);
    dimension.description = truncate_chars(dimension.description.trim(), 200);
}

fn clean_list(values: Vec<String>, limit: usize, max_chars: usize) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut output = Vec::new();
    for value in values {
        let value = value.trim();
        if value.is_empty() {
            continue;
        }
        let value = truncate_chars(value, max_chars);
        if seen.insert(value.clone()) {
            output.push(value);
        }
        if output.len() >= limit {
            break;
        }
    }
    output
}

fn clean_features(values: Vec<FeatureItem>, limit: usize) -> Vec<FeatureItem> {
    values
        .into_iter()
        .filter_map(|item| {
            let title = truncate_chars(item.title.trim(), 40);
            let description = truncate_chars(item.description.trim(), 160);
            if title.is_empty() && description.is_empty() {
                return None;
            }
            Some(FeatureItem {
                title: if title.is_empty() {
                    "未命名特征".to_string()
                } else {
                    title
                },
                description,
            })
        })
        .take(limit)
        .collect()
}

fn normalize_weights(raw: &BTreeMap<String, f64>) -> BTreeMap<String, f64> {
    let mut values = BTreeMap::new();
    let mut total = 0.0;
    for key in DIMENSION_KEYS {
        let value = raw.get(key).copied().unwrap_or(1.0);
        let value = if value.is_finite() && value > 0.0 {
            value.min(100.0)
        } else {
            1.0
        };
        values.insert(key.to_string(), value);
        total += value;
    }
    if total <= 0.0 {
        let value = 1.0 / DIMENSION_KEYS.len() as f64;
        return DIMENSION_KEYS
            .iter()
            .map(|key| (key.to_string(), value))
            .collect();
    }
    values
        .into_iter()
        .map(|(key, value)| (key, (value / total * 10_000.0).round() / 10_000.0))
        .collect()
}

fn normalize_confidence(raw: &str, sample_count: usize) -> String {
    match raw.trim() {
        "高" => {
            if sample_count >= 8 {
                "高".to_string()
            } else if sample_count >= 5 {
                "中高".to_string()
            } else {
                "中".to_string()
            }
        }
        "中高" => {
            if sample_count >= 5 {
                "中高".to_string()
            } else {
                "中".to_string()
            }
        }
        "中" => "中".to_string(),
        "建立中" => "建立中".to_string(),
        _ => {
            if sample_count >= 8 {
                "高".to_string()
            } else if sample_count >= 5 {
                "中高".to_string()
            } else if sample_count >= 3 {
                "中".to_string()
            } else {
                "建立中".to_string()
            }
        }
    }
}

fn default_verdict(score: i64) -> &'static str {
    if score >= 85 {
        "高度匹配，建议优先阅读"
    } else if score >= 70 {
        "较为匹配，可以试读"
    } else if score >= 55 {
        "部分契合，建议先看几章"
    } else {
        "契合度较低，谨慎尝试"
    }
}

fn truncate_chars(value: &str, max: usize) -> String {
    value
        .chars()
        .take(max)
        .collect::<String>()
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weights_are_normalized_to_one() {
        let mut raw = BTreeMap::new();
        raw.insert("writing".to_string(), 2.0);
        raw.insert("plot".to_string(), 4.0);
        raw.insert("payoff".to_string(), 4.0);
        let weights = normalize_weights(&raw);
        assert_eq!(weights.len(), 7);
        let sum: f64 = weights.values().sum();
        assert!((sum - 1.0).abs() < 0.001);
        assert!(weights["plot"] > weights["writing"]);
    }

    #[test]
    fn confidence_does_not_exceed_sample_size() {
        assert_eq!(normalize_confidence("高", 2), "中");
        assert_eq!(normalize_confidence("中高", 3), "中");
        assert_eq!(normalize_confidence("高", 9), "高");
        assert_eq!(normalize_confidence("未知", 1), "建立中");
    }

    #[test]
    fn list_cleanup_deduplicates_and_truncates() {
        let values = vec![
            "世界观".to_string(),
            " 世界观 ".to_string(),
            "".to_string(),
            "节奏".to_string(),
        ];
        let cleaned = clean_list(values, 8, 12);
        assert_eq!(cleaned, vec!["世界观".to_string(), "节奏".to_string()]);
    }
}
