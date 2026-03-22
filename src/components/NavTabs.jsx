export default function NavTabs({ tab, setTab }) {
  return (
    <div className="tabs">
      <button
        className={tab === 'dataset' ? 'tab active' : 'tab'}
        onClick={() => setTab('dataset')}
      >
        Dataset
      </button>

      <button
        className={tab === 'ui-audio' ? 'tab active' : 'tab'}
        onClick={() => setTab('ui-audio')}
      >
        Audios UI
      </button>
    </div>
  )
}