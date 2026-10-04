export default function PageHead({ eyebrow, title, children, actions }) {
  return (
    <section className="card ph-head">
      <span className="mono" style={{ color: 'var(--ac)' }}>{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
      {actions && <div className="ph-row">{actions}</div>}
    </section>
  )
}
