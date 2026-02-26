import { useGSAP } from '@gsap/react'
import { PropsWithChildren, useRef } from 'react'
import { SplitText } from 'gsap/SplitText'
import { Observer } from 'gsap/Observer'
import gsap from 'gsap'

export const expand = {
  scale: 1.3,
  duration: 0.15,
}
export const contract = {
  scale: 1,
  duration: 0.3,
  ease: 'bounce.out',
}

export function Question() {
  return (
    <>
      <g clip-path="url(#clip0_13_17)">
        <path
          className="fill-foreground"
          d="M16 23.75C16.6904 23.75 17.25 23.1904 17.25 22.5C17.25 21.8096 16.6904 21.25 16 21.25C15.3096 21.25 14.75 21.8096 14.75 22.5C14.75 23.1904 15.3096 23.75 16 23.75Z"
        />
        <path
          className="stroke-foreground stroke-2"
          d="M16 18V17C18.2088 17 20 15.4325 20 13.5C20 11.5675 18.2088 10 16 10C13.7912 10 12 11.5675 12 13.5V14"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28Z"
          className="stroke-foreground stroke-2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_13_17">
          <rect width="32" height="32" className="fill-none" />
        </clipPath>
      </defs>
    </>
  )
}

export function Drawn() {
  const ref = useRef(null)
  useGSAP(
    () => {
      const c = ref.current!
      const q = gsap.utils.selector(c)
      const tl = gsap.timeline()
      tl.from(q('path'), { duration: 1, drawSVG: 0 }).to(c, expand).to(c, contract)
      const from = { scale: 1, duration: 0.5, rotate: 0 }
      const origin = { ...from, duration: 1, rotate: 0 }

      const hover = gsap
        .timeline({ repeat: -1 })
        .to(c, origin)
        .to(c, { rotate: 20, duration: 1.5 })
        .to(c, origin)
        .to(c, { rotate: -20, duration: 1.5 })
        .to(c, origin)

      hover.pause()

      const to = { scale: 1.3, duration: 0.5 }

      Observer.create({
        target: c,
        type: 'pointer',
        onHover: () => {
          hover.restart()
        },
        onHoverEnd: () => {
          hover.restart()
          hover.pause()
          gsap.to(c, origin)
        },
        onDragStart: () => {
          gsap.to(c, to)
        },
        onDragEnd: () => {
          gsap.to(c, from)
        },
      })
    },
    { scope: ref }
  )

  return (
    <>
      <svg ref={ref} width="100" height="100" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <Question />
      </svg>
    </>
  )
}

export function ExampleText({ children, className = 'p-4' }: PropsWithChildren<{ className?: string }>) {
  const container = useRef<HTMLDivElement | null>(null)
  useGSAP(
    () => {
      let split = SplitText.create('.split', { type: 'chars' })
      gsap.from(split.chars, {
        duration: 0.3,
        y: 10,
        autoAlpha: 0,
        stagger: 0.01,
      })
    },
    { scope: container }
  )
  return (
    <div ref={container} className={className}>
      <div className="split">{children}</div>
    </div>
  )
}
