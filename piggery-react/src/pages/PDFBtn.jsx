// src/pages/PDFBtn.jsx
// A reusable button that triggers PDF generation/download.
// For now it opens a print-friendly view — replace with jsPDF logic
// once you port ProfessionalPDFGenerator from the HTML version.

import React, { useState } from 'react';
import { S } from '../utils/constants';

export default function PDFBtn({ label = 'PDF', type, getData, icon = '📄', color = '#374151' }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const data = getData ? getData() : {};
      // Try to use ProfessionalPDFGenerator if available globally
      if (window._generatePDF) {
        await window._generatePDF(type, data);
      } else {
        // Fallback: open print dialog
        window.print();
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        ...S.btn(color),
        opacity: loading ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        padding: '7px 13px',
      }}
    >
      {loading ? '⏳' : icon} {loading ? 'Generating…' : label}
    </button>
  );
}
