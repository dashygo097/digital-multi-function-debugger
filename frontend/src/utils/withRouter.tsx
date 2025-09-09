import { useNavigate, useParams, useLocation } from "react-router-dom";
import React from "react";

export interface WithRouterProps {
  navigate?: ReturnType<typeof useNavigate>;
  params?: ReturnType<typeof useParams>;
  location?: ReturnType<typeof useLocation>;
}

export function WithRouter(Component: React.ComponentType<WithRouterProps>) {
  return function WrappedComponent(props: WithRouterProps) {
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
