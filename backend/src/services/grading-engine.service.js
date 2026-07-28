// Converts a trade's broken rules into a grade. Every rule carries a weight;
// each broken rule deducts points from a perfect 100 score, and the final
// score buckets into a letter grade. Tuned so a single low-weight break stays
// near the top, while stacking violations (or one high-weight break) drags
// the grade down fast.
const WEIGHT_POINTS = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 35,
};

const SCORE_THRESHOLDS = [
  { min: 100, grade: 'APLUS' },
  { min: 80, grade: 'A' },
  { min: 60, grade: 'B' },
  { min: 35, grade: 'C' },
  { min: -Infinity, grade: 'D' },
];

function scoreToGrade(score) {
  return SCORE_THRESHOLDS.find((t) => score >= t.min).grade;
}

// weights: array of 'LOW' | 'MEDIUM' | 'HIGH', one per broken rule on the trade.
function computeAutoGrade(weights) {
  const deduction = weights.reduce((sum, w) => sum + (WEIGHT_POINTS[w] || 0), 0);
  const score = Math.max(0, 100 - deduction);
  return { grade: scoreToGrade(score), score };
}

module.exports = { WEIGHT_POINTS, computeAutoGrade, scoreToGrade };
