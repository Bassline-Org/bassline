import type { Preview } from '@storybook/react';
import React from 'react';
import { GadgetProvider } from 'port-graphs-react';

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