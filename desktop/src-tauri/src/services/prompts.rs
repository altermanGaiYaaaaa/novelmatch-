pub const SYSTEM_ANALYZE: &str = include_str!("../../prompts/system_analyze.txt");
pub const ANALYZE_BOOK: &str = include_str!("../../prompts/analyze_book.txt");
pub const SYSTEM_PROFILE: &str = include_str!("../../prompts/system_profile.txt");
pub const GENERATE_PROFILE: &str = include_str!("../../prompts/generate_profile.txt");
pub const SYSTEM_MATCH: &str = include_str!("../../prompts/system_match.txt");
pub const EVALUATE_MATCH: &str = include_str!("../../prompts/evaluate_match.txt");

pub const REPAIR_SYSTEM: &str =
    "你是严格的 JSON 修复器。你只输出一个合法的 JSON 对象，不添加代码块、解释或任何前后缀。";

pub fn render(template: &str, variables: &[(&str, &str)]) -> String {
    let mut output = template.to_string();
    for (key, value) in variables {
        output = output.replace(key, value);
    }
    output
}
