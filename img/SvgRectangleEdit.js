import * as React from "react";

function SvgRectangleEdit(props) {
  return (
    <svg
      aria-label="Rectangle filter tool"
      focusable={false}
      viewBox="0 0 64 64"
      fillRule="evenodd"
      clipRule="evenodd"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={1.5}
      {...props}
    >
      <path
        fill="none"
        stroke="#000"
        strokeWidth={0.9978915}
        strokeDasharray=".85,1.7,0,0"
        d="M4.1 4.1h55.801v55.8h-55.8z"
      />
      <circle
        cx={6.021}
        cy={6.021}
        r={1.922}
        transform="translate(-1.922 -1.922)"
      />
      <circle
        cx={6.021}
        cy={6.021}
        r={1.922}
        transform="translate(53.879 -1.922)"
      />
      <circle
        cx={6.021}
        cy={6.021}
        r={1.922}
        transform="translate(53.879 53.879)"
      />
      <circle
        cx={6.021}
        cy={6.021}
        r={1.922}
        transform="translate(-1.922 53.879)"
      />
    </svg>
  );
}

export default SvgRectangleEdit;
