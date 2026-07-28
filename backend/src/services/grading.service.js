const GRADE_LABELS = { APLUS: 'A+', A: 'A', B: 'B', C: 'C', D: 'D' };
const LABEL_TO_GRADE = { 'A+': 'APLUS', A: 'A', B: 'B', C: 'C', D: 'D' };
const GRADE_SCORE = { APLUS: 4.3, A: 4.0, B: 3.0, C: 2.0, D: 1.0 };

// Accepts either a display label ("A+", "B") or an already-valid enum value
// ("APLUS", "B") so it's safe to round-trip data read back from the database.
function parseGradeLabel(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase();
  if (GRADE_LABELS[key]) return key;
  return LABEL_TO_GRADE[key] || null;
}

function gradeLabel(grade) {
  return GRADE_LABELS[grade] || grade;
}

// Used as a fallback when a CSV row (or manual entry) doesn't specify a grade,
// approximating setup quality from the realized R-multiple.
function inferGradeFromRR(rr) {
  if (rr === null || rr === undefined || Number.isNaN(rr)) return null;
  if (rr >= 3) return 'APLUS';
  if (rr >= 2) return 'A';
  if (rr >= 1) return 'B';
  if (rr >= 0) return 'C';
  return 'D';
}

// Sessions are inferred from the UTC hour of entry when not explicitly provided.
function inferSessionFromDate(date) {
  const hour = date.getUTCHours();
  if (hour >= 0 && hour < 7) return 'ASIAN';
  if (hour >= 7 && hour < 12) return 'LONDON';
  if (hour >= 12 && hour < 21) return 'NEWYORK';
  return 'OTHER';
}

function averageGradeLabel(trades) {
  const scored = trades.filter((t) => GRADE_SCORE[t.grade] !== undefined);
  if (scored.length === 0) return '—';
  const avg = scored.reduce((sum, t) => sum + GRADE_SCORE[t.grade], 0) / scored.length;

  if (avg >= 4.15) return 'A+';
  if (avg >= 3.7) return 'A';
  if (avg >= 3.3) return 'B+';
  if (avg >= 2.7) return 'B';
  if (avg >= 2.3) return 'B-';
  if (avg >= 1.7) return 'C';
  return 'D';
}

module.exports = {
  GRADE_LABELS,
  LABEL_TO_GRADE,
  GRADE_SCORE,
  parseGradeLabel,
  gradeLabel,
  inferGradeFromRR,
  inferSessionFromDate,
  averageGradeLabel,
};
