export default function WorkspaceSidebar({
  sections,
  activeSectionId,
  activeChildId,
  onGoToSection,
  onToggleAllSections,
  onHideSidebar,
  onToggleAiAssistant,
}) {
  return (
    <aside className="PlannerSidebar">
      <button type="button" className="PlannerAiButton" aria-label="AI Assistant" onClick={onToggleAiAssistant}>
        <span className="PlannerAiButton__line PlannerAiButton__line--strong">AI</span>
        <span className="PlannerAiButton__line">Assistant</span>
      </button>

      <nav className="PlannerSidebar__nav">
        {sections.map((section) => (
          <div key={section.id} className="PlannerSidebar__group">
            <button
              type="button"
              className={`PlannerSidebar__item reset-btn${activeSectionId === section.id || (section.id === 'itinerary' && activeChildId) ? ' is-active' : ''}`}
              data-section-id={section.id}
              onClick={() => onGoToSection(section.id)}
            >
              <span className="PlannerSidebar__itemText">{section.label}</span>
            </button>
            {(section.children || []).map((child) => (
              <button
                key={child.id}
                type="button"
                className={`PlannerSidebar__child reset-btn${activeChildId === child.id ? ' is-active' : ''}`}
                onClick={() => onGoToSection(child.id)}
              >
                {child.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="PlannerSidebar__footer">
        <button type="button" className="PlannerSidebar__support reset-btn" onClick={onToggleAllSections}>Collapse all sections</button>
        <button type="button" className="PlannerSidebar__support reset-btn">Support</button>
        <button type="button" className="PlannerSidebar__support reset-btn" onClick={onHideSidebar}>Hide sidebar</button>
      </div>
    </aside>
  )
}
