import { useNavigate, useParams, useLocation } from "react-router-dom";
import React from "react";

export function withRouter(Component: React.ComponentType) {
  return function WrappedComponent(props: React.ComponentProps<any>) {
    const navigate = useNavigate();
    const params = useParams();
    const location = useLocation();
    return (
      <Component
        {...props}
        navigate={navigate}
        params={params}
        location={location}
      />
    );
  };
}
