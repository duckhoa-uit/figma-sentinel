// Component with multiple @figma-file directives (invalid - should use first one)
// @figma-file: FILE1ABC123
// @figma-file: FILE2XYZ789
// @figma-node: 100:200

import React from 'react';

export const Menu = () => {
  return <nav>Menu</nav>;
};
