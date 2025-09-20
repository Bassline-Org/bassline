import type { Preview } from '@storybook/react';
import React from 'react';
import { GadgetProvider } from 'port-graphs-react';
import '../apps/web/app/app.css';

// Add Google Fonts
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Oxanium:wght@200..800&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&family=Fira+Code:wght@300..700&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <GadgetProvider>
        <Story />
      </GadgetProvider>
    ),
  ],
};

export default preview;