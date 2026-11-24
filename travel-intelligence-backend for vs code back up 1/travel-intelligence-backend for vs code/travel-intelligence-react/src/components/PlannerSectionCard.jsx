export default function PlannerSectionCard({
  className = '',
  sectionRef,
  titleContent,
  actions,
  children,
}) {
  return (
    <section className={`PlannerSectionCard${className ? ` ${className}` : ''}`} ref={sectionRef}>
      <div className="PlannerSectionCard__header">
        <div>{titleContent}</div>
        <div className="PlannerSectionCard__actions">{actions}</div>
      </div>
      {children}
    </section>
  )
}
