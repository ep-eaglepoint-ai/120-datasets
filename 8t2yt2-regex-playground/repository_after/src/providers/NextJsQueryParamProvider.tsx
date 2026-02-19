import React, { FunctionComponent, ReactNode } from "react";

const NextJsQueryParamProvider: FunctionComponent<{ children: ReactNode }> = ({
  children,
}) => {
  return <>{children}</>;
};

export default NextJsQueryParamProvider;
