import React from 'react'

function badgeVariant(label) {
  const positive = ['Strong', 'Same locality', 'Fully overlapping', 'Meets requirement']
  const neutral = ['Moderate', 'Nearby', 'Partially overlapping']
  if (positive.includes(label)) return 'badge-success'
  if (neutral.includes(label)) return 'badge-warning'
  return 'badge-danger'
}

export default function MatchExplanation({ explanation, finalScore, semanticScore }) {
  if (!explanation) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
        <span className="score-pill">Match score: {Math.round(finalScore * 100)}%</span>
        <span className="form-hint">semantic relevance: {Math.round(semanticScore * 100)}%</span>
      </div>
      <div className="match-grid">
        <div className="match-item">
          <strong>Skill match</strong>
          <span className={`badge ${badgeVariant(explanation.semantic_skill_match)}`}>
            {explanation.semantic_skill_match}
          </span>
        </div>
        <div className="match-item">
          <strong>Location</strong>
          <span className={`badge ${badgeVariant(explanation.location)}`}>{explanation.location}</span>
        </div>
        <div className="match-item">
          <strong>Availability</strong>
          <span className={`badge ${badgeVariant(explanation.availability)}`}>{explanation.availability}</span>
        </div>
        <div className="match-item">
          <strong>Experience</strong>
          <span className={`badge ${badgeVariant(explanation.experience)}`}>{explanation.experience}</span>
        </div>
      </div>
    </div>
  )
}
