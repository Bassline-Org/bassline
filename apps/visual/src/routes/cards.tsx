/**
 * Cards Route - 3D parallax card set browser
 */

import { useLoaderData } from 'react-router'
import { motion } from 'framer-motion'
import type { CardsLoaderData } from '@/types'
import { CardBrowser } from '@/components/cards'
import { timing, easing } from '@/lib/motion'

export function Cards() {
  const { sets, currentSetId, currentSetCards } = useLoaderData() as CardsLoaderData

  return (
    <motion.div
      className="h-screen bg-background p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: timing.fast, ease: easing.ease }}
    >
      <CardBrowser
        sets={sets}
        cards={currentSetCards}
        currentSetId={currentSetId}
      />
    </motion.div>
  )
}

export default Cards
