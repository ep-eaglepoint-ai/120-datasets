import React, { FunctionComponent } from "react";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onClickRemove: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  pattern: RegExp | null;
}

const Textarea: FunctionComponent<Props> = () => {
  return null;
};

export default Textarea;
