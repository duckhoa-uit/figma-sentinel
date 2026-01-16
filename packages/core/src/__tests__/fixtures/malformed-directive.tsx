// Component with malformed directives
// @figma-node: 1:23
// Missing @figma-file directive - should be skipped with warning

import React from 'react';

export const Footer = () => {
  return <footer>Footer content</footer>;
};
