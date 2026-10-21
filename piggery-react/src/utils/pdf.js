import jsPDF from 'jspdf'

export function getBusinessProfile() {
  // TODO: replace with your old code
  return { name: 'FarmIQ', address: '', phone: '' }
}

export function downloadContractPDF(contract, worker) {
  try {
    const profile = getBusinessProfile()
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(profile.name || 'FarmIQ', 14, 20)
    doc.setFontSize(14)
    doc.text('Employment Contract', 14, 32)
    doc.setFontSize(11)

    let y = 46
    const line = (label, value) => {
      if (value === undefined || value === null || typeof value === 'object') return
      doc.text(`${label}: ${value}`, 14, y)
      y += 8
    }
    line('Worker', worker?.name)
    Object.entries(contract || {}).forEach(([k, v]) => line(k, v))

    doc.save(`contract-${worker?.name || 'worker'}.pdf`)
    return false
  } catch (e) {
    console.error(e)
    return true
  }
}
