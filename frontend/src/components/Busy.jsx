// "Thinking" indicator reusing the dashboard's own animated dots.
export default function Busy({ children }) {
  return (
    <div className="busy" role="status" aria-live="polite">
      <span className="dots3" aria-hidden="true"><i></i><i></i><i></i></span>
      {children}
    </div>
  )
}
