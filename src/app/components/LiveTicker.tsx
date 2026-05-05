'use client';

import React, { useState, useEffect } from 'react';

const ACTIVITIES = [
  "New node: 'Doctrine of Severability' drafted by Student@NLSIU",
  "Peer review: 'Article 21' verified by Scholar@GNLU",
  "Connection established: 'Kesavananda Bharati' ↔ 'Basic Structure'",
  "Quality Signal: 'Right to Privacy' updated to Community Verified",
  "New contribution: 'Informational Privacy' tagged by User@NALSAR",
  "Reputation Gain: +5 points for Peer Review on 'Natural Justice'",
  "Moot Prep: 'Admin Law' graph expanded by 12 nodes today"
];

export default function LiveTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ACTIVITIES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="lp-ticker-container">
      <div className="lp-ticker-label">Activity Feed</div>
      <div className="lp-ticker-content">
        <div key={index} className="lp-ticker-item">
          <span className="lp-ticker-dot" />
          {ACTIVITIES[index]}
        </div>
      </div>
    </div>
  );
}
