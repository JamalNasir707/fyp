import { Link } from 'react-router-dom'
import PrintTripContent from '../components/PrintTripContent'
import { readPrintSnapshot } from '../lib/trips'

export default function PrintTripPage() {
  const trip = readPrintSnapshot() || { title: 'My Trip', dates: '', days: [] }
  return (
    <div className="PrintPage">
      <div className="PrintToolbar no-print">
        <Link to="/workspace" className="PrintToolbar__back">Back to workspace</Link>
        <button type="button" className="PrintToolbar__btn" onClick={() => window.print()}>Print this trip</button>
      </div>
      <PrintTripContent trip={trip} />
    </div>
  )
}
