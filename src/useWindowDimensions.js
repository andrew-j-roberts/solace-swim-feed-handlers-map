/**
 * useWindowDimensions.jsx
 * Render at root app level to provide window dimensions context to entire application
 *
 * Learn here: https://hackernoon.com/simplifying-responsive-layouts-with-react-hooks-19db73893a7a
 */

import React from "react";

const WindowDimensionsContext = React.createContext(null);

export function WindowDimensionsProvider({ children }) {
  const [hasRan, setHasRan] = React.useState(false);
  const [screenSize, setScreenSize] = React.useState({
    height: 0,
    width: 0,
  });
  const updateScreenSize = () => {
    setScreenSize({ width: window.innerWidth, height: window.innerHeight });
  };
  React.useEffect(() => {
    if (!hasRan) {
      setHasRan(true);
      updateScreenSize();
    }
    window.addEventListener("resize", updateScreenSize);
    return () => {
      window.removeEventListener("resize", updateScreenSize);
    };
  }, [screenSize]);

  return (
    <WindowDimensionsContext.Provider value={screenSize}>
      {children}
    </WindowDimensionsContext.Provider>
  );
}

export function useWindowDimensions() {
  return React.useContext(WindowDimensionsContext);
}
