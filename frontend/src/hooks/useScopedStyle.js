import { useLayoutEffect } from 'react'

// Each design ships its own global stylesheet (body, a, .chip, .frame … differ between pages),
// so a page's CSS is only mounted while that page is on screen.
export function useScopedStyle(...cssTexts) {
  useLayoutEffect(() => {
    const nodes = cssTexts.map((css) => {
      const el = document.createElement('style')
      el.textContent = css
      document.head.appendChild(el)
      return el
    })
    return () => nodes.forEach((el) => el.remove())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
