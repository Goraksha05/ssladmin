// Components/PermissionBadge.js

import React from "react";

const PermissionBadge = ({ perm }) => {
  return (
    <span style={{
      fontSize: "10px",
      background: "#1e293b",
      padding: "2px 6px",
      borderRadius: "4px",
      marginLeft: "6px"
    }}>
      {perm}
    </span>
  );
};

export default PermissionBadge;