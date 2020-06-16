import * as React from "react";

function SvgTrashcan(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-label="Delete selected shape"
      focusable={false}
      {...props}
    >
      <path
        className="icon-trash_svg__heroicon-ui"
        d="M8 6V4c0-1.1.9-2 2-2h4a2 2 0 012 2v2h5a1 1 0 010 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8H3a1 1 0 110-2h5zM6 8v12h12V8H6zm8-2V4h-4v2h4zm-4 4a1 1 0 011 1v6a1 1 0 01-2 0v-6a1 1 0 011-1zm4 0a1 1 0 011 1v6a1 1 0 01-2 0v-6a1 1 0 011-1z"
      />
    </svg>
  );
}

export default SvgTrashcan;
